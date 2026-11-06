import { currencyExponent, fromMinor, toMinor } from "@/lib/money/decimal";
import type { PaymentStatus } from "@/lib/repositories/shared";
import type { CommissionState } from "@/lib/state-machine/rules";

export type QueueRow = {
  id: string;
  state: CommissionState;
  clientToken: string | null;
  title: string;
  clientName: string | null;
  clientHandle: string | null;
  serviceType: string;
  total: string | null;
  currency: string | null;
  depositAmount: string | null;
  balanceAmount: string | null;
  deadline: string | null;
  deposit: PaymentStatus;
  balance: PaymentStatus;
};

export type DeadlineTone = "late" | "soon" | "ok" | "done";

const DAY = 24 * 60 * 60 * 1000;
const WORK_STATES: CommissionState[] = [
  "draft",
  "negotiating",
  "agreed",
  "dp_paid",
  "in_progress",
];
const OWING_STATES: CommissionState[] = [
  "agreed",
  "dp_paid",
  "in_progress",
  "delivered",
];

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY,
  );
}

export function daysLeft(row: QueueRow, today: string): number | null {
  if (!row.deadline || !WORK_STATES.includes(row.state)) return null;
  return daysBetween(today, row.deadline);
}

export function deadlineTone(row: QueueRow, today: string): DeadlineTone {
  const left = daysLeft(row, today);
  if (left === null) return "done";
  if (left < 0) return "late";
  return left <= 3 ? "soon" : "ok";
}

function isLate(payment: PaymentStatus, today: string): boolean {
  return (
    payment.status === "sent" &&
    payment.dueDate !== null &&
    payment.dueDate < today
  );
}

export function overduePayment(
  row: QueueRow,
  today: string,
): "deposit" | "balance" | null {
  if (isLate(row.deposit, today)) return "deposit";
  if (isLate(row.balance, today)) return "balance";
  return null;
}

function unpaid(payment: PaymentStatus): boolean {
  return payment.status !== "paid" && payment.status !== "not_required";
}

export type PaymentTone = "paid" | "waiting" | "late" | "idle";

export type PaymentLike = {
  status: PaymentStatus["status"];
  dueDate: string | null;
};

export function paymentLabel(payment: PaymentLike, late: boolean): string {
  if (late) return "Overdue";
  switch (payment.status) {
    case "not_required":
      return "None";
    case "not_created":
    case "draft":
      return "Not sent";
    case "sent":
      return "Unpaid";
    case "paid":
      return "Paid";
    case "cancelled":
      return "Cancelled";
  }
}

export function paymentTone(payment: PaymentLike, late: boolean): PaymentTone {
  if (late) return "late";
  if (payment.status === "paid") return "paid";
  if (payment.status === "sent") return "waiting";
  return "idle";
}

export type MoneyByCurrency = { currency: string; amount: string }[];

function addTo(totals: Map<string, number>, currency: string, amount: string) {
  const minor = toMinor(amount, currencyExponent(currency));
  totals.set(currency, (totals.get(currency) ?? 0) + minor);
}

function toList(totals: Map<string, number>): MoneyByCurrency {
  return [...totals]
    .filter(([, minor]) => minor > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, minor]) => ({
      currency,
      amount: fromMinor(minor, currencyExponent(currency)),
    }));
}

export type QueueSummary = {
  outstanding: MoneyByCurrency;
  depositsPending: { count: number; amounts: MoneyByCurrency };
  dueThisWeek: number;
  overdue: number;
};

export function summarize(rows: QueueRow[], today: string): QueueSummary {
  const outstanding = new Map<string, number>();
  const deposits = new Map<string, number>();
  let depositCount = 0;
  let dueThisWeek = 0;
  let overdue = 0;

  for (const row of rows) {
    const currency = row.currency;
    if (currency && OWING_STATES.includes(row.state)) {
      if (unpaid(row.deposit) && row.depositAmount) {
        addTo(outstanding, currency, row.depositAmount);
      }
      if (unpaid(row.balance) && row.balanceAmount) {
        addTo(outstanding, currency, row.balanceAmount);
      }
    }
    if (row.deposit.status === "sent") {
      depositCount += 1;
      if (currency && row.depositAmount) {
        addTo(deposits, currency, row.depositAmount);
      }
    }
    const left = daysLeft(row, today);
    if (left !== null && left >= 0 && left <= 6) dueThisWeek += 1;
    if (overduePayment(row, today)) overdue += 1;
  }

  return {
    outstanding: toList(outstanding),
    depositsPending: { count: depositCount, amounts: toList(deposits) },
    dueThisWeek,
    overdue,
  };
}
