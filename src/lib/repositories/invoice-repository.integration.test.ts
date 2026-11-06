import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentCreator } from "@/lib/auth/get-current-creator";
import { db } from "@/lib/db";
import { createMockPayPalClient } from "@/lib/paypal/mock";
import type { Agreement } from "@/lib/schema/agreement";
import { contentHash } from "@/lib/schema/content-hash";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import {
  getCommission,
  listCommissions,
  retryDepositInvoice,
} from "./commission-repository";
import { issueBalanceInvoice, issueDepositInvoice } from "./invoice-repository";
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

const agreement: Agreement = {
  ...exampleAgreement,
  parties: {
    client: {
      display_name: "Ren",
      handle: "@ren_ch",
      email: "ren@example.com",
    },
  },
};

const options = {
  appBaseUrl: "https://dmpact.test",
  today: "2026-11-05",
};

describe.skipIf(!url)("issueDepositInvoice (database)", () => {
  const paypal = createMockPayPalClient();

  afterAll(() => db.$disconnect());

  beforeEach(async () => {
    paypal.reset();
    await db.$executeRawUnsafe(
      "TRUNCATE creators, commissions, agreement_versions, confirmations, invoices, deliveries, commission_events, change_requests, rate_cards RESTART IDENTITY CASCADE",
    );
  });

  /** An agreed commission whose agreement both parties confirmed. */
  async function agreed(
    content: Agreement = agreement,
    clientToken = "token-for-tests",
    state: "agreed" | "delivered" = "agreed",
  ) {
    const creator = await db.creator.create({
      data: {
        authUserId: crypto.randomUUID(),
        email: `${crypto.randomUUID()}@test.dev`,
        displayName: "Test Creator",
        paypalEmail: "creator@business.example.com",
      },
    });
    vi.mocked(getCurrentCreator).mockResolvedValue({
      id: creator.id,
      email: creator.email,
      displayName: creator.displayName,
      paypalEmail: creator.paypalEmail,
    });
    const commission = await db.commission.create({
      data: {
        creatorId: creator.id,
        state,
        sourceDm: "dm",
        clientToken,
      },
    });
    const hash = contentHash(content);
    const version = await db.agreementVersion.create({
      data: {
        commissionId: commission.id,
        version: 1,
        content: toJson(content),
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
    return commission.id;
  }

  it("creates, sends and stores the deposit invoice", async () => {
    const id = await agreed();
    const result = await issueDepositInvoice(id, { ...options, paypal });

    expect(result).toMatchObject({ status: "sent" });
    const [row] = await db.invoice.findMany({ where: { commissionId: id } });
    expect(row).toMatchObject({
      kind: "deposit",
      status: "sent",
      currency: "USD",
      paypalInvoiceId: "INV2-MOCK-0001",
    });
    expect(row.amount.toFixed(2)).toBe("75.00");
    expect(row.dueDate?.toISOString().slice(0, 10)).toBe("2026-11-08");
    expect(row.payLink).toContain("INV2-MOCK-0001");

    const [created] = paypal.all();
    expect(created.invoiceNumber).toBe(
      `CD-${id.replace(/-/g, "").toUpperCase().slice(-15)}-DP`,
    );
    expect(created.raw.detail).toMatchObject({
      note: expect.stringContaining("https://dmpact.test/a/token-for-tests"),
    });

    const events = await db.commissionEvent.findMany({
      where: { commissionId: id, type: "invoice_sent" },
    });
    expect(events).toHaveLength(1);
  });

  it("never creates a second invoice when called again", async () => {
    const id = await agreed();
    await issueDepositInvoice(id, { ...options, paypal });
    const again = await issueDepositInvoice(id, { ...options, paypal });

    expect(again.status).toBe("exists");
    expect(await db.invoice.count({ where: { commissionId: id } })).toBe(1);
    expect(paypal.all()).toHaveLength(1);
  });

  it("skips commissions without a deposit", async () => {
    const id = await agreed({
      ...agreement,
      deposit: { type: "none", percent: null, fixed_amount: null },
    });
    const result = await issueDepositInvoice(id, { ...options, paypal });

    expect(result.status).toBe("skipped");
    expect(await db.invoice.count({ where: { commissionId: id } })).toBe(0);
  });

  it("resumes after PayPal failed, without a second row", async () => {
    const id = await agreed();
    const failing = createMockPayPalClient();
    failing.createInvoice = async () => {
      throw new Error("PayPal is down");
    };

    await expect(
      issueDepositInvoice(id, { ...options, paypal: failing }),
    ).rejects.toThrow("PayPal is down");
    expect(await db.invoice.count({ where: { commissionId: id } })).toBe(1);

    const retry = await issueDepositInvoice(id, { ...options, paypal });
    expect(retry.status).toBe("sent");
    const rows = await db.invoice.findMany({ where: { commissionId: id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("sent");
  });

  it("sends the deposit invoice again after PayPal failed", async () => {
    const id = await agreed();
    const failing = createMockPayPalClient();
    failing.createInvoice = async () => {
      throw new Error("PayPal is down");
    };

    await expect(
      retryDepositInvoice(id, { ...options, paypal: failing }),
    ).rejects.toMatchObject({
      code: "invoice_failed",
      message: "PayPal is down",
    });
    expect((await getCommission(id))?.depositRetry).toEqual({
      error: "PayPal is down",
    });

    const retry = await retryDepositInvoice(id, { ...options, paypal });
    expect(retry.status).toBe("sent");
    const rows = await db.invoice.findMany({ where: { commissionId: id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "sent",
      paypalInvoiceId: "INV2-MOCK-0001",
    });
    expect(paypal.all()[0].invoiceNumber).toMatch(/-DP$/);
    expect((await getCommission(id))?.depositRetry).toBeNull();
    const [row] = await listCommissions();
    expect(row.deposit.status).toBe("sent");
  });

  it("does not send the deposit invoice again once it is out", async () => {
    const id = await agreed();
    await issueDepositInvoice(id, { ...options, paypal });

    await expect(
      retryDepositInvoice(id, { ...options, paypal }),
    ).rejects.toMatchObject({ code: "retry_not_allowed" });
    expect(paypal.all()).toHaveLength(1);
  });

  it("only retries agreed commissions that need a deposit", async () => {
    const noDeposit = await agreed(
      {
        ...agreement,
        deposit: { type: "none", percent: null, fixed_amount: null },
      },
      "token-without-deposit",
    );
    await expect(
      retryDepositInvoice(noDeposit, { ...options, paypal }),
    ).rejects.toMatchObject({ code: "retry_not_allowed" });

    const cancelled = await agreed();
    await db.commission.update({
      where: { id: cancelled },
      data: { state: "cancelled" },
    });
    await expect(
      retryDepositInvoice(cancelled, { ...options, paypal }),
    ).rejects.toMatchObject({ code: "retry_not_allowed" });
    expect((await getCommission(cancelled))?.depositRetry).toBeNull();
    expect(paypal.all()).toHaveLength(0);
  });

  it("hides other creators' commissions", async () => {
    const id = await agreed();
    await agreed(agreement, "token-of-another-creator");

    await expect(
      retryDepositInvoice(id, { ...options, paypal }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(paypal.all()).toHaveLength(0);
  });

  it("fails clearly without a client email and saves nothing", async () => {
    const id = await agreed(exampleAgreement);

    await expect(
      issueDepositInvoice(id, { ...options, paypal }),
    ).rejects.toThrow(/client's PayPal email/);
    expect(await db.invoice.count({ where: { commissionId: id } })).toBe(0);
  });

  describe("balance invoice", () => {
    it("bills total − deposit on delivery, due in 7 days", async () => {
      const id = await agreed(agreement, "token-for-tests", "delivered");
      const result = await issueBalanceInvoice(id, { ...options, paypal });

      expect(result).toMatchObject({ status: "sent" });
      const [row] = await db.invoice.findMany({ where: { commissionId: id } });
      expect(row).toMatchObject({ kind: "balance", status: "sent" });
      expect(row.amount.toFixed(2)).toBe("75.00");
      expect(row.dueDate?.toISOString().slice(0, 10)).toBe("2026-11-12");
      expect(paypal.all()[0].invoiceNumber).toMatch(/-BAL$/);
    });

    it("never creates a second balance invoice", async () => {
      const id = await agreed(agreement, "token-for-tests", "delivered");
      await issueBalanceInvoice(id, { ...options, paypal });
      const again = await issueBalanceInvoice(id, { ...options, paypal });

      expect(again.status).toBe("exists");
      expect(await db.invoice.count({ where: { commissionId: id } })).toBe(1);
    });

    it("skips a zero balance", async () => {
      const id = await agreed(
        {
          ...agreement,
          deposit: { type: "percent", percent: 100, fixed_amount: null },
        },
        "token-for-tests",
        "delivered",
      );
      const result = await issueBalanceInvoice(id, { ...options, paypal });

      expect(result).toEqual({
        status: "skipped",
        reason: "The balance is zero.",
      });
      expect(await db.invoice.count({ where: { commissionId: id } })).toBe(0);
    });

    it("is independent of the deposit invoice", async () => {
      const id = await agreed();
      await issueDepositInvoice(id, { ...options, paypal });
      await issueBalanceInvoice(id, { ...options, paypal });

      const kinds = (
        await db.invoice.findMany({ where: { commissionId: id } })
      ).map((i) => i.kind);
      expect(kinds.sort()).toEqual(["balance", "deposit"]);
    });
  });
});
