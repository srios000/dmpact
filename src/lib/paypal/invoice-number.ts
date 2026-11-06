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
 *   invoiceNumber("019a5c3e-7b4d-7e2a-9c1f-3d2b1a0f9e8c", "deposit")
 *     -> "CD-019A5C3E7B4D7E2A9C1F3D2B1A0F9E8C-DP"
 *   invoiceNumber("019a5c3e-7b4d-7e2a-9c1f-3d2b1a0f9e8c", "balance", 2)
 *     -> "CD-019A5C3E7B4D7E2A9C1F3D2B1A0F9E8C-BAL-2"
 *
 * PayPal invoice numbers must be unique per merchant account. If an invoice is
 * cancelled and has to be re-issued for the same commission, pass `attempt` >= 2.
 */
export function invoiceNumber(
  commissionId: string,
  kind: InvoiceKind,
  attempt = 1,
): string {
  const id = commissionId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!id) throw new Error("commissionId must contain letters or digits");
  if (!Number.isInteger(attempt) || attempt < 1)
    throw new Error("attempt must be an integer >= 1");
  const base = `${INVOICE_NUMBER_PREFIX}-${id}-${KIND_SUFFIX[kind]}`;
  return attempt === 1 ? base : `${base}-${attempt}`;
}
