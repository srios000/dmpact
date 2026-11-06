import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDemoCommissions } from "@/lib/demo/demo-commissions";
import { env } from "@/lib/env";
import { GET } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/env", () => ({
  env: {
    CRON_SECRET: "cron-secret",
    DEMO_CREATOR_EMAIL: "Demo@Example.com",
    DEMO_CLIENT_PAYPAL_EMAIL: "buyer@example.com",
  },
}));
vi.mock("@/lib/db", () => ({
  db: { creator: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/demo/demo-commissions", () => ({
  resetDemoCommissions: vi.fn(),
}));

const call = (authorization?: string) =>
  GET(
    new Request("http://localhost/api/cron/reset-demo", {
      headers: authorization ? { authorization } : {},
    }),
  );

describe("GET /api/cron/reset-demo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses a request without the cron secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(resetDemoCommissions).not.toHaveBeenCalled();
  });

  it("resets the demo creator's commissions", async () => {
    vi.mocked(db.creator.findUnique).mockResolvedValue({
      id: "creator-1",
    } as never);
    vi.mocked(resetDemoCommissions).mockResolvedValue(
      Array.from({ length: 12 }, () => ({}) as never),
    );

    const response = await call("Bearer cron-secret");

    expect(await response.json()).toEqual({ commissions: 12 });
    expect(db.creator.findUnique).toHaveBeenCalledWith({
      where: { email: "demo@example.com" },
    });
    expect(resetDemoCommissions).toHaveBeenCalledWith(
      db,
      "creator-1",
      "buyer@example.com",
    );
  });

  it("does nothing when the demo env vars are missing", async () => {
    vi.mocked(env).DEMO_CLIENT_PAYPAL_EMAIL = undefined;

    const response = await call("Bearer cron-secret");

    expect(await response.json()).toEqual({
      skipped: "Demo env vars are not set.",
    });
    expect(resetDemoCommissions).not.toHaveBeenCalled();
  });
});
