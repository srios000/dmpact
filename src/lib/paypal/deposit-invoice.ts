import { computeAmounts } from "@/lib/money/decimal";
import type { Agreement } from "@/lib/schema/agreement";

/** Days the client gets to pay the deposit after confirming. */
export const DEPOSIT_DUE_DAYS = 3;

export type DepositInvoiceErrorCode =
  "missing_client_email" | "missing_creator_paypal_email" | "invalid_amounts";

/** An expected reason the deposit invoice can't be created yet. */
export class DepositInvoiceError extends Error {
  readonly code: DepositInvoiceErrorCode;

  constructor(code: DepositInvoiceErrorCode, message: string) {
    super(message);
    this.name = "DepositInvoiceError";
    this.code = code;
  }
}

export type DepositInvoicePlan =
  | { skip: true; reason: string }
  | {
      skip: false;
      amount: string;
      currency: string;
      dueDate: string;
      itemName: string;
      note: string;
      invoicerEmail: string;
      recipientEmail: string;
      recipientName: string | null;
    };

export type PlanDepositInvoiceInput = {
  agreement: Agreement;
  version: number;
  contentHash: string;
  creatorPaypalEmail: string | null;
  clientToken: string | null;
  appBaseUrl: string;
  /** YYYY-MM-DD (UTC) */
  today: string;
};

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Everything needed to create the deposit invoice for the agreement in force.
 * Pure: money comes from `computeAmounts`, never from the stored agreement.
 */
export function planDepositInvoice(
  input: PlanDepositInvoiceInput,
): DepositInvoicePlan {
  const { agreement } = input;
  const { price, deposit } = agreement;

  if (deposit.type === "none") {
    return { skip: true, reason: "The agreement has no deposit." };
  }

  const amounts =
    price.currency === null
      ? null
      : computeAmounts(price.total, price.currency, deposit);
  if (!amounts || amounts.exceeds || price.currency === null) {
    throw new DepositInvoiceError(
      "invalid_amounts",
      "The agreement's price and deposit are incomplete or the deposit exceeds the total.",
    );
  }
  if (!/[1-9]/.test(amounts.deposit)) {
    return { skip: true, reason: "The deposit is zero." };
  }

  const client = agreement.parties?.client;
  const recipientEmail = client?.email?.trim();
  if (!recipientEmail) {
    throw new DepositInvoiceError(
      "missing_client_email",
      "The client's PayPal email is needed to send the deposit invoice.",
    );
  }
  const invoicerEmail = input.creatorPaypalEmail?.trim();
  if (!invoicerEmail) {
    throw new DepositInvoiceError(
      "missing_creator_paypal_email",
      "The creator has no PayPal email to issue invoices from.",
    );
  }

  const label =
    deposit.type === "percent" ? `Deposit (${deposit.percent}%)` : "Deposit";
  const link = input.clientToken
    ? ` Review it at ${input.appBaseUrl.replace(/\/$/, "")}/a/${input.clientToken}`
    : "";

  return {
    skip: false,
    amount: amounts.deposit,
    currency: price.currency,
    dueDate: addDays(input.today, DEPOSIT_DUE_DAYS),
    itemName: `${label} — ${agreement.title}`,
    note: `Deposit for agreement version ${input.version} (${input.contentHash.slice(0, 8)}).${link}`,
    invoicerEmail,
    recipientEmail,
    recipientName: client?.display_name ?? null,
  };
}
