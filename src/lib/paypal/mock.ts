import { buildCreateInvoiceBody } from "./client";
import {
  canProvideEvidence,
  invoiceTransactionIds,
  type Dispute,
} from "./disputes";
import { PayPalError } from "./errors";
import type { Invoice, PayPalClient } from "./types";

export interface MockPayPalClient extends PayPalClient {
  /** Simulate the client paying (what the webhook would report). */
  markPaid(id: string): Invoice;
  /** All invoices, for assertions. */
  all(): Invoice[];
  /** Calls made, e.g. [["remindInvoice", "INV2-MOCK-0001"]]. */
  calls: Array<[method: string, ...args: unknown[]]>;
  /** What verifyWebhookSignature answers. Defaults to true. */
  webhookSignatureValid: boolean;
  /** Simulate the client opening a dispute on a paid invoice. */
  openDispute(invoiceId: string, status?: string): Dispute;
  /** Evidence uploads, for assertions. */
  evidence: Array<{ disputeId: string; filename: string; notes: string }>;
  reset(): void;
}

/**
 * In-memory PayPal for tests, local dev without credentials (PAYPAL_MOCK=true),
 * and teammates who don't have sandbox access yet. Uses the same request builder
 * as the real client, so invalid amounts/currencies fail the same way.
 */
