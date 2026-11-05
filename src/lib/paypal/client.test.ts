import { describe, expect, it } from "vitest";
import { buildCreateInvoiceBody, createPayPalClient } from "./client";
import { PayPalError } from "./errors";
import { invoiceNumber } from "./invoice-number";
import type { TokenProvider } from "./token";
import { toDbInvoiceStatus, type CreateInvoiceInput } from "./types";

const input: CreateInvoiceInput = {
  commissionId: "3f9a2c1e-7b4d-4e2a-9c1f-000000000000",
  kind: "deposit",
  invoicerEmail: "creator@business.example.com",
  recipientEmail: "client@personal.example.com",
  recipientName: "Ren",
  currency: "USD",
  amount: "75",
  itemName: "Deposit (50%)",
  dueDate: "2026-11-07",
};

type Route = (
  url: string,
  init: RequestInit,
) => { status: number; body?: unknown };

function fakeFetch(route: Route) {
  const calls: Array<{
    url: string;
    method: string;
    body: unknown;
    headers: Record<string, string>;
  }> = [];
  const fn = (async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    });
    const r = route(url, init);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
    });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

function staticTokens(): TokenProvider & { invalidated: number; n: number } {
  return {
    invalidated: 0,
    n: 0,
    async getToken() {
      this.n += 1;
      return `T${this.n}`;
    },
    invalidate() {
      this.invalidated += 1;
    },
  };
}

const raw = (
  id: string,
  status: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  status,
  detail: {
    invoice_number: "CD-3F9A2C1E-DP",
    metadata: { recipient_view_url: `https://pay/${id}` },
  },
  amount: { currency_code: "USD", value: "75.00" },
  ...extra,
});

describe("invoiceNumber", () => {
  it("follows CD-<commission>-DP / -BAL", () => {
    expect(invoiceNumber(input.commissionId, "deposit")).toBe("CD-3F9A2C1E-DP");
    expect(invoiceNumber(input.commissionId, "balance")).toBe(
      "CD-3F9A2C1E-BAL",
    );
    expect(invoiceNumber(input.commissionId, "balance", 2)).toBe(
      "CD-3F9A2C1E-BAL-2",
    );
  });
});

describe("buildCreateInvoiceBody", () => {
  it("formats amounts per currency", () => {
    expect(buildCreateInvoiceBody(input).items[0].unit_amount).toEqual({
      currency_code: "USD",
      value: "75.00",
    });
    const jpy = buildCreateInvoiceBody({
      ...input,
      currency: "JPY",
      amount: "15000",
    });
    expect(jpy.items[0].unit_amount).toEqual({
      currency_code: "JPY",
      value: "15000",
    });
    expect(jpy.detail.currency_code).toBe("JPY");
  });

  it("rejects IDR and bad due dates before calling PayPal", () => {
    expect(() => buildCreateInvoiceBody({ ...input, currency: "IDR" })).toThrow(
      /not supported/,
    );
    expect(() =>
      buildCreateInvoiceBody({ ...input, dueDate: "07/11/2026" }),
    ).toThrow(/YYYY-MM-DD/);
  });
});

