export type InvoiceKind = "deposit" | "balance";

/** Prefix from issue #13. Change here only, nothing else depends on the literal. */
export const INVOICE_NUMBER_PREFIX = "CD";

const KIND_SUFFIX: Record<InvoiceKind, string> = {
  deposit: "DP",
  balance: "BAL",
};

/**
 * Invoice number shown to the client and used by PayPal to reject duplicates.
 *
 *   invoiceNumber("3f9a2c1e-...", "deposit")    -> "CD-3F9A2C1E-DP"
 *   invoiceNumber("3f9a2c1e-...", "balance", 2) -> "CD-3F9A2C1E-BAL-2"
 *
 * PayPal invoice numbers must be unique per merchant account. If an invoice is
 * cancelled and has to be re-issued for the same commission, pass `attempt` >= 2.
 */
export function invoiceNumber(
  commissionId: string,
  kind: InvoiceKind,
  attempt = 1,
): string {
  const short = commissionId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();
  if (!short) throw new Error("commissionId must contain letters or digits");
  if (!Number.isInteger(attempt) || attempt < 1)
    throw new Error("attempt must be an integer >= 1");
  const base = `${INVOICE_NUMBER_PREFIX}-${short}-${KIND_SUFFIX[kind]}`;
  return attempt === 1 ? base : `${base}-${attempt}`;
}
