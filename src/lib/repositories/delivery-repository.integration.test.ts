import { createHash } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentCreator } from "@/lib/auth/get-current-creator";
import { db } from "@/lib/db";
import { contentHash } from "@/lib/schema/content-hash";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import type { CommissionState } from "@/lib/state-machine/rules";
import {
  StoredFileTooLargeError,
  uploadKey,
  type DeliveryStorage,
} from "@/lib/storage/deliveries";
import { getClientAgreement } from "./agreement-repository";
import {
  createDeliveryUpload,
  recordDelivery,
  requestDeliveryDownload,
} from "./delivery-repository";

const bucket = vi.hoisted(
  () => new Map<string, { body: Buffer; mimeType: string }>(),
);
const createBalanceInvoice = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/auth/get-current-creator", () => ({
  getCurrentCreator: vi.fn(),
}));
vi.mock("@/lib/state-machine/effect-handlers", () => ({
  effectHandlers: { createBalanceInvoice },
}));
vi.mock("@/lib/db", async () => {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@/generated/prisma/client");
  return {
    db: new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.TEST_DATABASE_URL,
      }),
    }),
  };
});
vi.mock("@/lib/storage/deliveries", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/storage/deliveries")>();
  const { createHash } = await import("node:crypto");
  const fake: DeliveryStorage = {
    presignUpload: async ({ key }) => `https://bucket.test/deliveries/${key}`,
    async copy(from, to) {
      const object = bucket.get(from);
      if (!object) {
        throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
      }
      bucket.set(to, { ...object });
    },
    async inspect(key, maxBytes) {
      const object = bucket.get(key)!;
      if (object.body.length > maxBytes) {
        throw new actual.StoredFileTooLargeError();
      }
      return {
        sha256: createHash("sha256").update(object.body).digest("hex"),
        sizeBytes: object.body.length,
        mimeType: object.mimeType,
      };
    },
    async remove(key) {
      bucket.delete(key);
    },
    presignDownload: async ({ key, filename }) =>
      `https://bucket.test/deliveries/${key}?name=${encodeURIComponent(filename)}`,
  };
  return { ...actual, getDeliveryStorage: () => fake };
});

const url = process.env.TEST_DATABASE_URL;
const agreement = {
  ...exampleAgreement,
  parties: {
    client: {
      display_name: "Ren",
      handle: "@ren_ch",
      email: "ren@example.com",
    },
  },
};
const token = "T".repeat(22);
const sha256 = (body: Buffer) =>
  createHash("sha256").update(body).digest("hex");

