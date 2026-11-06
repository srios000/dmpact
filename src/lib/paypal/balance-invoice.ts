import { computeAmounts } from "@/lib/money/decimal";
import {
  addDays,
  DepositInvoiceError,
  type DepositInvoicePlan,
  type PlanDepositInvoiceInput,
} from "./deposit-invoice";

/** Days the client gets to pay the balance after delivery. */
export const BALANCE_DUE_DAYS = 7;

export type BalanceInvoicePlan = DepositInvoicePlan;
export type PlanBalanceInvoiceInput = PlanDepositInvoiceInput;

/**
 * Everything needed to create the balance invoice (total − deposit) for the
 * agreement in force. Pure: money comes from `computeAmounts`, never from the
 * stored agreement. A zero balance is skipped; the state machine then moves
 * the commission straight to fully_paid.
 *
 * Throws `DepositInvoiceError` (same codes as the deposit invoice) when an
 * email or the amounts are missing.
 */
export function planBalanceInvoice(
  input: PlanBalanceInvoiceInput,
): BalanceInvoicePlan {
  const { agreement } = input;
  const { price, deposit } = agreement;

  const amounts =
    price.currency === null
      ? null
      : computeAmounts(price.total, price.currency, deposit);
  if (
    !amounts ||
    amounts.exceeds ||
    amounts.balance === null ||
    price.currency === null
  ) {
    throw new DepositInvoiceError(
      "invalid_amounts",
      "The agreement's price and deposit are incomplete or the deposit exceeds the total.",
    );
  }
  if (!/[1-9]/.test(amounts.balance)) {
    return { skip: true, reason: "The balance is zero." };
  }

  const client = agreement.parties?.client;
  const recipientEmail = client?.email?.trim();
  if (!recipientEmail) {
    throw new DepositInvoiceError(
      "missing_client_email",
      "The client's PayPal email is needed to send the balance invoice.",
    );
  }
  const invoicerEmail = input.creatorPaypalEmail?.trim();
  if (!invoicerEmail) {
    throw new DepositInvoiceError(
      "missing_creator_paypal_email",
      "The creator has no PayPal email to issue invoices from.",
    );
  }

  const label = deposit.type === "none" ? "Payment" : "Balance";
  const link = input.clientToken
    ? ` Review it at ${input.appBaseUrl.replace(/\/$/, "")}/a/${input.clientToken}`
    : "";

  return {
    skip: false,
    amount: amounts.balance,
    currency: price.currency,
    dueDate: addDays(input.today, BALANCE_DUE_DAYS),
    itemName: `${label} — ${agreement.title}`,
    note: `${label} for agreement version ${input.version} (${input.contentHash.slice(0, 8)}), due on delivery.${link}`,
    invoicerEmail,
    recipientEmail,
    recipientName: client?.display_name ?? null,
  };
}
