import "server-only";
import { createPayPalClient } from "./client";
import { createMockPayPalClient } from "./mock";
import type { PayPalClient } from "./types";

export * from "./types";
export { PayPalError } from "./errors";
export {
  invoiceNumber,
  INVOICE_NUMBER_PREFIX,
  type InvoiceKind,
} from "./invoice-number";
export { toPayPalValue } from "./currency";
export {
  canProvideEvidence,
  invoiceTransactionIds,
  type Dispute,
} from "./disputes";
export { createPayPalClient } from "./client";
export { createMockPayPalClient, type MockPayPalClient } from "./mock";

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";

let instance: PayPalClient | null = null;

/**
 * Shared PayPal client for server code (state machine side effects, cron,
 * webhook). PAYPAL_MOCK=true gives the in-memory mock, otherwise the real
 * sandbox client. Reads process.env directly so importing this module doesn't
 * require the database and auth env vars that `lib/env` validates.
 */
export function getPayPalClient(
  source: NodeJS.ProcessEnv = process.env,
): PayPalClient {
  if (instance) return instance;

  if (source.PAYPAL_MOCK === "true") {
    instance = createMockPayPalClient();
    return instance;
  }

  const clientId = source.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = source.PAYPAL_CLIENT_SECRET?.trim();
  const baseUrl = source.PAYPAL_API_BASE?.trim() || SANDBOX_BASE;
  if (!clientId || !clientSecret) {
    throw new Error(
      "PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required (or set PAYPAL_MOCK=true)",
    );
  }
  if (!new URL(baseUrl).hostname.includes("sandbox")) {
    throw new Error("PAYPAL_API_BASE must be the sandbox API (sandbox only)");
  }

  instance = createPayPalClient({ baseUrl, clientId, clientSecret });
  return instance;
}

/** Tests only: swap in a client or reset the singleton. */
export function setPayPalClientForTests(client: PayPalClient | null): void {
  instance = client;
}
