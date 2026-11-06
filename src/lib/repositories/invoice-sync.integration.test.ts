import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createMockPayPalClient } from "@/lib/paypal/mock";
import { contentHash } from "@/lib/schema/content-hash";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import {
  refreshPayments,
  resetRefreshThrottle,
  syncCommissionInvoices,
} from "./invoice-sync-repository";
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

describe.skipIf(!url)("payment polling fallback (database)", () => {
  const paypal = createMockPayPalClient();

  afterAll(() => db.$disconnect());

  beforeEach(async () => {
    paypal.reset();
    resetRefreshThrottle();
    await db.$executeRawUnsafe(
      "TRUNCATE creators, commissions, agreement_versions, confirmations, invoices, deliveries, commission_events, change_requests, rate_cards, webhook_events RESTART IDENTITY CASCADE",
    );
  });

  /** An agreed commission with a sent deposit invoice that also exists in the mock. */
  async function addAgreement(commissionId: string) {
    await db.agreementVersion.create({
      data: {
        commissionId,
        version: 1,
        content: toJson(exampleAgreement),
        contentHash: contentHash(exampleAgreement),
        createdBy: "creator",
      },
    });
  }

  async function agreedWithSentDeposit({ withAgreement = true } = {}) {
    const creator = await db.creator.create({
      data: {
        authUserId: crypto.randomUUID(),
        email: `${crypto.randomUUID()}@test.dev`,
        displayName: "Test Creator",
      },
    });
    const commission = await db.commission.create({
      data: { creatorId: creator.id, state: "agreed", sourceDm: "dm" },
    });
    if (withAgreement) await addAgreement(commission.id);
    const draft = await paypal.createInvoice({
      commissionId: commission.id,
      kind: "deposit",
      invoicerEmail: "creator@business.example.com",
      recipientEmail: "ren@example.com",
      currency: "USD",
      amount: "75.00",
      itemName: "Deposit",
      dueDate: "2026-11-08",
    });
    await paypal.sendInvoice(draft.id);
    await db.invoice.create({
      data: {
        commissionId: commission.id,
        kind: "deposit",
        status: "sent",
        paypalInvoiceId: draft.id,
        amount: "75.00",
        currency: "USD",
      },
    });
    return { commissionId: commission.id, paypalInvoiceId: draft.id };
  }

  const stateOf = async (id: string) =>
    (await db.commission.findUniqueOrThrow({ where: { id } })).state;

  it("leaves unpaid invoices alone", async () => {
    const { commissionId } = await agreedWithSentDeposit();
    const result = await syncCommissionInvoices(commissionId, { paypal });

    expect(result).toEqual({ checked: 1, changed: 0 });
    expect(await stateOf(commissionId)).toBe("agreed");
  });

  it("applies a payment the webhook missed, exactly once", async () => {
    const { commissionId, paypalInvoiceId } = await agreedWithSentDeposit();
    paypal.markPaid(paypalInvoiceId);

    expect(await syncCommissionInvoices(commissionId, { paypal })).toEqual({
      checked: 1,
      changed: 1,
    });
    expect(await stateOf(commissionId)).toBe("dp_paid");

    // The invoice is no longer "sent", so a second check does nothing.
    expect(await syncCommissionInvoices(commissionId, { paypal })).toEqual({
      checked: 0,
      changed: 0,
    });
    const events = await db.commissionEvent.findMany({
      where: { commissionId },
    });
    expect(events.filter((e) => e.toState === "dp_paid")).toHaveLength(1);
    expect(events.find((e) => e.type === "invoice_paid")?.meta).toMatchObject({
      via: "polling",
    });
  });

  it("keeps the invoice sent when the state change fails, so a later check retries", async () => {
    const { commissionId, paypalInvoiceId } = await agreedWithSentDeposit({
      withAgreement: false,
    });
    paypal.markPaid(paypalInvoiceId);

    await expect(
      syncCommissionInvoices(commissionId, { paypal }),
    ).rejects.toThrow();
    const invoice = await db.invoice.findFirstOrThrow({
      where: { commissionId },
    });
    expect(invoice.status).toBe("sent");
    expect(
      await db.commissionEvent.count({
        where: { commissionId, type: "invoice_paid" },
      }),
    ).toBe(0);

    await addAgreement(commissionId);
    expect(await syncCommissionInvoices(commissionId, { paypal })).toEqual({
      checked: 1,
      changed: 1,
    });
    expect(await stateOf(commissionId)).toBe("dp_paid");
  });

  it("only checks invoices sent 10+ minutes ago in the background", async () => {
    const { commissionId, paypalInvoiceId } = await agreedWithSentDeposit();
    paypal.markPaid(paypalInvoiceId);

    const fresh = await refreshPayments(commissionId, "background", { paypal });
    expect(fresh).toMatchObject({ checked: 0, throttled: false });

    resetRefreshThrottle();
    const later = await refreshPayments(commissionId, "background", {
      paypal,
      now: Date.now() + 11 * 60_000,
    });
    expect(later).toMatchObject({ checked: 1, changed: 1 });
    expect(await stateOf(commissionId)).toBe("dp_paid");
  });

  it("throttles repeated manual refreshes", async () => {
    const { commissionId } = await agreedWithSentDeposit();
    const now = Date.now();

    await refreshPayments(commissionId, "manual", { paypal, now });
    const again = await refreshPayments(commissionId, "manual", {
      paypal,
      now: now + 1_000,
    });
    expect(again.throttled).toBe(true);
  });
});