describe("createPayPalClient", () => {
  const base = "https://api-m.sandbox.paypal.com";

  it("createInvoice posts the body and normalizes the response", async () => {
    const f = fakeFetch(() => ({ status: 201, body: raw("INV2-1", "DRAFT") }));
    const c = createPayPalClient({
      baseUrl: base,
      clientId: "",
      clientSecret: "",
      fetch: f.fn,
      tokenProvider: staticTokens(),
    });
    const inv = await c.createInvoice(input);

    expect(f.calls[0].url).toBe(`${base}/v2/invoicing/invoices`);
    expect(f.calls[0].headers.Prefer).toBe("return=representation");
    const sent = f.calls[0].body as { detail: { invoice_number: string } };
    expect(sent.detail.invoice_number).toBe("CD-3F9A2C1E-DP");
    expect(inv).toMatchObject({
      id: "INV2-1",
      status: "DRAFT",
      invoiceNumber: "CD-3F9A2C1E-DP",
      payLink: "https://pay/INV2-1",
    });
  });

  it("retries once with a new token on 401", async () => {
    let n = 0;
    const f = fakeFetch(() =>
      ++n === 1
        ? { status: 401, body: {} }
        : { status: 200, body: raw("INV2-1", "SENT") },
    );
    const tokens = staticTokens();
    const c = createPayPalClient({
      baseUrl: base,
      clientId: "",
      clientSecret: "",
      fetch: f.fn,
      tokenProvider: tokens,
    });
    const inv = await c.getInvoice("INV2-1");

    expect(inv.status).toBe("SENT");
    expect(tokens.invalidated).toBe(1);
    expect(f.calls[1].headers.Authorization).toBe("Bearer T2");
  });

  it("sendInvoice re-fetches to return the pay link", async () => {
    const f = fakeFetch((url) =>
      url.endsWith("/send")
        ? { status: 200, body: { links: [] } }
        : { status: 200, body: raw("INV2-1", "SENT") },
    );
    const c = createPayPalClient({
      baseUrl: base,
      clientId: "",
      clientSecret: "",
      fetch: f.fn,
      tokenProvider: staticTokens(),
    });
    const inv = await c.sendInvoice("INV2-1");

    expect(
      f.calls.map((x) => `${x.method} ${x.url.replace(base, "")}`),
    ).toEqual([
      "POST /v2/invoicing/invoices/INV2-1/send",
      "GET /v2/invoicing/invoices/INV2-1",
    ]);
    expect(inv.payLink).toBe("https://pay/INV2-1");
  });

  it("cancelInvoice deletes drafts, cancels sent, skips cancelled, refuses paid", async () => {
    for (const [status, expected] of [
      ["DRAFT", "DELETE /v2/invoicing/invoices/INV2-1"],
      ["SENT", "POST /v2/invoicing/invoices/INV2-1/cancel"],
      ["CANCELLED", null],
    ] as const) {
      const f = fakeFetch((_url, init) =>
        init.method === "GET" || !init.method
          ? { status: 200, body: raw("INV2-1", status) }
          : { status: 204 },
      );
      const c = createPayPalClient({
        baseUrl: base,
        clientId: "",
        clientSecret: "",
        fetch: f.fn,
        tokenProvider: staticTokens(),
      });
      await c.cancelInvoice("INV2-1");
      const second = f.calls[1]
        ? `${f.calls[1].method} ${f.calls[1].url.replace(base, "")}`
        : null;
      expect(second).toBe(expected);
    }

    const f = fakeFetch(() => ({ status: 200, body: raw("INV2-1", "PAID") }));
    const c = createPayPalClient({
      baseUrl: base,
      clientId: "",
      clientSecret: "",
      fetch: f.fn,
      tokenProvider: staticTokens(),
    });
    await expect(c.cancelInvoice("INV2-1")).rejects.toThrow(/PAID/);
  });

  it("turns PayPal errors into PayPalError with debug id and duplicate flag", async () => {
    const f = fakeFetch(() => ({
      status: 422,
      body: {
        name: "UNPROCESSABLE_ENTITY",
        message: "Invoice number exists",
        debug_id: "abc123",
        details: [{ issue: "DUPLICATE_INVOICE_NUMBER" }],
      },
    }));
    const c = createPayPalClient({
      baseUrl: base,
      clientId: "",
      clientSecret: "",
      fetch: f.fn,
      tokenProvider: staticTokens(),
    });
    const err = await c.createInvoice(input).catch((e) => e);

    expect(err).toBeInstanceOf(PayPalError);
    expect(err.status).toBe(422);
    expect(err.debugId).toBe("abc123");
    expect(err.isDuplicateInvoiceNumber).toBe(true);
  });

  it("reports paidAt from the latest transaction", async () => {
    const f = fakeFetch(() => ({
      status: 200,
      body: raw("INV2-1", "PAID", {
        payments: {
          transactions: [
            { payment_date: "2026-11-02" },
            { payment_date: "2026-11-03" },
          ],
        },
      }),
    }));
    const c = createPayPalClient({
      baseUrl: base,
      clientId: "",
      clientSecret: "",
      fetch: f.fn,
      tokenProvider: staticTokens(),
    });
    expect((await c.getInvoice("INV2-1")).paidAt).toBe("2026-11-03");
  });
});

describe("toDbInvoiceStatus", () => {
  it("maps PayPal statuses to the invoices.status enum", () => {
    expect(toDbInvoiceStatus("DRAFT")).toBe("draft");
    expect(toDbInvoiceStatus("SENT")).toBe("sent");
    expect(toDbInvoiceStatus("UNPAID")).toBe("sent");
    expect(toDbInvoiceStatus("PARTIALLY_PAID")).toBe("sent");
    expect(toDbInvoiceStatus("PAID")).toBe("paid");
    expect(toDbInvoiceStatus("MARKED_AS_PAID")).toBe("paid");
    expect(toDbInvoiceStatus("CANCELLED")).toBe("cancelled");
  });
});
