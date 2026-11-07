import { z } from "zod";
import type { Invoice } from "./types";

/**
 * PayPal Customer Disputes API v1 (stretch #21): find disputes on our invoice
 * payments and send the evidence pack.
 */

const moneySchema = z.looseObject({
  currency_code: z.string(),
  value: z.string(),
});

const transactionSchema = z.looseObject({
  buyer_transaction_id: z.string().optional(),
  seller_transaction_id: z.string().optional(),
  invoice_number: z.string().optional(),
});

export const disputeSchema = z.looseObject({
  dispute_id: z.string(),
  status: z.string(),
  reason: z.string().optional(),
  dispute_state: z.string().optional(),
  dispute_life_cycle_stage: z.string().optional(),
  dispute_amount: moneySchema.optional(),
  seller_response_due_date: z.string().optional(),
  create_time: z.string().optional(),
  disputed_transactions: z.array(transactionSchema).optional(),
});

export const disputeListSchema = z.looseObject({
  items: z.array(disputeSchema).optional(),
});

/** What the app works with. */
export type Dispute = {
  id: string;
  /** e.g. WAITING_FOR_SELLER_RESPONSE, UNDER_REVIEW, RESOLVED */
  status: string;
  /** e.g. MERCHANDISE_OR_SERVICE_NOT_RECEIVED */
  reason: string | null;
  /** INQUIRY, CHARGEBACK, PRE_ARBITRATION, ARBITRATION */
  stage: string | null;
  amount: { currency: string; value: string } | null;
  sellerResponseDueDate: string | null;
  createdAt: string | null;
  /** Seller-side transaction IDs and invoice numbers this dispute is about. */
  transactionIds: string[];
  invoiceNumbers: string[];
};

export function normalizeDispute(raw: unknown): Dispute {
  const d = disputeSchema.parse(raw);
  const transactions = d.disputed_transactions ?? [];
  return {
    id: d.dispute_id,
    status: d.status,
    reason: d.reason ?? null,
    stage: d.dispute_life_cycle_stage ?? null,
    amount: d.dispute_amount
      ? {
          currency: d.dispute_amount.currency_code,
          value: d.dispute_amount.value,
        }
      : null,
    sellerResponseDueDate: d.seller_response_due_date ?? null,
    createdAt: d.create_time ?? null,
    transactionIds: transactions.flatMap((t) =>
      [t.seller_transaction_id, t.buyer_transaction_id].filter(
        (id): id is string => !!id,
      ),
    ),
    invoiceNumbers: transactions
      .map((t) => t.invoice_number)
      .filter((n): n is string => !!n),
  };
}

/** PayPal only accepts evidence while it waits for the seller. */
export function canProvideEvidence(dispute: Dispute): boolean {
  return dispute.status === "WAITING_FOR_SELLER_RESPONSE";
}

export type DisputeEvidenceInput = {
  pdf: Uint8Array;
  filename: string;
  notes: string;
  /** Defaults to OTHER: digital deliveries have no shipping tracking. */
  evidenceType?: "PROOF_OF_FULFILLMENT" | "OTHER";
};

/** multipart/form-data body for provide-evidence: `input` JSON + `file1`. */
export function buildEvidenceForm(input: DisputeEvidenceInput): FormData {
  const form = new FormData();
  form.append(
    "input",
    new Blob(
      [
        JSON.stringify({
          evidences: [
            {
              evidence_type: input.evidenceType ?? "OTHER",
              notes: input.notes.slice(0, 2000),
            },
          ],
        }),
      ],
      { type: "application/json" },
    ),
  );
  form.append(
    "file1",
    new Blob([new Uint8Array(input.pdf)], { type: "application/pdf" }),
    input.filename,
  );
  return form;
}

/**
 * PayPal transaction IDs of an invoice's payments. Disputes reference these,
 * not the invoice ID.
 */
export function invoiceTransactionIds(invoice: Invoice): string[] {
  const transactions = invoice.raw.payments?.transactions ?? [];
  return transactions
    .map((t) => (t as { payment_id?: unknown }).payment_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}
