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
import type { CommissionState } from "@/lib/state-machine/rules";
import { applyTransition, runEffects } from "@/lib/state-machine/transition";
import { lockCommission } from "./shared";

/*
 * Internal: called by the PayPal webhook route after the signature is
 * verified. Not reachable by creators or clients.
 */

/**
 * Stores a verified event once. `needsProcessing` stays true for a redelivered
 * event whose earlier processing failed, so a resend can finish it.
 */
export async function recordWebhookEvent(
  event: WebhookEvent,
): Promise<{ isNew: boolean; needsProcessing: boolean }> {
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
  if (count === 1) return { isNew: true, needsProcessing: true };

  const stored = await db.webhookEvent.findUnique({
    where: { id: event.id },
    select: { processedAt: true },
  });
  return { isNew: false, needsProcessing: !stored?.processedAt };
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
 * balance: delivered -> fully_paid) in one transaction under the commission
 * lock. If the move fails, nothing is saved and the invoice stays sent, so the
 * next webhook delivery or polling check retries. Safe to run twice.
 */
export async function markInvoicePaid(
  invoice: InvoiceRow,
  ref: InvoiceRef,
  source: PaymentSource,
) {
  const { from, to } = PAID_TRANSITION[invoice.kind];

  const steps = await db.$transaction(async (tx) => {
    await lockCommission(tx, invoice.commissionId);

    const current = await tx.invoice.findUnique({
      where: { id: invoice.id },
      select: { status: true },
    });
    if (current?.status !== "paid") {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "paid",
          paidAt: ref.paidAt ? new Date(ref.paidAt) : new Date(),
        },
      });
      await tx.commissionEvent.create({
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
      });
    }

    const commission = await tx.commission.findUnique({
      where: { id: invoice.commissionId },
      select: { state: true },
    });
    if (commission?.state !== from) return [];

    return applyTransition(tx, {
      commissionId: invoice.commissionId,
      to,
      actor: "paypal",
      reason: `PayPal invoice ${ref.paypalInvoiceId} paid.`,
    });
  });

  if (steps.length > 0) {
    await runEffects(db, invoice.commissionId, steps, effectHandlers);
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
