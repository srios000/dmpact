import type { PaymentStatus } from "@/lib/repositories/shared";
import type { CommissionState, Effect } from "./rules";

const RETRYABLE: PaymentStatus["status"][] = [
  "not_created",
  "draft",
  "cancelled",
];

export function canRetryDepositInvoice(
  state: CommissionState,
  deposit: PaymentStatus["status"],
): boolean {
  return state === "agreed" && RETRYABLE.includes(deposit);
}

export function canRetryBalanceInvoice(
  state: CommissionState,
  balance: PaymentStatus["status"],
): boolean {
  return state === "delivered" && RETRYABLE.includes(balance);
}

function failureMessageFor(
  events: { type: string; reason: string | null; meta: unknown }[],
  effect: Effect,
): string | null {
  const failure = events.findLast(
    (e) => e.type === "effect_failed" && e.reason === effect,
  );
  const meta = failure?.meta;
  if (meta && typeof meta === "object" && "message" in meta) {
    return typeof meta.message === "string" ? meta.message : null;
  }
  return null;
}

export function depositFailureMessage(
  events: { type: string; reason: string | null; meta: unknown }[],
): string | null {
  return failureMessageFor(events, "createDepositInvoice");
}

export function balanceFailureMessage(
  events: { type: string; reason: string | null; meta: unknown }[],
): string | null {
  return failureMessageFor(events, "createBalanceInvoice");
}
