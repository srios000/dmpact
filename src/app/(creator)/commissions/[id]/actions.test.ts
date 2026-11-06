import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateTag } from "next/cache";
import { retryDepositInvoice as retryInRepository } from "@/lib/repositories/commission-repository";
import { RepositoryError } from "@/lib/repositories/errors";
import { retryDepositInvoice } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: vi.fn() }));
vi.mock("@/lib/repositories/agreement-repository", () => ({}));
vi.mock("@/lib/repositories/commission-repository", () => ({
  retryDepositInvoice: vi.fn(),
}));

const retry = vi.mocked(retryInRepository);
const tags = vi.mocked(updateTag);
const commissionId = "6f1c1b62-6a56-4f38-9a0a-1f6f1d1e2a10";

describe("retryDepositInvoice action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the invoice and refreshes the commission", async () => {
    const sent = {
      status: "sent" as const,
      invoiceId: "invoice",
      paypalInvoiceId: "INV2-MOCK-0001",
      payLink: "https://paypal.test/pay",
    };
    retry.mockResolvedValue(sent);

    await expect(retryDepositInvoice({ commissionId })).resolves.toEqual({
      ok: true,
      data: sent,
    });
    expect(retry).toHaveBeenCalledWith(commissionId);
    expect(tags).toHaveBeenCalledWith(`commission-${commissionId}`);
  });

  it("rejects a bad commission id before touching PayPal", async () => {
    const response = await retryDepositInvoice({ commissionId: "nope" });
    expect(response).toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
    expect(retry).not.toHaveBeenCalled();
  });

  it("refuses commissions that can't be retried", async () => {
    retry.mockRejectedValue(
      new RepositoryError(
        "retry_not_allowed",
        "There is no deposit invoice to send again.",
      ),
    );
    await expect(retryDepositInvoice({ commissionId })).resolves.toEqual({
      ok: false,
      error: {
        code: "retry_not_allowed",
        message: "There is no deposit invoice to send again.",
      },
    });
    expect(tags).not.toHaveBeenCalled();
  });

  it("returns PayPal's error and refreshes so the page shows it", async () => {
    retry.mockRejectedValue(
      new RepositoryError("invoice_failed", "PayPal is down"),
    );
    await expect(retryDepositInvoice({ commissionId })).resolves.toEqual({
      ok: false,
      error: { code: "invoice_failed", message: "PayPal is down" },
    });
    expect(tags).toHaveBeenCalledWith(`commission-${commissionId}`);
  });

  it("does not hide unexpected errors", async () => {
    retry.mockRejectedValue(new Error("boom"));
    await expect(retryDepositInvoice({ commissionId })).rejects.toThrow("boom");
  });
});
