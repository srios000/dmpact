import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateTag } from "next/cache";
import * as agreements from "@/lib/repositories/agreement-repository";
import { RepositoryError } from "@/lib/repositories/errors";
import { requestDeliveryDownload } from "@/lib/repositories/delivery-repository";
import { confirmAgreement, downloadDelivery, requestChanges } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "Mozilla/5.0 test" }),
}));
vi.mock("@/lib/repositories/delivery-repository", () => ({
  requestDeliveryDownload: vi.fn(),
}));
vi.mock("@/lib/repositories/agreement-repository", () => ({
  confirmAgreement: vi.fn(),
  requestChanges: vi.fn(),
}));

const validToken = "a".repeat(22);
const validHash = "b".repeat(64);
const commissionId = "11111111-2222-3333-4444-555555555555";

describe("client actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("confirmAgreement", () => {
    it("returns invalid input if token or versionHash is invalid", async () => {
      const result = await confirmAgreement("short", validHash);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("invalid_input");
      }
    });

    it("confirms the agreement, refreshes caches, and returns new state", async () => {
      vi.mocked(agreements.confirmAgreement).mockResolvedValueOnce({
        commissionId,
        state: "agreed",
        steps: [],
      } as never);

      const result = await confirmAgreement(validToken, validHash);
      expect(result).toEqual({ ok: true, data: { state: "agreed" } });
      expect(agreements.confirmAgreement).toHaveBeenCalledWith({
        token: validToken,
        versionHash: validHash,
      });
      expect(updateTag).toHaveBeenCalledWith("commissions");
      expect(updateTag).toHaveBeenCalledWith(`commission-${commissionId}`);
    });

    it("converts repository errors to action failure", async () => {
      vi.mocked(agreements.confirmAgreement).mockRejectedValueOnce(
        new RepositoryError("stale_version", "The agreement changed."),
      );

      const result = await confirmAgreement(validToken, validHash);
      expect(result).toEqual({
        ok: false,
        error: {
          code: "stale_version",
          message: "The agreement changed.",
        },
      });
    });
  });

  describe("requestChanges", () => {
    it("returns invalid input if message is empty", async () => {
      const result = await requestChanges(validToken, "   ");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("invalid_input");
      }
    });

    it("submits change request and returns new version", async () => {
      vi.mocked(agreements.requestChanges).mockResolvedValueOnce({
        commissionId,
        version: 3,
      } as never);

      const result = await requestChanges(
        validToken,
        "Please change color to blue",
      );
      expect(result).toEqual({ ok: true, data: { version: 3 } });
      expect(agreements.requestChanges).toHaveBeenCalledWith({
        token: validToken,
        message: "Please change color to blue",
      });
      expect(updateTag).toHaveBeenCalledWith("commissions");
      expect(updateTag).toHaveBeenCalledWith(`commission-${commissionId}`);
    });
  });
});

describe("downloadDelivery", () => {
  const deliveryId = "0f8fad5b-d9cb-469f-a165-70867728950e";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs the request with the browser's user agent and returns the link", async () => {
    vi.mocked(requestDeliveryDownload).mockResolvedValue({
      commissionId,
      url: "https://bucket.test/get",
      filename: "final.png",
      expiresAt: "2026-11-06T00:05:00.000Z",
    });

    await expect(downloadDelivery(validToken, deliveryId)).resolves.toEqual({
      ok: true,
      data: {
        url: "https://bucket.test/get",
        filename: "final.png",
        expiresAt: "2026-11-06T00:05:00.000Z",
      },
    });
    expect(requestDeliveryDownload).toHaveBeenCalledWith({
      token: validToken,
      deliveryId,
      userAgent: "Mozilla/5.0 test",
    });
    expect(updateTag).toHaveBeenCalledWith(`commission-${commissionId}`);
  });

  it("passes on the refusal before full payment", async () => {
    vi.mocked(requestDeliveryDownload).mockRejectedValue(
      new RepositoryError(
        "download_not_allowed",
        "The final file unlocks once the balance is paid.",
      ),
    );
    await expect(downloadDelivery(validToken, deliveryId)).resolves.toEqual({
      ok: false,
      error: {
        code: "download_not_allowed",
        message: "The final file unlocks once the balance is paid.",
      },
    });
  });

  it("rejects malformed input without a lookup", async () => {
    const result = await downloadDelivery("short", deliveryId);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
    expect(requestDeliveryDownload).not.toHaveBeenCalled();
  });
});
