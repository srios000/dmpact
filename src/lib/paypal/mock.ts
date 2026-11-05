import { buildCreateInvoiceBody } from "./client";
import { PayPalError } from "./errors";
import type { Invoice, PayPalClient } from "./types";

export interface MockPayPalClient extends PayPalClient {
  /** Simulate the client paying (what the webhook would report). */
  markPaid(id: string): Invoice;
  /** All invoices, for assertions. */
  all(): Invoice[];
  /** Calls made, e.g. [["remindInvoice", "INV2-MOCK-0001"]]. */
  calls: Array<[method: string, ...args: unknown[]]>;
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
      return update(id, { status: "PAID", paidAt: new Date().toISOString() });
    },

    all() {
      return [...store.values()];
    },

    reset() {
      store.clear();
      calls.length = 0;
      seq = 0;
    },
  };

  return client;
}
