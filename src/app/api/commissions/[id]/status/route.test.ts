import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCommissionStatus } from "@/lib/repositories/commission-repository";
import { refreshPayments } from "@/lib/repositories/invoice-sync-repository";
import { GET } from "./route";

vi.mock("@/lib/repositories/commission-repository", () => ({
  getCommissionStatus: vi.fn(),
}));
vi.mock("@/lib/repositories/invoice-sync-repository", () => ({
  refreshPayments: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));

const id = crypto.randomUUID();
const call = (commissionId: string, headers: HeadersInit = {}) =>
  GET(new Request("http://test.dev", { headers }), {
    params: Promise.resolve({ id: commissionId }),
  });

describe("GET /api/commissions/[id]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCommissionStatus).mockReset();
    vi.mocked(refreshPayments).mockResolvedValue({
      checked: 0,
      changed: 0,
      throttled: false,
    });
  });

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

  it("checks PayPal in the background while an invoice is unpaid", async () => {
    vi.mocked(getCommissionStatus).mockResolvedValue({
      state: "agreed",
      updatedAt: "2026-11-02T00:00:00.000Z",
      awaitingClient: false,
      deposit: { status: "sent", payLink: "link", paidAt: null },
      balance: { status: "not_created", payLink: null, paidAt: null },
    });

    await call(id);
    expect(refreshPayments).not.toHaveBeenCalled();

    const callback = vi.mocked(after).mock.calls[0]?.[0];
    if (typeof callback === "function") await callback();
    expect(refreshPayments).toHaveBeenCalledWith(id, "background");
  });

  it("doesn't check PayPal when nothing is waiting for payment", async () => {
    vi.mocked(getCommissionStatus).mockResolvedValue({
      state: "dp_paid",
      updatedAt: "2026-11-02T00:00:00.000Z",
      awaitingClient: false,
      deposit: { status: "paid", payLink: "link", paidAt: null },
      balance: { status: "not_created", payLink: null, paidAt: null },
    });

    await call(id);
    expect(after).not.toHaveBeenCalled();
  });
});
