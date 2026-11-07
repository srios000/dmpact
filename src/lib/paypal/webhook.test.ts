import { describe, expect, it } from "vitest";
import { buildVerifyWebhookBody } from "./client";
import {
  invoiceFromEvent,
  parseWebhookEvent,
  readWebhookHeaders,
} from "./webhook";

const signed = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url":
    "https://api.sandbox.paypal.com/v1/notifications/certs/CERT",
  "paypal-transmission-id": "tx-1",
  "paypal-transmission-sig": "sig",
  "paypal-transmission-time": "2026-11-06T01:00:00Z",
};

describe("readWebhookHeaders", () => {
  it("reads all five signing headers", () => {
    expect(readWebhookHeaders(new Headers(signed))).toEqual({
      authAlgo: "SHA256withRSA",
      certUrl: signed["paypal-cert-url"],
      transmissionId: "tx-1",
      transmissionSig: "sig",
      transmissionTime: "2026-11-06T01:00:00Z",
    });
  });

  it("returns null when one is missing", () => {
    const partial = new Headers(signed);
    partial.delete("paypal-transmission-sig");
    expect(readWebhookHeaders(partial)).toBeNull();
  });
});

describe("parseWebhookEvent", () => {
  it("parses text and objects", () => {
    const event = { id: "WH-1", event_type: "INVOICING.INVOICE.PAID" };
    expect(parseWebhookEvent(JSON.stringify(event))).toMatchObject(event);
    expect(parseWebhookEvent(event)).toMatchObject(event);
  });

  it("rejects invalid JSON and events without an id", () => {
    expect(parseWebhookEvent("{not json")).toBeNull();
    expect(parseWebhookEvent('{"event_type":"X"}')).toBeNull();
  });
});

describe("invoiceFromEvent", () => {
  it("reads the nested invoice and the event time", () => {
    const event = parseWebhookEvent({
      id: "WH-1",
      event_type: "INVOICING.INVOICE.PAID",
      create_time: "2026-11-06T01:02:03Z",
      resource: { invoice: { id: "INV2-AAAA", status: "PAID" } },
    })!;
    expect(invoiceFromEvent(event)).toEqual({
      paypalInvoiceId: "INV2-AAAA",
      paidAt: "2026-11-06T01:02:03Z",
    });
  });

  it("accepts a bare invoice resource and falls back to the payment date", () => {
    const event = parseWebhookEvent({
      id: "WH-2",
      event_type: "INVOICING.INVOICE.PAID",
      resource: {
        id: "INV2-BBBB",
        payments: { transactions: [{ payment_date: "2026-11-05" }] },
      },
    })!;
    expect(invoiceFromEvent(event)).toEqual({
      paypalInvoiceId: "INV2-BBBB",
      paidAt: "2026-11-05",
    });
  });

  it("returns null when there is no invoice", () => {
    const event = parseWebhookEvent({ id: "WH-3", event_type: "X" })!;
    expect(invoiceFromEvent(event)).toBeNull();
  });
});

describe("buildVerifyWebhookBody", () => {
  it("embeds the raw event text unchanged", () => {
    const rawBody = '{"id":"WH-1","amount":{"value":1.10},"note":"caf\\u00e9"}';
    const body = buildVerifyWebhookBody({
      headers: readWebhookHeaders(new Headers(signed))!,
      webhookId: "WEBHOOK-1",
      rawBody,
    });

    expect(body.endsWith(`"webhook_event":${rawBody}}`)).toBe(true);
    expect(JSON.parse(body)).toMatchObject({
      auth_algo: "SHA256withRSA",
      transmission_id: "tx-1",
      webhook_id: "WEBHOOK-1",
      webhook_event: { id: "WH-1" },
    });
  });
});
