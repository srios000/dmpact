import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentCreator } from "@/lib/auth/get-current-creator";
import { db } from "@/lib/db";
import { createMockPayPalClient } from "@/lib/paypal/mock";
import { contentHash } from "@/lib/schema/content-hash";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import {
  listCommissionDisputes,
  sendDisputeEvidence,
} from "./dispute-repository";
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

describe.skipIf(!url)("PayPal disputes (database)", () => {
  const paypal = createMockPayPalClient();

  afterAll(() => db.$disconnect());

  beforeEach(async () => {
    paypal.reset();
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

  /** A fully paid commission whose balance invoice was paid in the mock. */
  async function paidCommission() {
    const creator = await signIn();
    const commission = await db.commission.create({
      data: {
        creatorId: creator.id,
        state: "fully_paid",
        sourceDm: "can u mix my song?",
      },
    });
    const hash = contentHash(exampleAgreement);
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
    const draft = await paypal.createInvoice({
      commissionId: commission.id,
      kind: "balance",
      invoicerEmail: "creator@business.example.com",
      recipientEmail: "ren@example.com",
      currency: "USD",
      amount: "75.00",
      itemName: "Balance",
      dueDate: "2026-11-20",
    });
    await paypal.sendInvoice(draft.id);
    paypal.markPaid(draft.id);
    await db.invoice.create({
      data: {
        commissionId: commission.id,
        kind: "balance",
        status: "paid",
        paypalInvoiceId: draft.id,
        amount: "75.00",
        currency: "USD",
      },
    });
    return { commissionId: commission.id, paypalInvoiceId: draft.id };
  }

  it("finds no disputes when the client hasn't opened one", async () => {
    const { commissionId } = await paidCommission();
    expect(await listCommissionDisputes(commissionId, { paypal })).toEqual([]);
  });

  it("matches a dispute to the commission through the payment", async () => {
    const { commissionId, paypalInvoiceId } = await paidCommission();
    const opened = paypal.openDispute(paypalInvoiceId);

    const disputes = await listCommissionDisputes(commissionId, { paypal });
    expect(disputes).toEqual([
      expect.objectContaining({
        id: opened.id,
        invoiceKind: "balance",
        transactionId: `MOCKTX-${paypalInvoiceId}`,
        canProvideEvidence: true,
      }),
    ]);
  });

  it("sends the evidence pack and logs it", async () => {
    const { commissionId, paypalInvoiceId } = await paidCommission();
    const opened = paypal.openDispute(paypalInvoiceId);

    const result = await sendDisputeEvidence(commissionId, opened.id, {
      paypal,
    });

    expect(result.canProvideEvidence).toBe(false);
    expect(paypal.evidence).toEqual([
      expect.objectContaining({
        disputeId: opened.id,
        filename: `dmpact-evidence-${commissionId.slice(-12)}.pdf`,
      }),
    ]);
    const event = await db.commissionEvent.findFirst({
      where: { commissionId, type: "dispute_evidence_sent" },
    });
    expect(event?.meta).toMatchObject({ disputeId: opened.id });
  });

  it("refuses when PayPal isn't waiting for the seller", async () => {
    const { commissionId, paypalInvoiceId } = await paidCommission();
    const opened = paypal.openDispute(paypalInvoiceId, "UNDER_REVIEW");

    await expect(
      sendDisputeEvidence(commissionId, opened.id, { paypal }),
    ).rejects.toMatchObject({ code: "retry_not_allowed" });
    expect(paypal.evidence).toHaveLength(0);
  });

  it("refuses disputes that belong to another commission", async () => {
    const { commissionId } = await paidCommission();
    const other = await paidCommission();
    const foreign = paypal.openDispute(other.paypalInvoiceId);

    // paidCommission() signed in the second creator; switch back.
    const owner = await db.commission.findUniqueOrThrow({
      where: { id: commissionId },
      include: { creator: true },
    });
    vi.mocked(getCurrentCreator).mockResolvedValue({
      id: owner.creator.id,
      email: owner.creator.email,
      displayName: owner.creator.displayName,
      paypalEmail: null,
    });

    await expect(
      sendDisputeEvidence(commissionId, foreign.id, { paypal }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
