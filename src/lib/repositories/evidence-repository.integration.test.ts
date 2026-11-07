import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentCreator } from "@/lib/auth/get-current-creator";
import { db } from "@/lib/db";
import { renderEvidencePdf } from "@/lib/evidence/evidence-pdf";
import { contentHash } from "@/lib/schema/content-hash";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import { getEvidencePack } from "./evidence-repository";
import { toJson } from "./shared";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/get-current-creator", () => ({
  getCurrentCreator: vi.fn(),
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

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("getEvidencePack (database)", () => {
  afterAll(() => db.$disconnect());

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      "TRUNCATE creators, commissions, agreement_versions, confirmations, invoices, deliveries, delivery_downloads, commission_events, change_requests, rate_cards, follow_up_dms, webhook_events RESTART IDENTITY CASCADE",
    );
  });

  async function signIn(name = "Mira Sound") {
    const creator = await db.creator.create({
      data: {
        authUserId: crypto.randomUUID(),
        email: `${crypto.randomUUID()}@test.dev`,
        displayName: name,
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

  /** A fully paid commission with one delivery the client downloaded. */
  async function seed() {
    const creator = await signIn();
    const hash = contentHash(exampleAgreement);
    const commission = await db.commission.create({
      data: {
        creatorId: creator.id,
        state: "fully_paid",
        sourceDm: "can u mix my song?",
      },
    });
    const version = await db.agreementVersion.create({
      data: {
        commissionId: commission.id,
        version: 1,
        content: toJson(exampleAgreement),
        contentHash: hash,
        createdBy: "creator",
      },
    });
    for (const party of ["creator", "client"] as const) {
      await db.confirmation.create({
        data: {
          commissionId: commission.id,
          agreementVersionId: version.id,
          party,
          contentHash: hash,
        },
      });
    }
    await db.invoice.create({
      data: {
        commissionId: commission.id,
        kind: "deposit",
        status: "paid",
        paypalInvoiceId: "INV2-TEST",
        amount: "75.00",
        currency: "USD",
        dueDate: new Date("2026-11-06T00:00:00Z"),
        paidAt: new Date("2026-11-03T06:01:00Z"),
      },
    });
    const delivery = await db.delivery.create({
      data: {
        commissionId: commission.id,
        filename: "final.zip",
        sha256: "b".repeat(64),
        sizeBytes: 1000,
        mimeType: "application/zip",
        isFinal: true,
      },
    });
    await db.deliveryDownload.create({
      data: {
        commissionId: commission.id,
        deliveryId: delivery.id,
        userAgent: "Chrome",
      },
    });
    await db.commissionEvent.create({
      data: {
        commissionId: commission.id,
        type: "transition",
        actor: "paypal",
        fromState: "delivered",
        toState: "fully_paid",
      },
    });
    return { commissionId: commission.id, hash };
  }

  it("collects every section and renders a PDF", async () => {
    const { commissionId, hash } = await seed();
    const pack = await getEvidencePack(
      commissionId,
      new Date("2026-11-20T09:15:00Z"),
    );

    expect(pack.generatedAt).toBe("2026-11-20T09:15:00.000Z");
    expect(pack.commission).toMatchObject({
      id: commissionId,
      state: "fully_paid",
      creatorName: "Mira Sound",
    });
    expect(pack.agreement).toMatchObject({
      version: 1,
      contentHash: hash,
      confirmedByBoth: true,
    });
    expect(pack.confirmations.map((c) => c.party).sort()).toEqual([
      "client",
      "creator",
    ]);
    expect(pack.invoices).toEqual([
      expect.objectContaining({
        kind: "deposit",
        status: "paid",
        paypalInvoiceId: "INV2-TEST",
        amount: "75.00",
        dueDate: "2026-11-06",
        paidAt: "2026-11-03T06:01:00.000Z",
      }),
    ]);
    // Upload and receipt evidence stay separate.
    expect(pack.deliveries).toEqual([
      expect.objectContaining({ filename: "final.zip", isFinal: true }),
    ]);
    expect(pack.downloads).toEqual([
      expect.objectContaining({
        filename: "final.zip",
        sha256: "b".repeat(64),
        userAgent: "Chrome",
      }),
    ]);
    expect(pack.events).toEqual([
      expect.objectContaining({ toState: "fully_paid", actor: "paypal" }),
    ]);
    expect(pack.sourceDm).toBe("can u mix my song?");

    const pdf = await renderEvidencePdf(pack);
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("refuses other creators' commissions", async () => {
    const { commissionId } = await seed();
    await signIn("Someone else");

    await expect(getEvidencePack(commissionId)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
