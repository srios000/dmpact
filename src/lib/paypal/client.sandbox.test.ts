/**
 * Integration test against the real PayPal sandbox. Skipped unless
 * PAYPAL_SANDBOX_TEST=1, so it never runs in CI.
 *
 *   PAYPAL_SANDBOX_TEST=1 PAYPAL_SANDBOX_PERSONAL_EMAIL=sb-...@personal.example.com \
 *     pnpm vitest run src/lib/paypal/client.sandbox.test.ts
 *
 * Reads PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_API_BASE and
 * DEMO_CREATOR_PAYPAL_EMAIL (the sandbox Business account) from .env.
 */
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createPayPalClient } from "./client";

const run = process.env.PAYPAL_SANDBOX_TEST === "1";
if (run && existsSync(".env")) process.loadEnvFile(".env");

describe.skipIf(!run)("PayPal sandbox (integration)", () => {
  const env = process.env;
  const pp = createPayPalClient({
    baseUrl: env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com",
    clientId: env.PAYPAL_CLIENT_ID ?? "",
    clientSecret: env.PAYPAL_CLIENT_SECRET ?? "",
  });
  // unique per run so PayPal doesn't reject the invoice number
  const commissionId = `T${Date.now().toString(36)}`;
  const base = {
    commissionId,
    invoicerEmail:
      env.PAYPAL_SANDBOX_BUSINESS_EMAIL ?? env.DEMO_CREATOR_PAYPAL_EMAIL ?? "",
    recipientEmail: env.PAYPAL_SANDBOX_PERSONAL_EMAIL ?? "",
    itemName: "DMpact integration test",
    dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
  };

  it("has the credentials and test account emails it needs", () => {
    expect(env.PAYPAL_CLIENT_ID, "PAYPAL_CLIENT_ID").toBeTruthy();
    expect(env.PAYPAL_CLIENT_SECRET, "PAYPAL_CLIENT_SECRET").toBeTruthy();
    expect(base.invoicerEmail, "DEMO_CREATOR_PAYPAL_EMAIL").toBeTruthy();
    expect(base.recipientEmail, "PAYPAL_SANDBOX_PERSONAL_EMAIL").toBeTruthy();
  });

  it("create -> send -> find -> remind -> cancel (USD)", async () => {
    const draft = await pp.createInvoice({
      ...base,
      kind: "deposit",
      currency: "USD",
      amount: "1.00",
    });
    expect(draft.status).toBe("DRAFT");

    const sent = await pp.sendInvoice(draft.id);
    expect(["SENT", "UNPAID"]).toContain(sent.status);
    expect(sent.payLink).toMatch(/^https:\/\//);

    const found = await pp.findInvoiceByNumber(draft.invoiceNumber!);
    expect(found?.id).toBe(draft.id);

    await pp.remindInvoice(draft.id);
    await pp.cancelInvoice(draft.id);
    expect((await pp.getInvoice(draft.id)).status).toBe("CANCELLED");
  }, 60_000);

  it("creates a JPY invoice without decimals, then deletes the draft", async () => {
    const draft = await pp.createInvoice({
      ...base,
      kind: "balance",
      currency: "JPY",
      amount: "1500",
    });
    expect(draft.amount).toEqual({ currency: "JPY", value: "1500" });
    await pp.cancelInvoice(draft.id); // DRAFT -> deleted
  }, 60_000);
});
