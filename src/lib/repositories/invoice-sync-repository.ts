import "server-only";
import { getCurrentCreator } from "@/lib/auth/get-current-creator";
import { db } from "@/lib/db";
import {
  getPayPalClient,
  toDbInvoiceStatus,
  type PayPalClient,
} from "@/lib/paypal";
import { isClientToken } from "./shared";
import { markInvoiceCancelled, markInvoicePaid } from "./webhook-repository";

/**
 * Polling fallback for missed PayPal webhooks (#16). Asks PayPal for the
 * status of sent invoices and applies it through the same idempotent path as
 * the webhook (`markInvoicePaid` / `markInvoiceCancelled`).
 */

/** Background checks only look at invoices sent at least this long ago. */
export const BACKGROUND_AFTER_MS = 10 * 60_000;

/** Minimum gap between PayPal checks for the same commission. */
const MIN_INTERVAL_MS = { manual: 10_000, background: 60_000 } as const;

export type RefreshMode = keyof typeof MIN_INTERVAL_MS;

export type RefreshResult = {
  /** Invoices asked about at PayPal. */
  checked: number;
  /** Invoices whose status changed (paid or cancelled). */
  changed: number;
  /** True when skipped because the commission was checked moments ago. */
  throttled: boolean;
};

// Per server instance. Good enough to keep status polling from calling PayPal
// every few seconds; it is not a security control.
const lastChecked = new Map<string, number>();

export type SyncOptions = {
  paypal?: PayPalClient;
  /** Only check invoices whose row hasn't changed for this long. */
  olderThanMs?: number;
  now?: number;
};

/**
 * Checks every sent invoice of a commission at PayPal and applies paid or
 * cancelled statuses. No throttling: use `refreshPayments` from routes.
 */
export async function syncCommissionInvoices(
  commissionId: string,
  options: SyncOptions = {},
): Promise<{ checked: number; changed: number }> {
  const now = options.now ?? Date.now();
  const invoices = await db.invoice.findMany({
    where: {
      commissionId,
      status: "sent",
      paypalInvoiceId: { not: null },
      updatedAt: { lte: new Date(now - (options.olderThanMs ?? 0)) },
    },
    select: {
      id: true,
      commissionId: true,
      kind: true,
      status: true,
      paypalInvoiceId: true,
    },
  });
  if (invoices.length === 0) return { checked: 0, changed: 0 };

  const paypal = options.paypal ?? getPayPalClient();
  let changed = 0;
  for (const invoice of invoices) {
    const remote = await paypal.getInvoice(invoice.paypalInvoiceId!);
    const ref = { paypalInvoiceId: remote.id, paidAt: remote.paidAt };
    const status = toDbInvoiceStatus(remote.status);
    if (status === "paid") {
      await markInvoicePaid(invoice, ref, { via: "polling" });
      changed++;
    } else if (status === "cancelled") {
      await markInvoiceCancelled(invoice, ref, { via: "polling" });
      changed++;
    }
  }
  return { checked: invoices.length, changed };
}

/**
 * Throttled refresh for routes.
 * - manual: the client or creator pressed "Refresh payment status".
 * - background: status polling noticed an invoice still unpaid; only invoices
 *   sent at least 10 minutes ago are checked.
 */
export async function refreshPayments(
  commissionId: string,
  mode: RefreshMode,
  options: Omit<SyncOptions, "olderThanMs"> = {},
): Promise<RefreshResult> {
  const now = options.now ?? Date.now();
  const last = lastChecked.get(commissionId);
  if (last !== undefined && now - last < MIN_INTERVAL_MS[mode]) {
    return { checked: 0, changed: 0, throttled: true };
  }
  lastChecked.set(commissionId, now);

  const result = await syncCommissionInvoices(commissionId, {
    ...options,
    now,
    olderThanMs: mode === "background" ? BACKGROUND_AFTER_MS : 0,
  });
  return { ...result, throttled: false };
}

/** Tests only. */
export function resetRefreshThrottle(): void {
  lastChecked.clear();
}

/**
 * Same access rule as the status route: the client's token, or the signed-in
 * creator who owns the commission.
 */
export async function canAccessCommission(
  commissionId: string,
  clientToken: string | null,
): Promise<boolean> {
  if (clientToken) {
    if (!isClientToken(clientToken)) return false;
    const found = await db.commission.findFirst({
      where: { id: commissionId, clientToken },
      select: { id: true },
    });
    return !!found;
  }
  const creator = await getCurrentCreator();
  if (!creator) return false;
  const found = await db.commission.findFirst({
    where: { id: commissionId, creatorId: creator.id },
    select: { id: true },
  });
  return !!found;
}
