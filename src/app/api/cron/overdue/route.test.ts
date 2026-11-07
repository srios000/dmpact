import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runOverdueReminders } from "@/lib/repositories/overdue-repository";
import { GET } from "./route";

vi.mock("@/lib/env", () => ({
  env: { CRON_SECRET: "cron-secret", GEMINI_API_KEY: undefined },
}));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: vi.fn() }));
vi.mock("@/lib/repositories/overdue-repository", () => ({
  runOverdueReminders: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const call = (authorization?: string) =>
  GET(
    new Request("http://test.dev/api/cron/overdue", {
      headers: authorization ? { authorization } : {},
    }),
  );

const nudge = {
  invoiceId: "inv-1",
  kind: "balance" as const,
  message: "Hi Ren!",
  tone: "firm" as const,
  daysOverdue: 5,
  remindedAtPayPal: true,
  at: "2026-11-06T01:00:00.000Z",
};

describe("GET /api/cron/overdue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runOverdueReminders).mockResolvedValue([
      { invoiceId: "inv-1", commissionId: "c-1", status: "reminded", nudge },
      {
        invoiceId: "inv-2",
        commissionId: "c-2",
        status: "skipped",
        reason: "Already reminded in the last 24 hours.",
      },
    ]);
  });

  it("rejects calls without the cron secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(runOverdueReminders).not.toHaveBeenCalled();
  });

  it("runs the reminders and reports what happened", async () => {
    const response = await call("Bearer cron-secret");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      checked: 2,
      reminded: 1,
      skipped: 1,
      failed: 0,
    });
    expect(runOverdueReminders).toHaveBeenCalledWith({ model: null });
    expect(revalidateTag).toHaveBeenCalledWith("commission-c-1", {
      expire: 0,
    });
    expect(revalidateTag).not.toHaveBeenCalledWith("commission-c-2", {
      expire: 0,
    });
  });
});
