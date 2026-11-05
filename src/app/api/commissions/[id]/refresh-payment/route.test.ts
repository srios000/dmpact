import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canAccessCommission,
  refreshPayments,
} from "@/lib/repositories/invoice-sync-repository";
import { POST } from "./route";

vi.mock("@/lib/repositories/invoice-sync-repository", () => ({
  canAccessCommission: vi.fn(),
  refreshPayments: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const id = crypto.randomUUID();
const call = (commissionId: string, headers: HeadersInit = {}) =>
  POST(new Request("http://test.dev", { method: "POST", headers }), {
    params: Promise.resolve({ id: commissionId }),
  });

describe("POST /api/commissions/[id]/refresh-payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(canAccessCommission).mockResolvedValue(true);
    vi.mocked(refreshPayments).mockResolvedValue({
      checked: 1,
      changed: 1,
      throttled: false,
    });
  });

  it("returns 404 for a malformed id or no access", async () => {
    expect((await call("not-a-uuid")).status).toBe(404);
    vi.mocked(canAccessCommission).mockResolvedValue(false);
    expect((await call(id)).status).toBe(404);
    expect(refreshPayments).not.toHaveBeenCalled();
  });

  it("checks PayPal and revalidates when a status changed", async () => {
    const response = await call(id, { "x-client-token": "token" });

    expect(canAccessCommission).toHaveBeenCalledWith(id, "token");
    expect(refreshPayments).toHaveBeenCalledWith(id, "manual");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      checked: 1,
      changed: 1,
      throttled: false,
    });
    expect(revalidateTag).toHaveBeenCalledWith(`commission-${id}`, "max");
  });

  it("doesn't revalidate when nothing changed", async () => {
    vi.mocked(refreshPayments).mockResolvedValue({
      checked: 1,
      changed: 0,
      throttled: false,
    });
    await call(id);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("returns 502 when PayPal can't be reached", async () => {
    vi.mocked(refreshPayments).mockRejectedValue(new Error("PayPal down"));
    expect((await call(id)).status).toBe(502);
  });
});
