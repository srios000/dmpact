import { z } from "zod";
import type { WebhookHeaders } from "./types";

export const INVOICE_PAID = "INVOICING.INVOICE.PAID";
export const INVOICE_CANCELLED = "INVOICING.INVOICE.CANCELLED";

export const webhookEventSchema = z.looseObject({
  id: z.string().min(1),
  event_type: z.string().min(1),
  create_time: z.string().optional(),
  resource: z.looseObject({}).optional(),
});
export type WebhookEvent = z.infer<typeof webhookEventSchema>;

/** Reads the signing headers. Returns null when any of them is missing. */
export function readWebhookHeaders(headers: Headers): WebhookHeaders | null {
  const read = (name: string) => headers.get(name)?.trim() || null;
  const authAlgo = read("paypal-auth-algo");
  const certUrl = read("paypal-cert-url");
  const transmissionId = read("paypal-transmission-id");
  const transmissionSig = read("paypal-transmission-sig");
  const transmissionTime = read("paypal-transmission-time");
  if (
    !authAlgo ||
    !certUrl ||
    !transmissionId ||
    !transmissionSig ||
    !transmissionTime
  ) {
    return null;
  }
  return {
    authAlgo,
    certUrl,
    transmissionId,
    transmissionSig,
    transmissionTime,
  };
}

/** Parses a webhook body. Returns null for invalid JSON or a missing id/type. */
export function parseWebhookEvent(raw: unknown): WebhookEvent | null {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const parsed = webhookEventSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const invoiceRefSchema = z.looseObject({
  id: z.string().min(1),
  payments: z
    .looseObject({
      transactions: z
        .array(z.looseObject({ payment_date: z.string().optional() }))
        .optional(),
    })
    .optional(),
});

export type InvoiceRef = {
  paypalInvoiceId: string;
  /** When the payment happened, as reported by PayPal, if known. */
  paidAt: string | null;
};

/**
 * The invoice an INVOICING.* event is about. PayPal nests it under
 * `resource.invoice`; a bare invoice as `resource` is accepted too.
 */
export function invoiceFromEvent(event: WebhookEvent): InvoiceRef | null {
  const resource = event.resource ?? {};
  const parsed = invoiceRefSchema.safeParse(
    "invoice" in resource ? resource.invoice : resource,
  );
  if (!parsed.success) return null;
  const lastPayment = parsed.data.payments?.transactions?.at(-1)?.payment_date;
  return {
    paypalInvoiceId: parsed.data.id,
    paidAt: event.create_time ?? lastPayment ?? null,
  };
}