export function createMockPayPalClient(
  opts: { payLinkBase?: string } = {},
): MockPayPalClient {
  const payLinkBase =
    opts.payLinkBase ?? "https://www.sandbox.paypal.com/invoice/p/#";
  const store = new Map<string, Invoice>();
  const calls: MockPayPalClient["calls"] = [];
  let seq = 0;
  const disputes = new Map<string, Dispute>();
  let disputeSeq = 0;

  function mustGet(id: string): Invoice {
    const inv = store.get(id);
    if (!inv) {
      throw new PayPalError({
        status: 404,
        message: `Invoice ${id} not found`,
        paypalName: "RESOURCE_NOT_FOUND",
      });
    }
    return inv;
  }

  function update(id: string, patch: Partial<Invoice>): Invoice {
    const next = { ...mustGet(id), ...patch };
    next.raw = { ...next.raw, status: next.status };
    store.set(id, next);
    return next;
  }

  const client: MockPayPalClient = {
    calls,

    async createInvoice(input) {
      calls.push(["createInvoice", input]);
      const body = buildCreateInvoiceBody(input);
      const number = body.detail.invoice_number;
      if ([...store.values()].some((i) => i.invoiceNumber === number)) {
        throw new PayPalError({
          status: 422,
          message: `Invoice number ${number} already exists`,
          paypalName: "UNPROCESSABLE_ENTITY",
          details: [{ issue: "DUPLICATE_INVOICE_NUMBER" }],
        });
      }
      seq += 1;
      const id = `INV2-MOCK-${String(seq).padStart(4, "0")}`;
      const amount = {
        currency: input.currency,
        value: body.items[0].unit_amount.value,
      };
      const inv: Invoice = {
        id,
        status: "DRAFT",
        invoiceNumber: number,
        amount,
        payLink: null,
        paidAt: null,
        raw: {
          id,
          status: "DRAFT",
          detail: { ...body.detail },
          amount: { currency_code: amount.currency, value: amount.value },
        },
      };
      store.set(id, inv);
      return inv;
    },

    async sendInvoice(id, sendOpts) {
      calls.push(["sendInvoice", id, sendOpts]);
      const inv = mustGet(id);
      if (inv.status !== "DRAFT") {
        throw new PayPalError({
          status: 422,
          message: `Invoice ${id} is ${inv.status}, not DRAFT`,
        });
      }
      return update(id, { status: "SENT", payLink: `${payLinkBase}${id}` });
    },

    async getInvoice(id) {
      calls.push(["getInvoice", id]);
      return mustGet(id);
    },

    async remindInvoice(id, remindOpts) {
      calls.push(["remindInvoice", id, remindOpts]);
      const inv = mustGet(id);
      if (inv.status !== "SENT" && inv.status !== "UNPAID") {
        throw new PayPalError({
          status: 422,
          message: `Cannot remind a ${inv.status} invoice`,
        });
      }
    },

    async cancelInvoice(id, cancelOpts) {
      calls.push(["cancelInvoice", id, cancelOpts]);
      const inv = mustGet(id);
      if (inv.status === "CANCELLED") return;
      if (inv.status === "PAID") {
        throw new PayPalError({
          status: 409,
          message: `Invoice ${id} is PAID`,
          paypalName: "INVOICE_ALREADY_PAID",
        });
      }
      if (inv.status === "DRAFT") {
        store.delete(id);
        return;
      }
      update(id, { status: "CANCELLED" });
    },

    webhookSignatureValid: true,

    async verifyWebhookSignature(input) {
      calls.push(["verifyWebhookSignature", input.headers.transmissionId]);
      return client.webhookSignatureValid;
    },

    async findInvoiceByNumber(number) {
      calls.push(["findInvoiceByNumber", number]);
      return (
        [...store.values()].find((i) => i.invoiceNumber === number) ?? null
      );
    },

    markPaid(id) {
      const inv = mustGet(id);
      if (inv.status !== "SENT" && inv.status !== "UNPAID") {
        throw new Error(`Mock: cannot pay a ${inv.status} invoice`);
      }
      const paidAt = new Date().toISOString();
      const next = update(id, { status: "PAID", paidAt });
      next.raw = {
        ...next.raw,
        payments: {
          transactions: [{ payment_id: `MOCKTX-${id}`, payment_date: paidAt }],
        },
      };
      store.set(id, next);
      return next;
    },

    evidence: [],

    openDispute(invoiceId, status = "WAITING_FOR_SELLER_RESPONSE") {
      const inv = mustGet(invoiceId);
      const transactionId = invoiceTransactionIds(inv)[0];
      if (!transactionId) throw new Error("Mock: pay the invoice first");
      disputeSeq += 1;
      const dispute: Dispute = {
        id: `PP-D-MOCK-${disputeSeq}`,
        status,
        reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        stage: "INQUIRY",
        amount: inv.amount,
        sellerResponseDueDate: null,
        createdAt: new Date().toISOString(),
        transactionIds: [transactionId],
        invoiceNumbers: inv.invoiceNumber ? [inv.invoiceNumber] : [],
      };
      disputes.set(dispute.id, dispute);
      return dispute;
    },

    async listDisputesForTransaction(transactionId) {
      calls.push(["listDisputesForTransaction", transactionId]);
      return [...disputes.values()]
        .filter((d) => d.transactionIds.includes(transactionId))
        .map((d) => ({ ...d, transactionIds: [], invoiceNumbers: [] }));
    },

    async getDispute(id) {
      calls.push(["getDispute", id]);
      const dispute = disputes.get(id);
      if (!dispute) {
        throw new PayPalError({
          status: 404,
          message: `Dispute ${id} not found`,
          paypalName: "RESOURCE_NOT_FOUND",
        });
      }
      return dispute;
    },

    async provideDisputeEvidence(id, input) {
      calls.push(["provideDisputeEvidence", id]);
      const dispute = await client.getDispute(id);
      if (!canProvideEvidence(dispute)) {
        throw new PayPalError({
          status: 422,
          message: `Dispute ${id} is ${dispute.status}`,
          paypalName: "UNPROCESSABLE_ENTITY",
        });
      }
      client.evidence.push({
        disputeId: id,
        filename: input.filename,
        notes: input.notes,
      });
      disputes.set(id, { ...dispute, status: "UNDER_REVIEW" });
    },

    all() {
      return [...store.values()];
    },

    reset() {
      store.clear();
      calls.length = 0;
      seq = 0;
      client.webhookSignatureValid = true;
      disputes.clear();
      disputeSeq = 0;
      client.evidence.length = 0;
    },
  };

  return client;
}
