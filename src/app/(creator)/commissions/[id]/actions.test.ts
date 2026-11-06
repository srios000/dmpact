import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateTag } from "next/cache";
import {
  retryBalanceInvoice as retryBalanceInRepository,
  retryDepositInvoice as retryDepositInRepository,
} from "@/lib/repositories/commission-repository";
import { RepositoryError } from "@/lib/repositories/errors";
import { retryBalanceInvoice, retryDepositInvoice } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: vi.fn() }));
vi.mock("@/lib/repositories/agreement-repository", () => ({}));
vi.mock("@/lib/repositories/commission-repository", () => ({
  retryDepositInvoice: vi.fn(),
  retryBalanceInvoice: vi.fn(),
}));
// Imported by suggestCounteroffers, which these tests don't exercise.
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/repositories/rate-card-repository", () => ({}));
vi.mock("@/lib/repositories/shared", () => ({ notFound: vi.fn() }));

const retryDeposit = vi.mocked(retryDepositInRepository);
const retryBalance = vi.mocked(retryBalanceInRepository);
const tags = vi.mocked(updateTag);
const commissionId = "6f1c1b62-6a56-4f38-9a0a-1f6f1d1e2a10";

describe("retryDepositInvoice / retryBalanceInvoice actions", () => {
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
    retryDeposit.mockResolvedValue(sent);
    retryBalance.mockResolvedValue(sent);

    await expect(retryDepositInvoice({ commissionId })).resolves.toEqual({
      ok: true,
      data: sent,
    });
    expect(retryDeposit).toHaveBeenCalledWith(commissionId);
    expect(tags).toHaveBeenCalledWith(`commission-${commissionId}`);

    await expect(retryBalanceInvoice({ commissionId })).resolves.toEqual({
      ok: true,
      data: sent,
    });
    expect(retryBalance).toHaveBeenCalledWith(commissionId);
  });

  it("rejects a bad commission id before touching PayPal", async () => {
    const response = await retryDepositInvoice({ commissionId: "nope" });
    expect(response).toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
    expect(retryDeposit).not.toHaveBeenCalled();

    const balanceResponse = await retryBalanceInvoice({ commissionId: "nope" });
    expect(balanceResponse).toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
    expect(retryBalance).not.toHaveBeenCalled();
  });

  it("refuses commissions that can't be retried", async () => {
    retryDeposit.mockRejectedValue(
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
    retryDeposit.mockRejectedValue(
      new RepositoryError("invoice_failed", "PayPal is down"),
    );
    await expect(retryDepositInvoice({ commissionId })).resolves.toEqual({
      ok: false,
      error: { code: "invoice_failed", message: "PayPal is down" },
    });
    expect(tags).toHaveBeenCalledWith(`commission-${commissionId}`);
  });

  it("does not hide unexpected errors", async () => {
    retryDeposit.mockRejectedValue(new Error("boom"));
    await expect(retryDepositInvoice({ commissionId })).rejects.toThrow("boom");
  });
});
