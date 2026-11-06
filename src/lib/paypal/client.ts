import { toPayPalValue } from "./currency";
import { PayPalError, toPayPalError } from "./errors";
import { invoiceNumber } from "./invoice-number";
import { createTokenProvider, type TokenProvider } from "./token";
import {
  paypalInvoiceSchema,
  toDbInvoiceStatus,
  type CreateInvoiceInput,
  type Invoice,
  type MessageOptions,
  type PayPalClient,
  type VerifyWebhookInput,
} from "./types";

export type PayPalClientOptions = {
  /** https://api-m.sandbox.paypal.com */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  /** Inject a token provider (tests). Defaults to one built from the credentials. */
  tokenProvider?: TokenProvider;
};

export function normalizeInvoice(raw: unknown): Invoice {
  const inv = paypalInvoiceSchema.parse(raw);
  const transactions = inv.payments?.transactions ?? [];
  const last = transactions.at(-1);
  return {
    id: inv.id,
    status: inv.status,
    invoiceNumber: inv.detail.invoice_number ?? null,
    amount: inv.amount
      ? { currency: inv.amount.currency_code, value: inv.amount.value }
      : null,
    payLink: inv.detail.metadata?.recipient_view_url ?? null,
    paidAt: last?.payment_date ?? null,
    raw: inv,
  };
}

export function buildCreateInvoiceBody(input: CreateInvoiceInput) {
  const value = toPayPalValue(input.amount, input.currency);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    throw new Error(`dueDate must be YYYY-MM-DD, got "${input.dueDate}"`);
  }
  return {
    detail: {
      currency_code: input.currency,
      invoice_number: invoiceNumber(
        input.commissionId,
        input.kind,
        input.attempt,
      ),
      ...(input.note ? { note: input.note } : {}),
      payment_term: { due_date: input.dueDate },
    },
    invoicer: { email_address: input.invoicerEmail },
    primary_recipients: [
      {
        billing_info: {
          email_address: input.recipientEmail,
          ...(input.recipientName
            ? { name: { full_name: input.recipientName } }
            : {}),
        },
      },
    ],
    items: [
      {
        name: input.itemName.slice(0, 200),
        ...(input.itemDescription
          ? { description: input.itemDescription.slice(0, 1000) }
          : {}),
        quantity: "1",
        unit_amount: { currency_code: input.currency, value },
        unit_of_measure: "QUANTITY",
      },
    ],
  };
}

/**
 * Body for /v1/notifications/verify-webhook-signature. The event is embedded
 * as the raw text PayPal sent, because parsing and re-serializing it can
 * change the bytes (number formats, escaping) and fail verification.
 */
export function buildVerifyWebhookBody({
  headers,
  webhookId,
  rawBody,
}: VerifyWebhookInput): string {
  const fields = {
    auth_algo: headers.authAlgo,
    cert_url: headers.certUrl,
    transmission_id: headers.transmissionId,
    transmission_sig: headers.transmissionSig,
    transmission_time: headers.transmissionTime,
    webhook_id: webhookId,
  };
  const head = JSON.stringify(fields).slice(0, -1);
  return `${head},"webhook_event":${rawBody}}`;
}

function messageBody(opts: MessageOptions = {}) {
  return {
    send_to_recipient: true,
    send_to_invoicer: false,
    ...(opts.subject ? { subject: opts.subject } : {}),
    ...(opts.note ? { note: opts.note } : {}),
  };
}

export function createPayPalClient(opts: PayPalClientOptions): PayPalClient {
  const doFetch = opts.fetch ?? fetch;
  const tokens =
    opts.tokenProvider ??
    createTokenProvider({
      baseUrl: opts.baseUrl,
      clientId: opts.clientId,
      clientSecret: opts.clientSecret,
      fetch: doFetch,
    });

  /** Authenticated request. Retries once with a fresh token on 401. */
  async function request(
    method: "GET" | "POST" | "DELETE",
    path: string,
    context: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const token = await tokens.getToken();
      const res = await doFetch(`${opts.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...extraHeaders,
        },
        body:
          body === undefined
            ? undefined
            : typeof body === "string"
              ? body
              : JSON.stringify(body),
        cache: "no-store",
      });
      if (res.status === 401 && attempt === 0) {
        tokens.invalidate();
        continue;
      }
      if (!res.ok) throw await toPayPalError(res, context);
      return res;
    }
  }

  const path = (id: string, action = "") =>
    `/v2/invoicing/invoices/${encodeURIComponent(id)}${action}`;

  const client: PayPalClient = {
    async createInvoice(input) {
      const res = await request(
        "POST",
        "/v2/invoicing/invoices",
        "create invoice",
        buildCreateInvoiceBody(input),
        { Prefer: "return=representation" },
      );
      return normalizeInvoice(await res.json());
    },

    async sendInvoice(id, sendOpts) {
      await request("POST", path(id, "/send"), "send invoice", {
        ...messageBody(sendOpts),
      });
      // /send only returns links; re-fetch for status and recipient_view_url
      return client.getInvoice(id);
    },

    async getInvoice(id) {
      const res = await request("GET", path(id), "get invoice");
      return normalizeInvoice(await res.json());
    },

    async remindInvoice(id, remindOpts) {
      await request(
        "POST",
        path(id, "/remind"),
        "remind invoice",
        messageBody(remindOpts),
      );
    },

    async cancelInvoice(id, cancelOpts = {}) {
      const current = await client.getInvoice(id);
      if (current.status === "CANCELLED") return;
      if (
        toDbInvoiceStatus(current.status) === "paid" ||
        current.status === "PARTIALLY_PAID"
      ) {
        throw new PayPalError({
          status: 409,
          message: `Invoice ${id} is ${current.status} and cannot be cancelled`,
          paypalName: "INVOICE_ALREADY_PAID",
        });
      }
      if (current.status === "DRAFT") {
        // PayPal only cancels sent invoices; drafts are deleted instead.
        await request("DELETE", path(id), "delete draft invoice");
        return;
      }
      await request(
        "POST",
        path(id, "/cancel"),
        "cancel invoice",
        messageBody({ note: cancelOpts.note }),
      );
    },

    async findInvoiceByNumber(number) {
      const res = await request(
        "POST",
        "/v2/invoicing/search-invoices?page=1&page_size=5",
        "search invoices",
        { invoice_number: number },
      );
      const data = (await res.json()) as { items?: unknown[] };
      const match = (data.items ?? [])
        .map((item) => normalizeInvoice(item))
        .find((item) => item.invoiceNumber === number);
      // search results are summaries; fetch the full invoice for payLink etc.
      return match ? client.getInvoice(match.id) : null;
    },

    async verifyWebhookSignature(input) {
      const res = await request(
        "POST",
        "/v1/notifications/verify-webhook-signature",
        "verify webhook signature",
        buildVerifyWebhookBody(input),
      );
      const data = (await res.json()) as { verification_status?: string };
      return data.verification_status === "SUCCESS";
    },
  };

  return client;
}
