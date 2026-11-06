/**
 * Error thrown for any non-2xx PayPal response.
 *
 * `name` is PayPal's error name (e.g. "INVALID_REQUEST", "RESOURCE_NOT_FOUND"),
 * `debugId` is what PayPal support asks for, `details` holds field-level issues.
 */
export class PayPalError extends Error {
  readonly status: number;
  readonly paypalName: string | undefined;
  readonly debugId: string | undefined;
  readonly details: unknown;

  constructor(opts: {
    status: number;
    message: string;
    paypalName?: string;
    debugId?: string;
    details?: unknown;
  }) {
    super(opts.message);
    this.name = "PayPalError";
    this.status = opts.status;
    this.paypalName = opts.paypalName;
    this.debugId = opts.debugId;
    this.details = opts.details;
  }

  /** True when PayPal rejected the invoice number as already used. */
  get isDuplicateInvoiceNumber(): boolean {
    return JSON.stringify(this.details ?? "").includes(
      "DUPLICATE_INVOICE_NUMBER",
    );
  }
}

/** Build a PayPalError from a failed fetch Response. Never throws itself. */
export async function toPayPalError(
  res: Response,
  context: string,
): Promise<PayPalError> {
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // body was empty or not JSON
  }
  // OAuth errors use { error, error_description }, REST errors use { name, message, debug_id, details }
  const paypalName = (body.name ?? body.error) as string | undefined;
  const msg = (body.message ??
    body.error_description ??
    res.statusText) as string;
  return new PayPalError({
    status: res.status,
    message: `PayPal ${context} failed (${res.status}${paypalName ? ` ${paypalName}` : ""}): ${msg}`,
    paypalName,
    debugId:
      (body.debug_id as string | undefined) ??
      res.headers.get("paypal-debug-id") ??
      undefined,
    details: body.details,
  });
}
