import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  processWebhookEvent,
  recordWebhookEvent,
} from "@/lib/repositories/webhook-repository";
import { POST } from "./route";

const state = vi.hoisted(() => ({
  env: { PAYPAL_WEBHOOK_ID: "WEBHOOK-1" as string | undefined },
  /** true/false: PayPal's answer; an Error: PayPal can't be reached. */
  verification: true as boolean | Error,
}));

vi.mock("@/lib/env", () => ({ env: state.env }));
vi.mock("@/lib/paypal", () => ({
  getPayPalClient: () => ({
    verifyWebhookSignature: async () => {
      if (state.verification instanceof Error) throw state.verification;
      return state.verification;
    },
  }),
}));
vi.mock("@/lib/repositories/webhook-repository", () => ({
  recordWebhookEvent: vi.fn(),
  processWebhookEvent: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));

const signed = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url":
    "https://api.sandbox.paypal.com/v1/notifications/certs/CERT",
  "paypal-transmission-id": "tx-1",
  "paypal-transmission-sig": "sig",
  "paypal-transmission-time": "2026-11-06T01:00:00Z",
};
const event = {
  id: "WH-1",
  event_type: "INVOICING.INVOICE.PAID",
  resource: { invoice: { id: "INV2-AAAA" } },
};

const post = (body: string, headers: Record<string, string> = signed) =>
  POST(
    new Request("http://test.dev/api/webhooks/paypal", {
      method: "POST",
      headers,
      body,
    }),
  );

/** Runs the callback the route handed to after(). */
async function runAfter() {
  const callback = vi.mocked(after).mock.calls[0]?.[0];
  if (typeof callback === "function") await callback();
}

describe("POST /api/webhooks/paypal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.env.PAYPAL_WEBHOOK_ID = "WEBHOOK-1";
    state.verification = true;
    vi.mocked(recordWebhookEvent).mockResolvedValue({
      isNew: true,
      needsProcessing: true,
    });
    vi.mocked(processWebhookEvent).mockResolvedValue({ commissionId: "c-1" });
  });

  it("rejects requests without PayPal headers or a valid body", async () => {
    expect((await post(JSON.stringify(event), {})).status).toBe(400);
    expect((await post("{not json")).status).toBe(400);
    expect(recordWebhookEvent).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature and stores nothing", async () => {
    state.verification = false;
    const response = await post(JSON.stringify(event));

    expect(response.status).toBe(401);
    expect(recordWebhookEvent).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it("stores the event, answers 200, and processes it in after()", async () => {
    const response = await post(JSON.stringify(event));

    expect(response.status).toBe(200);
    expect(recordWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "WH-1" }),
    );
    expect(processWebhookEvent).not.toHaveBeenCalled();

    await runAfter();
    expect(processWebhookEvent).toHaveBeenCalledWith("WH-1");
    expect(revalidateTag).toHaveBeenCalledWith("commission-c-1", {
      expire: 0,
    });
  });

  it("treats a redelivered, already processed event as a no-op", async () => {
    vi.mocked(recordWebhookEvent).mockResolvedValue({
      isNew: false,
      needsProcessing: false,
    });
    const response = await post(JSON.stringify(event));

    expect(response.status).toBe(200);
    expect(after).not.toHaveBeenCalled();
  });

  it("processes a redelivered event whose earlier processing failed", async () => {
    vi.mocked(recordWebhookEvent).mockResolvedValue({
      isNew: false,
      needsProcessing: true,
    });
    const response = await post(JSON.stringify(event));

    expect(response.status).toBe(200);
    await runAfter();
    expect(processWebhookEvent).toHaveBeenCalledWith("WH-1");
  });

  it("asks PayPal to retry when it can't verify", async () => {
    state.verification = new Error("PayPal unreachable");
    expect((await post(JSON.stringify(event))).status).toBe(500);

    state.verification = true;
    state.env.PAYPAL_WEBHOOK_ID = undefined;
    expect((await post(JSON.stringify(event))).status).toBe(500);
    expect(recordWebhookEvent).not.toHaveBeenCalled();
  });
});
