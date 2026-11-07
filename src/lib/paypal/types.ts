import { z } from "zod";
import type { Dispute, DisputeEvidenceInput } from "./disputes";
import type { InvoiceKind } from "./invoice-number";

const moneySchema = z.looseObject({
  currency_code: z.string(),
  value: z.string(),
});

/**
 * The parts of PayPal's invoice object we rely on. Loose objects keep every
 * other field, so the raw response can still be logged or stored.
 */
export const paypalInvoiceSchema = z.looseObject({
  id: z.string(),
  status: z.string(),
  detail: z.looseObject({
    invoice_number: z.string().optional(),
    currency_code: z.string().optional(),
    metadata: z
      .looseObject({ recipient_view_url: z.string().optional() })
      .optional(),
  }),
  amount: moneySchema.optional(),
  due_amount: moneySchema.optional(),
  payments: z
    .looseObject({
      paid_amount: moneySchema.optional(),
      transactions: z
        .array(
          z.looseObject({
            payment_id: z.string().optional(),
            payment_date: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});
export type PayPalInvoiceRaw = z.infer<typeof paypalInvoiceSchema>;

/** What the rest of the app sees. Stable even if PayPal adds fields. */
export type Invoice = {
  /** "INV2-XXXX-XXXX-XXXX-XXXX" */
  id: string;
  /** PayPal status, e.g. DRAFT, SENT, UNPAID, PAID, CANCELLED. */
  status: string;
  invoiceNumber: string | null;
  amount: { currency: string; value: string } | null;
  /** Link the client opens to pay. Present once the invoice is sent. */
  payLink: string | null;
  /** Latest payment date reported by PayPal, if any. */
  paidAt: string | null;
  raw: PayPalInvoiceRaw;
};

export type CreateInvoiceInput = {
  commissionId: string;
  kind: InvoiceKind;
  /** Use >= 2 when re-issuing after a cancelled invoice. */
  attempt?: number;
  /** The sandbox Business account linked to the app (creators.paypal_email). */
  invoicerEmail: string;
  recipientEmail: string;
  recipientName?: string | null;
  currency: string;
  /** Decimal string from lib/money, e.g. "75.00" or "15000" (JPY). */
  amount: string;
  /** Line item, e.g. "Deposit (50%) — Original song mix & master". */
  itemName: string;
  itemDescription?: string;
  /** Shown to the client on the invoice. A good place for the agreement link. */
  note?: string;
  /** "YYYY-MM-DD" */
  dueDate: string;
};

export type MessageOptions = { subject?: string; note?: string };

/** What state machine side effects, cron and webhooks depend on. */
export type PayPalClient = {
  /** Creates a DRAFT invoice. Call sendInvoice afterwards. */
  createInvoice(input: CreateInvoiceInput): Promise<Invoice>;
  /** DRAFT -> SENT. Returns the invoice re-fetched after sending (with payLink). */
  sendInvoice(id: string, opts?: MessageOptions): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice>;
  /** PayPal emails the client a reminder. Only for unpaid sent invoices. */
  remindInvoice(id: string, opts?: MessageOptions): Promise<void>;
  /**
   * DRAFT is deleted, SENT/UNPAID is cancelled, CANCELLED is a no-op,
   * paid invoices throw.
   */
  cancelInvoice(id: string, opts?: { note?: string }): Promise<void>;
  /** Finds an invoice by number (recovery after a duplicate-number error). */
  findInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null>;
  /**
   * Asks PayPal whether a webhook delivery is genuine. `rawBody` is the
   * request body exactly as received; re-serializing it can break the check.
   */
  verifyWebhookSignature(input: VerifyWebhookInput): Promise<boolean>;
  /** Disputes opened on one PayPal transaction (summary, no transactions). */
  listDisputesForTransaction(transactionId: string): Promise<Dispute[]>;
  /** Full dispute details, including the disputed transactions. */
  getDispute(id: string): Promise<Dispute>;
  /** Uploads evidence (the evidence pack PDF) to a dispute. */
  provideDisputeEvidence(
    id: string,
    input: DisputeEvidenceInput,
  ): Promise<void>;
};

/** The PAYPAL-* headers PayPal signs each webhook delivery with. */
export type WebhookHeaders = {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
};

export type VerifyWebhookInput = {
  headers: WebhookHeaders;
  /** The webhook subscription ID (PAYPAL_WEBHOOK_ID). */
  webhookId: string;
  rawBody: string;
};

/** Maps a PayPal status to the `InvoiceStatus` enum in prisma/schema.prisma. */
export function toDbInvoiceStatus(
  status: string,
): "draft" | "sent" | "paid" | "cancelled" {
  switch (status) {
    case "DRAFT":
    case "SCHEDULED":
      return "draft";
    case "PAID":
    case "MARKED_AS_PAID":
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
    case "MARKED_AS_REFUNDED":
      return "paid";
    case "CANCELLED":
      return "cancelled";
    default:
      // SENT, UNPAID, PAYMENT_PENDING, PARTIALLY_PAID: still waiting on money
      return "sent";
  }
}