describe.skipIf(!url)("delivery repository (database)", () => {
  afterAll(() => db.$disconnect());

  beforeEach(async () => {
    vi.clearAllMocks();
    bucket.clear();
    await db.$executeRawUnsafe(
      "TRUNCATE creators, commissions, agreement_versions, confirmations, invoices, deliveries, delivery_downloads, commission_events, change_requests, follow_up_dms, rate_cards, webhook_events RESTART IDENTITY CASCADE",
    );
  });

  async function signIn() {
    const creator = await db.creator.create({
      data: {
        authUserId: crypto.randomUUID(),
        email: `${crypto.randomUUID()}@test.dev`,
        displayName: "Test Creator",
      },
    });
    vi.mocked(getCurrentCreator).mockResolvedValue({
      id: creator.id,
      email: creator.email,
      displayName: creator.displayName,
      paypalEmail: null,
    });
    return creator;
  }

  async function seed(state: CommissionState, clientToken = token) {
    const creator = await signIn();
    const hash = contentHash(agreement);
    const commission = await db.commission.create({
      data: {
        creatorId: creator.id,
        sourceDm: "dm",
        state,
        clientToken,
        agreementVersions: {
          create: {
            version: 1,
            content: agreement,
            contentHash: hash,
            createdBy: "creator",
          },
        },
      },
    });
    return commission.id;
  }

  async function upload(
    commissionId: string,
    body: Buffer,
    mimeType = "image/png",
  ) {
    const ticket = await createDeliveryUpload({
      commissionId,
      filename: "final.png",
      mimeType,
      sizeBytes: body.length,
    });
    bucket.set(uploadKey(commissionId, ticket.uploadId), { body, mimeType });
    return ticket;
  }

  async function deliver(
    commissionId: string,
    body: Buffer,
    { isFinal = true, filename = "final.png" } = {},
  ) {
    const { uploadId } = await upload(commissionId, body);
    return recordDelivery({ commissionId, uploadId, filename, isFinal });
  }

  async function state(commissionId: string) {
    return (
      await db.commission.findUniqueOrThrow({ where: { id: commissionId } })
    ).state;
  }

  describe("createDeliveryUpload", () => {
    it("returns a direct-to-bucket PUT for the declared type", async () => {
      const id = await seed("in_progress");
      const ticket = await createDeliveryUpload({
        commissionId: id,
        filename: "mix.wav",
        mimeType: "audio/wav",
        sizeBytes: 10,
      });

      expect(ticket).toMatchObject({
        method: "PUT",
        headers: { "Content-Type": "audio/wav" },
        url: `https://bucket.test/deliveries/commissions/${id}/uploads/${ticket.uploadId}`,
      });
      expect(Date.parse(ticket.expiresAt)).toBeGreaterThan(Date.now());
    });

    it.each([
      "draft",
      "negotiating",
      "agreed",
      "dp_paid",
      "cancelled",
    ] as const)("refuses uploads while the commission is %s", async (from) => {
      const id = await seed(from);
      await expect(
        createDeliveryUpload({
          commissionId: id,
          filename: "a.png",
          mimeType: "image/png",
          sizeBytes: 1,
        }),
      ).rejects.toMatchObject({ code: "upload_not_allowed" });
    });

    it("hides other creators' commissions", async () => {
      const id = await seed("in_progress");
      await signIn();
      await expect(
        createDeliveryUpload({
          commissionId: id,
          filename: "a.png",
          mimeType: "image/png",
          sizeBytes: 1,
        }),
      ).rejects.toMatchObject({ code: "not_found" });
    });
  });

  describe("recordDelivery", () => {
    it("hashes the stored file and moves in_progress to delivered on the first delivery", async () => {
      const id = await seed("in_progress");
      const body = Buffer.from("first cut");
      const { uploadId } = await upload(id, body);

      const result = await recordDelivery({
        commissionId: id,
        uploadId,
        filename: "final.png",
        isFinal: false,
      });

      expect(result).toMatchObject({
        state: "delivered",
        failedEffects: [],
        delivery: {
          filename: "final.png",
          sha256: sha256(body),
          sizeBytes: body.length,
          mimeType: "image/png",
          isFinal: false,
        },
      });
      expect(await state(id)).toBe("delivered");
      expect(createBalanceInvoice).toHaveBeenCalledWith(id);

      const row = await db.delivery.findUniqueOrThrow({
        where: { id: result.delivery.id },
      });
      expect(row.storageKey).toMatch(
        new RegExp(`^commissions/${id}/deliveries/`),
      );
      expect(bucket.get(row.storageKey!)?.body.equals(body)).toBe(true);
      expect(bucket.has(uploadKey(id, uploadId))).toBe(false);

      const events = await db.commissionEvent.findMany({
        where: { commissionId: id },
      });
      expect(
        events
          .filter((e) => e.type === "transition")
          .map((e) => [e.fromState, e.toState, e.actor]),
      ).toEqual([["in_progress", "delivered", "creator"]]);

      const logged = events.find((e) => e.type === "delivery_logged");
      expect(logged?.actor).toBe("creator");
      expect(logged?.at.toISOString()).toBe(row.loggedAt.toISOString());
      expect(logged?.meta).toMatchObject({
        deliveryId: row.id,
        filename: "final.png",
        sha256: sha256(body),
        isFinal: false,
      });
    });

    it("logs each revision with its own event and shows the record to the client", async () => {
      const id = await seed("in_progress");
      const first = await deliver(id, Buffer.from("v1"), { isFinal: false });
      const second = await deliver(id, Buffer.from("v2"), {
        filename: "final-v2.png",
      });

      const logged = await db.commissionEvent.findMany({
        where: { commissionId: id, type: "delivery_logged" },
        orderBy: { at: "asc" },
      });
      expect(logged.map((e) => (e.meta as { sha256: string }).sha256)).toEqual([
        first.delivery.sha256,
        second.delivery.sha256,
      ]);

      // Before payment the client sees the record (hashes), not the files.
      const view = await getClientAgreement(token);
      expect(view?.state).toBe("delivered");
      expect(view?.finalFiles).toEqual([]);
      expect(view?.deliveryLog).toEqual([
        expect.objectContaining({
          filename: "final.png",
          sha256: sha256(Buffer.from("v1")),
          isFinal: false,
        }),
        expect.objectContaining({
          filename: "final-v2.png",
          sha256: sha256(Buffer.from("v2")),
          isFinal: true,
        }),
      ]);
    });

    it("records a revision as a new delivery and leaves the first one untouched", async () => {
      const id = await seed("in_progress");
      const first = await deliver(id, Buffer.from("v1"));
      const second = await deliver(id, Buffer.from("v2 with fixes"), {
        filename: "final-v2.png",
      });

      expect(second.state).toBe("delivered");
      expect(second.delivery.id).not.toBe(first.delivery.id);
      expect(second.delivery.sha256).toBe(sha256(Buffer.from("v2 with fixes")));
      expect(createBalanceInvoice).toHaveBeenCalledTimes(1);

      const rows = await db.delivery.findMany({
        where: { commissionId: id },
        orderBy: { loggedAt: "asc" },
      });
      expect(rows.map((r) => r.sha256)).toEqual([
        sha256(Buffer.from("v1")),
        sha256(Buffer.from("v2 with fixes")),
      ]);
      expect(rows[0].storageKey).not.toBe(rows[1].storageKey);
      expect(bucket.get(rows[0].storageKey!)?.body.toString()).toBe("v1");

      const transitions = await db.commissionEvent.count({
        where: { commissionId: id, type: "transition" },
      });
      expect(transitions).toBe(1);
    });

    it("never lets a delivered file be deleted or replaced", async () => {
      const id = await seed("in_progress");
      const { delivery } = await deliver(id, Buffer.from("v1"));

      await expect(
        db.delivery.update({
          where: { id: delivery.id },
          data: { sha256: "0".repeat(64) },
        }),
      ).rejects.toThrow(/append-only/);
      await expect(
        db.delivery.delete({ where: { id: delivery.id } }),
      ).rejects.toThrow(/append-only/);

      const row = await db.delivery.findUniqueOrThrow({
        where: { id: delivery.id },
      });
      await expect(
        db.delivery.create({
          data: {
            commissionId: id,
            filename: "swap.png",
            sha256: "0".repeat(64),
            sizeBytes: 1,
            mimeType: "image/png",
            storageKey: row.storageKey,
          },
        }),
      ).rejects.toThrow();
    });

    it("re-uploading to a used upload id doesn't change the delivered file", async () => {
      const id = await seed("in_progress");
      const { uploadId } = await upload(id, Buffer.from("v1"));
      const { delivery } = await recordDelivery({
        commissionId: id,
        uploadId,
        filename: "final.png",
        isFinal: true,
      });

      bucket.set(uploadKey(id, uploadId), {
        body: Buffer.from("swapped"),
        mimeType: "image/png",
      });
      await recordDelivery({
        commissionId: id,
        uploadId,
        filename: "final.png",
        isFinal: true,
      });

      const row = await db.delivery.findUniqueOrThrow({
        where: { id: delivery.id },
      });
      expect(row.sha256).toBe(sha256(Buffer.from("v1")));
      expect(bucket.get(row.storageKey!)?.body.toString()).toBe("v1");
    });

    it("keeps accepting deliveries after delivered and fully_paid", async () => {
      for (const from of ["delivered", "fully_paid"] as const) {
        const id = await seed(from, `${from[0]}`.repeat(22));
        const result = await deliver(id, Buffer.from(from));
        expect(result.state).toBe(from);
      }
      expect(createBalanceInvoice).not.toHaveBeenCalled();
    });

    it("refuses an upload that never reached the bucket", async () => {
      const id = await seed("in_progress");
      await expect(
        recordDelivery({
          commissionId: id,
          uploadId: crypto.randomUUID(),
          filename: "final.png",
          isFinal: true,
        }),
      ).rejects.toMatchObject({ code: "invalid_upload" });
      expect(await state(id)).toBe("in_progress");
    });

    it("rechecks size and type on the stored file and cleans up", async () => {
      const id = await seed("in_progress");
      const bad = [
        { body: Buffer.alloc(0), mimeType: "image/png" },
        { body: Buffer.from("<html>"), mimeType: "text/html" },
      ];
      for (const object of bad) {
        const { uploadId } = await upload(id, Buffer.from("x"));
        bucket.set(uploadKey(id, uploadId), object);
        await expect(
          recordDelivery({
            commissionId: id,
            uploadId,
            filename: "final.png",
            isFinal: true,
          }),
        ).rejects.toMatchObject({ code: "invalid_upload" });
      }

      expect(await db.delivery.count()).toBe(0);
      expect(await state(id)).toBe("in_progress");
      expect(
        [...bucket.keys()].filter((k) => k.includes("/deliveries/")),
      ).toEqual([]);
    });

    it("maps an oversized stored file to invalid_upload", async () => {
      const id = await seed("in_progress");
      const { uploadId } = await upload(id, Buffer.from("x"));
      const storage = await import("@/lib/storage/deliveries");
      const files = storage.getDeliveryStorage()!;
      const inspect = vi
        .spyOn(files, "inspect")
        .mockRejectedValueOnce(new StoredFileTooLargeError());

      await expect(
        recordDelivery({
          commissionId: id,
          uploadId,
          filename: "final.png",
          isFinal: true,
        }),
      ).rejects.toMatchObject({
        code: "invalid_upload",
        message: "Files can be at most 25 MB.",
      });
      inspect.mockRestore();
    });

    it("hides other creators' commissions", async () => {
      const id = await seed("in_progress");
      const { uploadId } = await upload(id, Buffer.from("x"));
      await signIn();
      await expect(
        recordDelivery({
          commissionId: id,
          uploadId,
          filename: "final.png",
          isFinal: true,
        }),
      ).rejects.toMatchObject({ code: "not_found" });
      expect(await db.delivery.count()).toBe(0);
    });
  });

  describe("requestDeliveryDownload", () => {
    async function finalFile(commissionState: CommissionState) {
      const id = await seed("in_progress");
      const { delivery } = await deliver(id, Buffer.from("final art"));
      await db.commission.update({
        where: { id },
        data: { state: commissionState },
      });
      return { id, deliveryId: delivery.id };
    }

    it.each(["in_progress", "delivered", "cancelled"] as const)(
      "refuses the download while the commission is %s and logs nothing",
      async (commissionState) => {
        const { deliveryId } = await finalFile(commissionState);
        await expect(
          requestDeliveryDownload({ token, deliveryId, userAgent: "UA" }),
        ).rejects.toMatchObject({ code: "download_not_allowed" });
        expect(await db.deliveryDownload.count()).toBe(0);
      },
    );

    it("returns a signed link after fully_paid and logs every download", async () => {
      const { id, deliveryId } = await finalFile("fully_paid");

      const first = await requestDeliveryDownload({
        token,
        deliveryId,
        userAgent: "Mozilla/5.0 test",
      });
      await requestDeliveryDownload({ token, deliveryId, userAgent: null });

      expect(first).toMatchObject({ commissionId: id, filename: "final.png" });
      expect(first.url).toContain(`commissions/${id}/deliveries/`);

      const log = await db.deliveryDownload.findMany({
        orderBy: { requestedAt: "asc" },
      });
      expect(
        log.map((d) => [d.deliveryId, d.commissionId, d.userAgent]),
      ).toEqual([
        [deliveryId, id, "Mozilla/5.0 test"],
        [deliveryId, id, null],
      ]);
    });

    it("keeps the download log append-only", async () => {
      const { deliveryId } = await finalFile("fully_paid");
      await requestDeliveryDownload({ token, deliveryId, userAgent: "UA" });
      const [row] = await db.deliveryDownload.findMany();

      await expect(
        db.deliveryDownload.update({
          where: { id: row.id },
          data: { userAgent: "edited" },
        }),
      ).rejects.toThrow(/append-only/);
      await expect(
        db.deliveryDownload.delete({ where: { id: row.id } }),
      ).rejects.toThrow(/append-only/);
    });

    it("serves preview files before full payment and blocks files from other commissions", async () => {
      const { id } = await finalFile("delivered");
      const preview = await db.delivery.create({
        data: {
          commissionId: id,
          filename: "preview.png",
          sha256: "0".repeat(64),
          sizeBytes: 1,
          mimeType: "image/png",
          storageKey: `commissions/${id}/deliveries/preview`,
          isFinal: false,
        },
      });
      const other = await seed("fully_paid", "O".repeat(22));
      const { delivery: otherFile } = await deliver(other, Buffer.from("x"));

      const previewDownload = await requestDeliveryDownload({
        token,
        deliveryId: preview.id,
        userAgent: "Preview UA",
      });
      expect(previewDownload).toMatchObject({
        commissionId: id,
        filename: "preview.png",
      });
      expect(await db.deliveryDownload.count()).toBe(1);

      await expect(
        requestDeliveryDownload({
          token,
          deliveryId: otherFile.id,
          userAgent: null,
        }),
      ).rejects.toMatchObject({ code: "not_found" });
      await expect(
        requestDeliveryDownload({
          token: "Z".repeat(22),
          deliveryId: preview.id,
          userAgent: null,
        }),
      ).rejects.toMatchObject({ code: "not_found" });
      expect(await db.deliveryDownload.count()).toBe(1);
    });
  });
});
