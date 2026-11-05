import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { clientTokenSchema } from "@/lib/schema/commission-forms";
import { confirmAgreement, getClientAgreement } from "./agreement-repository";
import { getCommissionStatus } from "./commission-repository";
import { newClientToken } from "./shared";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/get-current-creator", () => ({
  getCurrentCreator: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    commission: { findUnique: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({ commission: { findUnique: vi.fn() } }),
    ),
  },
}));

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
});
