import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createMockPayPalClient } from "@/lib/paypal/mock";
import type { Agreement } from "@/lib/schema/agreement";
import { contentHash } from "@/lib/schema/content-hash";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import { issueDepositInvoice } from "./invoice-repository";
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
  async function agreed(content: Agreement = agreement) {
    const creator = await db.creator.create({
      data: {
        authUserId: crypto.randomUUID(),
        email: `${crypto.randomUUID()}@test.dev`,
        displayName: "Test Creator",
        paypalEmail: "creator@business.example.com",
      },
    });
    const commission = await db.commission.create({
      data: {
        creatorId: creator.id,
        state: "agreed",
        sourceDm: "dm",
        clientToken: "token-for-tests",
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
      `CD-${id.replace(/-/g, "").toUpperCase()}-DP`,
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

  it("fails clearly without a client email and saves nothing", async () => {
    const id = await agreed(exampleAgreement);

    await expect(
      issueDepositInvoice(id, { ...options, paypal }),
    ).rejects.toThrow(/client's PayPal email/);
    expect(await db.invoice.count({ where: { commissionId: id } })).toBe(0);
  });
});
