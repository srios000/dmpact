import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentCreator } from "@/lib/auth/get-current-creator";
import { db } from "@/lib/db";
import type { Agreement } from "@/lib/schema/agreement";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import {
  confirmAgreement,
  getClientAgreement,
  requestChanges,
  saveAgreementVersion,
} from "./agreement-repository";
import {
  createCommission,
  getCommission,
  getCommissionStatus,
  listCommissions,
  sendToClient,
  transitionCommission,
} from "./commission-repository";

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

const baseAgreement = {
  ...exampleAgreement,
  parties: {
    client: {
      display_name: "Ren",
      handle: "@ren_ch",
      email: "ren@example.com",
    },
  },
};

const url = process.env.TEST_DATABASE_URL;

const blocker: Agreement["ambiguities"][number] = {
  code: "SCOPE_UNCLEAR",
  severity: "blocker",
  field: "/deliverables",
  message: "Scope is unclear.",
};

const laterDeadline = {
  date: "2099-01-01",
  raw_text: null,
  is_relative: false,
};

describe.skipIf(!url)("commission flow (database)", () => {
  afterAll(() => db.$disconnect());

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

  async function asClient<T>(run: () => Promise<T>): Promise<T> {
    const resolved = await getCurrentCreator();
    vi.mocked(getCurrentCreator).mockResolvedValue(null);
    try {
      return await run();
    } finally {
      vi.mocked(getCurrentCreator).mockResolvedValue(resolved);
    }
  }

  async function sent(agreement: Agreement = baseAgreement) {
    const created = await createCommission({ sourceDm: "dm", agreement });
    const { token } = await sendToClient({
      commissionId: created.id,
      versionHash: created.contentHash,
    });
    return { ...created, token };
  }

  async function approved(agreement: Agreement = baseAgreement) {
    const commission = await sent(agreement);
    await asClient(() =>
      confirmAgreement({
        token: commission.token,
        versionHash: commission.contentHash,
      }),
    );
    return commission;
  }

  beforeEach(async () => {
    await signIn();
  });

  it("computes money on the server when creating", async () => {
    const { id } = await createCommission({
      sourceDm: "dm",
      agreement: {
        ...baseAgreement,
        deposit: {
          type: "percent",
          percent: 50,
          fixed_amount: null,
          amount: "1.00",
        },
        balance_amount: "1.00",
      },
    });

    const commission = await getCommission(id);
    expect(commission?.state).toBe("draft");
    expect(commission?.versions[0].agreement.deposit.amount).toBe("75.00");
    expect(commission?.versions[0].agreement.balance_amount).toBe("75.00");
  });

  it("requires a session and hides other creators' commissions", async () => {
    const { id, contentHash } = await createCommission({
      sourceDm: "dm",
      agreement: baseAgreement,
    });

    await signIn();
    expect(await getCommission(id)).toBeNull();
    expect(await listCommissions()).toEqual([]);
    expect(await getCommissionStatus(id, null)).toBeNull();
    await expect(
      saveAgreementVersion({ commissionId: id, agreement: baseAgreement }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      sendToClient({ commissionId: id, versionHash: contentHash }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      transitionCommission({ commissionId: id, to: "cancelled" }),
    ).rejects.toMatchObject({ code: "not_found" });

    vi.mocked(getCurrentCreator).mockResolvedValue(null);
    await expect(listCommissions()).rejects.toMatchObject({
      code: "unauthorized",
    });
    expect(await getCommissionStatus(id, null)).toBeNull();
  });

  it("keeps a commission with blockers in draft and leaves no trace", async () => {
    const { id, contentHash } = await createCommission({
      sourceDm: "dm",
      agreement: { ...baseAgreement, ambiguities: [blocker] },
    });

    await expect(
      sendToClient({ commissionId: id, versionHash: contentHash }),
    ).rejects.toMatchObject({ code: "guard_failed" });

    const commission = await getCommission(id);
    expect(commission?.state).toBe("draft");
    expect(commission?.clientToken).toBeNull();
    expect(commission?.versions[0].confirmations).toEqual([]);
  });

  it("refuses to send a version the creator hasn't seen", async () => {
    const { id, contentHash } = await createCommission({
      sourceDm: "dm",
      agreement: baseAgreement,
    });
    await saveAgreementVersion({
      commissionId: id,
      agreement: { ...baseAgreement, title: "Newer" },
    });

    await expect(
      sendToClient({ commissionId: id, versionHash: contentHash }),
    ).rejects.toMatchObject({ code: "stale_version" });
  });

  it("generates a token that only opens the client view", async () => {
    const { id, token } = await sent();
    const other = await sent();
    const unknown = randomBytes(16).toString("base64url");

    expect(Buffer.from(token, "base64url")).toHaveLength(16);
    expect(other.token).not.toBe(token);
    expect(await getClientAgreement(unknown)).toBeNull();
    expect(await getCommissionStatus(id, unknown)).toBeNull();
    expect(await getCommissionStatus(other.id, token)).toBeNull();

    vi.mocked(getCurrentCreator).mockResolvedValue(null);
    expect(await getCommissionStatus(id, null)).toBeNull();
    expect(await getCommissionStatus(id, token)).not.toBeNull();

    const view = await getClientAgreement(token);
    expect(view?.state).toBe("negotiating");
    expect(view?.creatorName).toBe("Test Creator");
    expect(view?.awaitingClient).toBe(true);
    expect(view?.agreement).not.toHaveProperty("ambiguities");
    expect(view?.agreement).not.toHaveProperty("extraction");
    expect(view?.agreement).not.toHaveProperty("notes");
    expect(view).not.toHaveProperty("sourceDm");
  });

  it("blocks the owning creator from confirming or requesting changes on the client link", async () => {
    const { id, token, contentHash } = await sent();

    const creatorView = await getClientAgreement(token);
    expect(creatorView?.isCreator).toBe(true);

    await expect(
      confirmAgreement({ token, versionHash: contentHash }),
    ).rejects.toMatchObject({ code: "edit_not_allowed" });
    await expect(
      requestChanges({ token, message: "Creator pretending to be client" }),
    ).rejects.toMatchObject({ code: "edit_not_allowed" });

    const commission = await getCommission(id);
    expect(commission?.state).toBe("negotiating");
    expect(commission?.changeRequests).toEqual([]);
  });

  it("binds the client's confirmation to the version hash", async () => {
    const { id, token, contentHash } = await sent();
    const newer = await saveAgreementVersion({
      commissionId: id,
      agreement: { ...baseAgreement, title: "Newer" },
    });

    await expect(
      asClient(() => confirmAgreement({ token, versionHash: contentHash })),
    ).rejects.toMatchObject({ code: "stale_version" });
    expect((await getCommission(id))?.state).toBe("negotiating");

    const result = await asClient(() =>
      confirmAgreement({
        token,
        versionHash: newer.contentHash,
      }),
    );
    expect(result.state).toBe("agreed");

    const again = await asClient(() =>
      confirmAgreement({
        token,
        versionHash: newer.contentHash,
      }),
    );
    expect(again.state).toBe("agreed");

    const commission = await getCommission(id);
    expect(commission?.versions[1].confirmations).toHaveLength(2);
    expect(commission?.inForceVersion).toBe(2);
  });

  it("refuses to agree on a deposit without the client's email", async () => {
    const { id, token, contentHash } = await sent(exampleAgreement);

    await expect(
      asClient(() => confirmAgreement({ token, versionHash: contentHash })),
    ).rejects.toMatchObject({ code: "guard_failed" });

    const commission = await getCommission(id);
    expect(commission?.state).toBe("negotiating");
    expect(
      commission?.versions[0].confirmations.filter((c) => c.party === "client"),
    ).toHaveLength(0);
  });

  it("stores change requests and stays in negotiating", async () => {
    const { id, token } = await sent();

    await asClient(() =>
      requestChanges({ token, message: "Please add stems." }),
    );

    const commission = await getCommission(id);
    expect(commission?.state).toBe("negotiating");
    expect(commission?.changeRequests).toMatchObject([
      { version: 1, message: "Please add stems." },
    ]);
  });

  it("only lets the deadline change after approval", async () => {
    const { id } = await approved();

    await expect(
      saveAgreementVersion({
        commissionId: id,
        agreement: {
          ...baseAgreement,
          price: { total: "1.00", currency: "USD" },
        },
      }),
    ).rejects.toMatchObject({ code: "edit_not_allowed" });
    expect((await getCommission(id))?.versions).toHaveLength(1);
  });

  it("keeps the previous version in force until re-confirmed", async () => {
    const { id, token } = await approved();

    const changed = await saveAgreementVersion({
      commissionId: id,
      agreement: { ...baseAgreement, deadline: laterDeadline },
    });

    const pending = await getCommission(id);
    expect(pending?.state).toBe("agreed");
    expect(pending?.inForceVersion).toBe(1);
    expect(pending?.awaitingClient).toBe(true);

    const view = await getClientAgreement(token);
    expect(view?.awaitingClient).toBe(true);
    expect(view?.deadlineInForce?.date).toBe(baseAgreement.deadline.date);
    expect(view?.agreement.deadline.date).toBe(laterDeadline.date);
    expect((await getCommissionStatus(id, token))?.awaitingClient).toBe(true);

    const result = await asClient(() =>
      confirmAgreement({
        token,
        versionHash: changed.contentHash,
      }),
    );
    expect(result.state).toBe("agreed");

    const done = await getCommission(id);
    expect(done?.state).toBe("agreed");
    expect(done?.inForceVersion).toBe(2);
    expect(done?.awaitingClient).toBe(false);
    expect(done?.events.filter((e) => e.toState === "agreed")).toHaveLength(1);
  });

  it("blocks edits and confirmations after delivery", async () => {
    const { id, token } = await approved({
      ...baseAgreement,
      deposit: { type: "none", percent: null, fixed_amount: null },
    });
    const changed = await saveAgreementVersion({
      commissionId: id,
      agreement: {
        ...baseAgreement,
        deposit: { type: "none", percent: null, fixed_amount: null },
        deadline: laterDeadline,
      },
    });
    await transitionCommission({ commissionId: id, to: "in_progress" });
    await db.delivery.create({
      data: {
        commissionId: id,
        filename: "mix.wav",
        sha256: "a".repeat(64),
        sizeBytes: 10,
        mimeType: "audio/wav",
      },
    });
    await transitionCommission({ commissionId: id, to: "delivered" });

    await expect(
      saveAgreementVersion({
        commissionId: id,
        agreement: { ...baseAgreement, deadline: laterDeadline },
      }),
    ).rejects.toMatchObject({ code: "edit_not_allowed" });
    await expect(
      asClient(() =>
        confirmAgreement({ token, versionHash: changed.contentHash }),
      ),
    ).rejects.toMatchObject({ code: "edit_not_allowed" });
    await expect(
      asClient(() => requestChanges({ token, message: "Too late" })),
    ).rejects.toMatchObject({ code: "edit_not_allowed" });
  });

  it("links follow-up DMs to the version they produced", async () => {
    const { id } = await createCommission({
      sourceDm: "original",
      agreement: baseAgreement,
    });

    await saveAgreementVersion({
      commissionId: id,
      agreement: { ...baseAgreement, title: "From follow-up" },
      followUpDm: "actually make it two songs",
    });

    const commission = await getCommission(id);
    expect(commission?.sourceDm).toBe("original");
    expect(commission?.followUpDms).toMatchObject([
      {
        agreementVersionId: commission?.versions[1].id,
        message: "actually make it two songs",
      },
    ]);
  });

  it("keeps the original DM and follow-up DMs immutable", async () => {
    const { id } = await createCommission({
      sourceDm: "original",
      agreement: baseAgreement,
    });
    await saveAgreementVersion({
      commissionId: id,
      agreement: { ...baseAgreement, title: "From follow-up" },
      followUpDm: "follow-up",
    });

    await expect(
      db.commission.update({ where: { id }, data: { sourceDm: "edited" } }),
    ).rejects.toThrow();
    await expect(
      db.followUpDm.updateMany({
        where: { commissionId: id },
        data: { message: "edited" },
      }),
    ).rejects.toThrow();
    await expect(
      db.followUpDm.deleteMany({ where: { commissionId: id } }),
    ).rejects.toThrow();
  });

  it("reports state and payment status for polling", async () => {
    const { id, token } = await approved();
    await db.invoice.create({
      data: {
        commissionId: id,
        kind: "deposit",
        status: "sent",
        amount: "75.00",
        currency: "USD",
        payLink: "https://example.test/pay",
      },
    });

    expect(await getCommissionStatus(id, token)).toMatchObject({
      state: "agreed",
      awaitingClient: false,
      deposit: { status: "sent", payLink: "https://example.test/pay" },
      balance: { status: "not_created" },
    });
    expect((await getCommission(id))?.invoices[0].amount).toBe("75.00");
  });

  it("marks a skipped deposit as not required", async () => {
    const { id, token } = await approved({
      ...baseAgreement,
      deposit: { type: "none", percent: null, fixed_amount: null },
    });

    expect((await getCommissionStatus(id, token))?.deposit.status).toBe(
      "not_required",
    );
  });
});
