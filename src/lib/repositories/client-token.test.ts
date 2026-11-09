import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentCreator } from "@/lib/auth/get-current-creator";
import { db } from "@/lib/db";
import { clientTokenSchema } from "@/lib/schema/commission-forms";
import {
  confirmAgreement,
  getClientAgreement,
  requestChanges,
} from "./agreement-repository";
import { getCommissionStatus } from "./commission-repository";
import { newClientToken } from "./shared";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/get-current-creator", () => ({
  getCurrentCreator: vi.fn(),
}));
vi.mock("@/lib/db", () => {
  const commission = { findUnique: vi.fn(), findFirst: vi.fn() };
  return {
    db: {
      commission,
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({ commission })),
    },
  };
});

const malformed = ["short", "a".repeat(64), "a".repeat(21) + "="];

describe("client tokens", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates 128-bit base64url tokens that pass validation", () => {
    const tokens = new Set(Array.from({ length: 100 }, newClientToken));
    expect(tokens.size).toBe(100);
    for (const token of tokens) {
      expect(Buffer.from(token, "base64url")).toHaveLength(16);
      expect(clientTokenSchema.safeParse(token).success).toBe(true);
    }
  });

  it.each(malformed)(
    "rejects malformed token %s without a lookup",
    async (token) => {
      expect(await getClientAgreement(token)).toBeNull();
      expect(await getCommissionStatus(crypto.randomUUID(), token)).toBeNull();
      await expect(
        confirmAgreement({ token, versionHash: "a".repeat(64) }),
      ).rejects.toMatchObject({ code: "not_found" });

      expect(db.commission.findUnique).not.toHaveBeenCalled();
      expect(db.commission.findFirst).not.toHaveBeenCalled();
    },
  );

  it("blocks the owning creator from confirming or requesting changes", async () => {
    const token = newClientToken();
    const creatorId = crypto.randomUUID();
    vi.mocked(getCurrentCreator).mockResolvedValue({
      id: creatorId,
      email: "creator@test.dev",
      displayName: "Creator",
      paypalEmail: null,
    });
    vi.mocked(db.commission.findUnique).mockResolvedValue({
      id: crypto.randomUUID(),
      creatorId,
    } as never);

    await expect(
      confirmAgreement({ token, versionHash: "a".repeat(64) }),
    ).rejects.toMatchObject({ code: "edit_not_allowed" });

    await expect(
      requestChanges({ token, message: "Change something" }),
    ).rejects.toMatchObject({ code: "edit_not_allowed" });
  });
});
