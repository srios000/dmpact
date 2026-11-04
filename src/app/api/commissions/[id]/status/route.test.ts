import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCommissionStatus } from "@/lib/repositories/commission-repository";
import { GET } from "./route";

vi.mock("@/lib/repositories/commission-repository", () => ({
  getCommissionStatus: vi.fn(),
}));

const id = crypto.randomUUID();
const call = (commissionId: string, headers: HeadersInit = {}) =>
  GET(new Request("http://test.dev", { headers }), {
    params: Promise.resolve({ id: commissionId }),
  });

describe("GET /api/commissions/[id]/status", () => {
  beforeEach(() => vi.mocked(getCommissionStatus).mockReset());

  it("returns 404 for a malformed id without reading anything", async () => {
    const response = await call("not-a-uuid");
    expect(response.status).toBe(404);
    expect(getCommissionStatus).not.toHaveBeenCalled();
  });

  it("returns 404 when the caller has no access", async () => {
    vi.mocked(getCommissionStatus).mockResolvedValue(null);
    expect((await call(id)).status).toBe(404);
  });

  it("returns state and payment status without caching", async () => {
    const status = {
      state: "agreed" as const,
      updatedAt: "2026-11-02T00:00:00.000Z",
      awaitingClient: false,
      deposit: { status: "sent" as const, payLink: "link", paidAt: null },
      balance: { status: "not_created" as const, payLink: null, paidAt: null },
    };
    vi.mocked(getCommissionStatus).mockResolvedValue(status);

    const response = await call(id, { "x-client-token": "token" });

    expect(getCommissionStatus).toHaveBeenCalledWith(id, "token");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(status);
  });
});
