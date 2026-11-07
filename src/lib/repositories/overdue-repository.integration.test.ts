import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentCreator } from "@/lib/auth/get-current-creator";
import { db } from "@/lib/db";
import { createMockPayPalClient } from "@/lib/paypal/mock";
import type { Agreement } from "@/lib/schema/agreement";
import { contentHash } from "@/lib/schema/content-hash";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import {
  REMIND_INTERVAL_MS,
  latestNudge,
  latestNudgeFromEvents,
  runCommissionReminder,
  runOverdueReminders,
} from "./overdue-repository";
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

const TODAY = "2026-11-10";
const NOW = new Date("2026-11-10T01:00:00Z");

describe.skipIf(!url)("overdue reminders (database)", () => {
  const paypal = createMockPayPalClient();

  afterAll(() => db.$disconnect());

  beforeEach(async () => {
    paypal.reset();
    await db.$executeRawUnsafe(
      "TRUNCATE creators, commissions, agreement_versions, confirmations, invoices, deliveries, delivery_downloads, commission_events, change_requests, follow_up_dms, rate_cards, webhook_events RESTART IDENTITY CASCADE",
    );
  });

  /** A delivered commission with a sent balance invoice due on `dueDate`. */
  async function withSentBalance(dueDate: string) {
    const creator = await db.creator.create({
      data: {
        authUserId: crypto.randomUUID(),
        email: `${crypto.randomUUID()}@test.dev`,
        displayName: "Test Creator",
      },
    });
    const commission = await db.commission.create({
      data: { creatorId: creator.id, state: "delivered", sourceDm: "dm" },
    });
    const hash = contentHash(agreement);
    const version = await db.agreementVersion.create({
      data: {
        commissionId: commission.id,
        version: 1,
        content: toJson(agreement),
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
      dueDate,
    });
    const sent = await paypal.sendInvoice(draft.id);
    const invoice = await db.invoice.create({
      data: {
        commissionId: commission.id,
        kind: "balance",
        status: "sent",
        paypalInvoiceId: draft.id,
        payLink: sent.payLink,
        amount: "75.00",
        currency: "USD",
        dueDate: new Date(`${dueDate}T00:00:00Z`),
      },
    });
    return { creator, commissionId: commission.id, invoiceId: invoice.id };
  }

  const reminds = () =>
    paypal.calls.filter(([method]) => method === "remindInvoice").length;

  it("reminds an overdue invoice and stores the nudge", async () => {
    const { commissionId, invoiceId } = await withSentBalance("2026-11-05");
    const [outcome] = await runOverdueReminders({
      paypal,
      model: null,
      today: TODAY,
      now: NOW,
    });

    expect(outcome).toMatchObject({ status: "reminded", invoiceId });
    expect(reminds()).toBe(1);

    const invoice = await db.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });
    expect(invoice.lastRemindedAt?.toISOString()).toBe(NOW.toISOString());

    const nudge = await latestNudge(commissionId);
    expect(nudge).toMatchObject({
      kind: "balance",
      daysOverdue: 5,
      tone: "firm",
      remindedAtPayPal: true,
    });
    expect(nudge?.message).toContain("75.00 USD");
    expect(nudge?.message).toContain("You can pay here:");
  });

  it("leaves invoices that aren't due yet alone", async () => {
    await withSentBalance("2026-11-12");
    const outcomes = await runOverdueReminders({
      paypal,
      model: null,
      today: TODAY,
      now: NOW,
    });

    expect(outcomes).toHaveLength(0);
    expect(reminds()).toBe(0);
  });

  it("reminds each invoice at most once per 24 hours", async () => {
    await withSentBalance("2026-11-05");
    const run = (now: Date) =>
      runOverdueReminders({ paypal, model: null, today: TODAY, now });

    await run(NOW);
    expect(await run(new Date(NOW.getTime() + 60 * 60 * 1000))).toHaveLength(0);
    expect(reminds()).toBe(1);

    const nextDay = new Date(NOW.getTime() + REMIND_INTERVAL_MS);
    const [again] = await runOverdueReminders({
      paypal,
      model: null,
      today: "2026-11-11",
      now: nextDay,
    });
    expect(again.status).toBe("reminded");
    expect(reminds()).toBe(2);
  });

  it("still drafts a nudge without PayPal", async () => {
    const { commissionId } = await withSentBalance("2026-11-05");
    const [outcome] = await runOverdueReminders({
      paypal: null,
      model: null,
      today: TODAY,
      now: NOW,
    });

    expect(outcome.status).toBe("reminded");
    expect(await latestNudge(commissionId)).toMatchObject({
      remindedAtPayPal: false,
    });
  });

  it("gives the claim back when PayPal fails", async () => {
    const { invoiceId } = await withSentBalance("2026-11-05");
    const failing = createMockPayPalClient();
    failing.remindInvoice = async () => {
      throw new Error("PayPal is down");
    };

    const [outcome] = await runOverdueReminders({
      paypal: failing,
      model: null,
      today: TODAY,
      now: NOW,
    });
    expect(outcome).toMatchObject({ status: "failed" });
    const invoice = await db.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });
    expect(invoice.lastRemindedAt).toBeNull();
  });

  it("Run reminder works for the owner and returns the latest nudge", async () => {
    const { creator, commissionId } = await withSentBalance("2026-11-05");
    vi.mocked(getCurrentCreator).mockResolvedValue(creator);

    const first = await runCommissionReminder(commissionId, {
      paypal,
      model: null,
      today: TODAY,
      now: NOW,
    });
    expect(first.outcomes).toHaveLength(1);
    expect(first.nudge?.message).toContain("75.00 USD");

    const events = await db.commissionEvent.findMany({
      where: { commissionId },
      orderBy: { at: "asc" },
    });
    expect(events.find((e) => e.type === "invoice_reminded")?.actor).toBe(
      "creator",
    );
    expect(latestNudgeFromEvents(events)).toEqual(first.nudge);

    // Within 24 hours: nothing new is sent, but the nudge is still returned.
    const second = await runCommissionReminder(commissionId, {
      paypal,
      model: null,
      today: TODAY,
      now: NOW,
    });
    expect(second.outcomes).toHaveLength(0);
    expect(second.nudge?.message).toBe(first.nudge?.message);
    expect(reminds()).toBe(1);
  });

  it("Run reminder refuses other creators' commissions", async () => {
    const { commissionId } = await withSentBalance("2026-11-05");
    const other = await db.creator.create({
      data: {
        authUserId: crypto.randomUUID(),
        email: `${crypto.randomUUID()}@test.dev`,
        displayName: "Someone else",
      },
    });
    vi.mocked(getCurrentCreator).mockResolvedValue(other);

    await expect(
      runCommissionReminder(commissionId, { paypal, model: null }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
