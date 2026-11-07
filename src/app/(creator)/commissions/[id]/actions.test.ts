import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateTag } from "next/cache";
import {
  retryBalanceInvoice as retryBalanceInRepository,
  retryDepositInvoice as retryDepositInRepository,
} from "@/lib/repositories/commission-repository";
import * as deliveries from "@/lib/repositories/delivery-repository";
import { RepositoryError } from "@/lib/repositories/errors";
import * as disputeRepo from "@/lib/repositories/dispute-repository";
import { runCommissionReminder } from "@/lib/repositories/overdue-repository";
import {
  createDeliveryUpload,
  recordDelivery,
  retryBalanceInvoice,
  retryDepositInvoice,
  listDisputes,
  runReminder,
  sendDisputeEvidence,
} from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: vi.fn() }));
vi.mock("@/lib/repositories/agreement-repository", () => ({}));
vi.mock("@/lib/repositories/delivery-repository", () => ({
  createDeliveryUpload: vi.fn(),
  recordDelivery: vi.fn(),
}));
vi.mock("@/lib/repositories/commission-repository", () => ({
  retryDepositInvoice: vi.fn(),
  retryBalanceInvoice: vi.fn(),
}));
// Imported by suggestCounteroffers, which these tests don't exercise.
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/repositories/rate-card-repository", () => ({}));
vi.mock("@/lib/repositories/dispute-repository", () => ({
  listCommissionDisputes: vi.fn(),
  sendDisputeEvidence: vi.fn(),
}));
vi.mock("@/lib/repositories/overdue-repository", () => ({
  runCommissionReminder: vi.fn(),
}));
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

describe("delivery actions", () => {
  const upload = {
    commissionId,
    filename: "final.png",
    mimeType: "image/png",
    sizeBytes: 2048,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the signed upload without refreshing the page", async () => {
    const ticket = {
      uploadId: "0f8fad5b-d9cb-469f-a165-70867728950e",
      url: "https://bucket.test/put",
      method: "PUT" as const,
      headers: { "Content-Type": "image/png" },
      expiresAt: "2026-11-06T00:05:00.000Z",
    };
    vi.mocked(deliveries.createDeliveryUpload).mockResolvedValue(ticket);

    await expect(createDeliveryUpload(upload)).resolves.toEqual({
      ok: true,
      data: ticket,
    });
    expect(deliveries.createDeliveryUpload).toHaveBeenCalledWith(upload);
    expect(tags).not.toHaveBeenCalled();
  });

  it.each([
    { sizeBytes: 25 * 1024 * 1024 + 1 },
    { mimeType: "application/x-msdownload" },
  ])("refuses %j before signing anything", async (change) => {
    const response = await createDeliveryUpload({ ...upload, ...change });
    expect(response).toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
    expect(deliveries.createDeliveryUpload).not.toHaveBeenCalled();
  });

  it("records the delivery and refreshes the commission", async () => {
    const recorded = {
      delivery: {
        id: "d",
        filename: "final.png",
        sha256: "a".repeat(64),
        sizeBytes: 2048,
        mimeType: "image/png",
        isFinal: true,
        loggedAt: "2026-11-06T00:00:00.000Z",
      },
      state: "delivered" as const,
      failedEffects: [],
    };
    vi.mocked(deliveries.recordDelivery).mockResolvedValue(recorded);
    const input = {
      commissionId,
      uploadId: "0f8fad5b-d9cb-469f-a165-70867728950e",
      filename: "final.png",
      isFinal: true,
    };

    await expect(recordDelivery(input)).resolves.toEqual({
      ok: true,
      data: recorded,
    });
    expect(tags).toHaveBeenCalledWith(`commission-${commissionId}`);
  });

  it("returns repository refusals as action failures", async () => {
    vi.mocked(deliveries.recordDelivery).mockRejectedValue(
      new RepositoryError("invalid_upload", "The upload wasn't found."),
    );
    await expect(
      recordDelivery({
        commissionId,
        uploadId: "0f8fad5b-d9cb-469f-a165-70867728950e",
        filename: "final.png",
        isFinal: false,
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: "invalid_upload", message: "The upload wasn't found." },
    });
    expect(tags).not.toHaveBeenCalled();
  });
});

describe("runReminder action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const nudge = {
    invoiceId: "inv-1",
    kind: "balance" as const,
    message: "Hi Ren! The remaining balance of 75.00 USD is overdue.",
    tone: "firm" as const,
    daysOverdue: 5,
    remindedAtPayPal: true,
    at: "2026-11-10T01:00:00.000Z",
  };

  it("reminds and refreshes when something was sent", async () => {
    vi.mocked(runCommissionReminder).mockResolvedValue({
      outcomes: [
        { invoiceId: "inv-1", commissionId, status: "reminded", nudge },
      ],
      nudge,
    });

    await expect(runReminder({ commissionId })).resolves.toEqual({
      ok: true,
      data: { reminded: 1, nudge },
    });
    expect(runCommissionReminder).toHaveBeenCalledWith(commissionId, {
      model: null,
    });
    expect(tags).toHaveBeenCalledWith(`commission-${commissionId}`);
  });

  it("returns the latest nudge without refreshing when nothing was sent", async () => {
    vi.mocked(runCommissionReminder).mockResolvedValue({
      outcomes: [],
      nudge,
    });

    await expect(runReminder({ commissionId })).resolves.toEqual({
      ok: true,
      data: { reminded: 0, nudge },
    });
    expect(tags).not.toHaveBeenCalled();
  });

  it("rejects a bad commission id", async () => {
    const result = await runReminder({ commissionId: "nope" });
    expect(result.ok).toBe(false);
    expect(runCommissionReminder).not.toHaveBeenCalled();
  });
});

describe("dispute actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const dispute = {
    id: "PP-D-27803",
    invoiceKind: "balance" as const,
    transactionId: "TX1",
    status: "WAITING_FOR_SELLER_RESPONSE",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    stage: "INQUIRY",
    amount: { currency: "USD", value: "75.00" },
    sellerResponseDueDate: null,
    canProvideEvidence: true,
  };

  it("lists the commission's disputes", async () => {
    vi.mocked(disputeRepo.listCommissionDisputes).mockResolvedValue([dispute]);
    await expect(listDisputes({ commissionId })).resolves.toEqual({
      ok: true,
      data: [dispute],
    });
  });

  it("sends evidence and refreshes the commission", async () => {
    vi.mocked(disputeRepo.sendDisputeEvidence).mockResolvedValue({
      ...dispute,
      canProvideEvidence: false,
    });
    const result = await sendDisputeEvidence({
      commissionId,
      disputeId: "PP-D-27803",
    });

    expect(result).toMatchObject({ ok: true });
    expect(disputeRepo.sendDisputeEvidence).toHaveBeenCalledWith(
      commissionId,
      "PP-D-27803",
    );
    expect(tags).toHaveBeenCalledWith(`commission-${commissionId}`);
  });

  it("returns PayPal failures as a message", async () => {
    vi.mocked(disputeRepo.sendDisputeEvidence).mockRejectedValue(
      new RepositoryError("dispute_failed", "PayPal couldn't complete it."),
    );
    await expect(
      sendDisputeEvidence({ commissionId, disputeId: "PP-D-27803" }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "dispute_failed",
        message: "PayPal couldn't complete it.",
      },
    });
  });

  it("rejects a malformed dispute id", async () => {
    const result = await sendDisputeEvidence({
      commissionId,
      disputeId: "not a dispute!",
    });
    expect(result.ok).toBe(false);
    expect(disputeRepo.sendDisputeEvidence).not.toHaveBeenCalled();
  });
});
