export type InvoiceKind = "deposit" | "balance";

/** Prefix from issue #13. Change here only, nothing else depends on the literal. */
export const INVOICE_NUMBER_PREFIX = "CD";

/** PayPal rejects longer invoice numbers with 400 INVALID_REQUEST. */
export const INVOICE_NUMBER_MAX_LENGTH = 25;

const ID_CHARS = 15;
const MAX_ATTEMPT = 99;

const KIND_SUFFIX: Record<InvoiceKind, string> = {
  deposit: "DP",
  balance: "BAL",
};

/**
 * Invoice number shown to the client and used by PayPal to reject duplicates.
 * Uses the last 15 hex characters of the commission's UUIDv7, which are
 * random, so commissions created in the same minute still differ.
 *
 *   invoiceNumber("019a5c3e-7b4d-7e2a-9c1f-3d2b1a0f9e8c", "deposit")
 *     -> "CD-C1F3D2B1A0F9E8C-DP"
 *   invoiceNumber("019a5c3e-7b4d-7e2a-9c1f-3d2b1a0f9e8c", "balance", 2)
 *     -> "CD-C1F3D2B1A0F9E8C-BAL-2"
 *
 * PayPal invoice numbers must be unique per merchant account. If an invoice is
 * cancelled and has to be re-issued for the same commission, pass `attempt` >= 2.
 */
export function invoiceNumber(
  commissionId: string,
  kind: InvoiceKind,
  attempt = 1,
): string {
  const id = commissionId
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(-ID_CHARS);
  if (!id) throw new Error("commissionId must contain letters or digits");
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > MAX_ATTEMPT)
    throw new Error(`attempt must be an integer from 1 to ${MAX_ATTEMPT}`);
  const base = `${INVOICE_NUMBER_PREFIX}-${id}-${KIND_SUFFIX[kind]}`;
  return attempt === 1 ? base : `${base}-${attempt}`;
}
