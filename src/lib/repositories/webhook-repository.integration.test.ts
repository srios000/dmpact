import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import type { WebhookEvent } from "@/lib/paypal/webhook";
import type { CommissionState } from "@/lib/state-machine/rules";
import { processWebhookEvent, recordWebhookEvent } from "./webhook-repository";

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

function paidEvent(id: string, paypalInvoiceId: string): WebhookEvent {
  return {
    id,
    event_type: "INVOICING.INVOICE.PAID",
    create_time: "2026-11-06T01:02:03Z",
    resource: { invoice: { id: paypalInvoiceId, status: "PAID" } },
  };
}

describe.skipIf(!url)("PayPal webhook processing (database)", () => {
  afterAll(() => db.$disconnect());

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      "TRUNCATE creators, commissions, agreement_versions, confirmations, invoices, deliveries, commission_events, change_requests, rate_cards, webhook_events RESTART IDENTITY CASCADE",
    );
  });

  /** A commission in `state` with one sent invoice of `kind`. */
  async function withInvoice(
    state: CommissionState,
    kind: "deposit" | "balance",
  ) {
    const creator = await db.creator.create({
      data: {
        authUserId: crypto.randomUUID(),
        email: `${crypto.randomUUID()}@test.dev`,
        displayName: "Test Creator",
      },
    });
    const commission = await db.commission.create({
      data: { creatorId: creator.id, state, sourceDm: "dm" },
    });
    const paypalInvoiceId = `INV2-${crypto.randomUUID()}`;
    const invoice = await db.invoice.create({
      data: {
        commissionId: commission.id,
        kind,
        status: "sent",
        paypalInvoiceId,
        amount: "75.00",
        currency: "USD",
      },
    });
    return {
      commissionId: commission.id,
      invoiceId: invoice.id,
      paypalInvoiceId,
    };
  }

  async function deliver(event: WebhookEvent) {
    const { isNew } = await recordWebhookEvent(event);
    if (isNew) await processWebhookEvent(event.id);
    return isNew;
  }

  it("marks a paid deposit and moves agreed -> dp_paid", async () => {
    const { commissionId, invoiceId, paypalInvoiceId } = await withInvoice(
      "agreed",
      "deposit",
    );
    await deliver(paidEvent("WH-1", paypalInvoiceId));

    const invoice = await db.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });
    expect(invoice.status).toBe("paid");
    expect(invoice.paidAt?.toISOString()).toBe("2026-11-06T01:02:03.000Z");

    const commission = await db.commission.findUniqueOrThrow({
      where: { id: commissionId },
      include: { events: true },
    });
    expect(commission.state).toBe("dp_paid");
    expect(commission.events.find((e) => e.toState === "dp_paid")?.actor).toBe(
      "paypal",
    );

    const stored = await db.webhookEvent.findUniqueOrThrow({
      where: { id: "WH-1" },
    });
    expect(stored.processedAt).not.toBeNull();
  });

  it("moves delivered -> fully_paid when the balance is paid", async () => {
    const { commissionId, paypalInvoiceId } = await withInvoice(
      "delivered",
      "balance",
    );
    await deliver(paidEvent("WH-2", paypalInvoiceId));

    const commission = await db.commission.findUniqueOrThrow({
      where: { id: commissionId },
    });
    expect(commission.state).toBe("fully_paid");
  });

  it("ignores a redelivered event", async () => {
    const { commissionId, paypalInvoiceId } = await withInvoice(
      "agreed",
      "deposit",
    );
    expect(await deliver(paidEvent("WH-3", paypalInvoiceId))).toBe(true);
    expect(await deliver(paidEvent("WH-3", paypalInvoiceId))).toBe(false);

    const events = await db.commissionEvent.findMany({
      where: { commissionId },
    });
    expect(events.filter((e) => e.type === "invoice_paid")).toHaveLength(1);
    expect(events.filter((e) => e.toState === "dp_paid")).toHaveLength(1);
  });

  it("doesn't move the commission twice for a second PAID event", async () => {
    const { commissionId, paypalInvoiceId } = await withInvoice(
      "agreed",
      "deposit",
    );
    await deliver(paidEvent("WH-4", paypalInvoiceId));
    await deliver(paidEvent("WH-5", paypalInvoiceId));

    const events = await db.commissionEvent.findMany({
      where: { commissionId },
    });
    expect(events.filter((e) => e.toState === "dp_paid")).toHaveLength(1);
  });

  it("marks a cancelled invoice without changing the commission", async () => {
    const { commissionId, invoiceId, paypalInvoiceId } = await withInvoice(
      "agreed",
      "deposit",
    );
    await deliver({
      id: "WH-6",
      event_type: "INVOICING.INVOICE.CANCELLED",
      resource: { invoice: { id: paypalInvoiceId, status: "CANCELLED" } },
    });

    expect(
      (await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status,
    ).toBe("cancelled");
    expect(
      (await db.commission.findUniqueOrThrow({ where: { id: commissionId } }))
        .state,
    ).toBe("agreed");
  });

  it("marks events for unknown invoices processed and changes nothing", async () => {
    await deliver(paidEvent("WH-7", "INV2-UNKNOWN"));

    const stored = await db.webhookEvent.findUniqueOrThrow({
      where: { id: "WH-7" },
    });
    expect(stored.processedAt).not.toBeNull();
    expect(await db.commissionEvent.count()).toBe(0);
  });
});
