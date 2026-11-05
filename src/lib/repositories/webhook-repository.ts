import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  INVOICE_CANCELLED,
  INVOICE_PAID,
  invoiceFromEvent,
  parseWebhookEvent,
  type InvoiceRef,
  type WebhookEvent,
} from "@/lib/paypal/webhook";
import { effectHandlers } from "@/lib/state-machine/effect-handlers";
import { TransitionError } from "@/lib/state-machine/errors";
import type { CommissionState } from "@/lib/state-machine/rules";
import { transition } from "@/lib/state-machine/transition";

/*
 * Internal: called by the PayPal webhook route after the signature is
 * verified. Not reachable by creators or clients.
 */

/**
 * Stores a verified event once. Returns false for an event ID already seen,
 * so redelivered events are no-ops.
 */
export async function recordWebhookEvent(
  event: WebhookEvent,
): Promise<{ isNew: boolean }> {
  const { count } = await db.webhookEvent.createMany({
    data: [
      {
        id: event.id,
        type: event.event_type,
        payload: event as unknown as Prisma.InputJsonObject,
      },
    ],
    skipDuplicates: true,
  });
  return { isNew: count === 1 };
}

export type InvoiceRow = {
  id: string;
  commissionId: string;
  kind: "deposit" | "balance";
  status: "draft" | "sent" | "paid" | "cancelled";
};

/** Which state a paid invoice moves the commission from and to. */
const PAID_TRANSITION: Record<
  InvoiceRow["kind"],
  { from: CommissionState; to: CommissionState }
> = {
  deposit: { from: "agreed", to: "dp_paid" },
  balance: { from: "delivered", to: "fully_paid" },
};

/** Where a payment update came from, stored on the commission event. */
export type PaymentSource = { webhookEventId: string } | { via: "polling" };

/**
 * Marks the invoice paid and moves the commission (deposit: agreed -> dp_paid,
 * balance: delivered -> fully_paid). Shared by the webhook and the polling
 * fallback, and safe to run twice.
 */
export async function markInvoicePaid(
  invoice: InvoiceRow,
  ref: InvoiceRef,
  source: PaymentSource,
) {
  if (invoice.status !== "paid") {
    await db.$transaction([
      db.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "paid",
          paidAt: ref.paidAt ? new Date(ref.paidAt) : new Date(),
        },
      }),
      db.commissionEvent.create({
        data: {
          commissionId: invoice.commissionId,
          type: "invoice_paid",
          actor: "paypal",
          meta: {
            kind: invoice.kind,
            invoiceId: invoice.id,
            paypalInvoiceId: ref.paypalInvoiceId,
            ...source,
          },
        },
      }),
    ]);
  }

  const { from, to } = PAID_TRANSITION[invoice.kind];
  const commission = await db.commission.findUnique({
    where: { id: invoice.commissionId },
    select: { state: true },
  });
  if (commission?.state !== from) return;

  try {
    await transition(
      db,
      {
        commissionId: invoice.commissionId,
        to,
        actor: "paypal",
        reason: `PayPal invoice ${ref.paypalInvoiceId} paid.`,
      },
      effectHandlers,
    );
  } catch (error) {
    // Another delivery or the polling fallback moved it first.
    if (error instanceof TransitionError && error.code === "conflict") return;
    throw error;
  }
}

/** Marks the invoice cancelled. The commission state doesn't change. */
export async function markInvoiceCancelled(
  invoice: InvoiceRow,
  ref: InvoiceRef,
  source: PaymentSource,
) {
  if (invoice.status === "paid" || invoice.status === "cancelled") return;
  await db.$transaction([
    db.invoice.update({
      where: { id: invoice.id },
      data: { status: "cancelled" },
    }),
    db.commissionEvent.create({
      data: {
        commissionId: invoice.commissionId,
        type: "invoice_cancelled",
        actor: "paypal",
        meta: {
          kind: invoice.kind,
          invoiceId: invoice.id,
          paypalInvoiceId: ref.paypalInvoiceId,
          ...source,
        },
      },
    }),
  ]);
}

/**
 * Applies a stored event: marks the invoice paid or cancelled and, for a
 * payment, moves the commission (deposit: agreed -> dp_paid, balance:
 * delivered -> fully_paid). Events for unknown invoices or other types are
 * marked processed and ignored.
 *
 * Returns the affected commission so the caller can revalidate its pages.
 */
export async function processWebhookEvent(
  eventId: string,
): Promise<{ commissionId: string | null }> {
  const stored = await db.webhookEvent.findUnique({ where: { id: eventId } });
  if (!stored || stored.processedAt) return { commissionId: null };

  const event = parseWebhookEvent(stored.payload);
  const ref = event ? invoiceFromEvent(event) : null;
  let commissionId: string | null = null;

  if (
    event &&
    ref &&
    (event.event_type === INVOICE_PAID ||
      event.event_type === INVOICE_CANCELLED)
  ) {
    const invoice = await db.invoice.findUnique({
      where: { paypalInvoiceId: ref.paypalInvoiceId },
      select: { id: true, commissionId: true, kind: true, status: true },
    });
    if (invoice) {
      commissionId = invoice.commissionId;
      if (event.event_type === INVOICE_PAID) {
        await markInvoicePaid(invoice, ref, { webhookEventId: eventId });
      } else {
        await markInvoiceCancelled(invoice, ref, { webhookEventId: eventId });
      }
    }
  }

  await db.webhookEvent.update({
    where: { id: eventId },
    data: { processedAt: new Date() },
  });
  return { commissionId };
}
