import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGeminiClient } from "@/lib/ai/gemini";
import {
  ExtractionError,
  extractAgreement as runExtraction,
} from "@/lib/ai/extract";
import { getCommission } from "@/lib/repositories/commission-repository";
import { RepositoryError } from "@/lib/repositories/errors";
import { requireCreator } from "@/lib/repositories/shared";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import { extractAgreement } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: vi.fn() }));
vi.mock("@/lib/ai/gemini", async (original) => ({
  ...(await original<typeof import("@/lib/ai/gemini")>()),
  createGeminiClient: vi.fn(),
}));
vi.mock("@/lib/ai/extract", async (original) => ({
  ...(await original<typeof import("@/lib/ai/extract")>()),
  extractAgreement: vi.fn(),
  todayInZone: () => "2026-11-02",
}));
vi.mock("@/lib/repositories/commission-repository", () => ({
  getCommission: vi.fn(),
}));
vi.mock("@/lib/repositories/shared", () => ({ requireCreator: vi.fn() }));

const run = vi.mocked(runExtraction);
const creator = vi.mocked(requireCreator);
const commission = vi.mocked(getCommission);
const client = { model: "gemini-test", generateJson: vi.fn() };
const commissionId = "6f1c1b62-6a56-4f38-9a0a-1f6f1d1e2a10";
const result = { agreement: exampleAgreement, attempts: 1, fallback: false };

describe("extractAgreement action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createGeminiClient).mockReturnValue(client);
    creator.mockResolvedValue({ id: "creator" } as never);
    run.mockResolvedValue(result as never);
  });

  it("extracts a pasted DM with today's date", async () => {
    await expect(
      extractAgreement({ dmText: "  deal 150 USD  " }),
    ).resolves.toEqual({ ok: true, data: result });
    expect(run).toHaveBeenCalledWith(
      {
        dmText: "deal 150 USD",
        pasteDate: "2026-11-02",
        originalDm: undefined,
      },
      client,
    );
    expect(commission).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty DM", { dmText: "   " }],
    ["a DM over the limit", { dmText: "x".repeat(10_001) }],
    ["a bad commission id", { dmText: "deal", commissionId: "nope" }],
  ])("rejects %s before calling the model", async (_name, input) => {
    const response = await extractAgreement(input);
    expect(response).toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("needs a signed-in creator before calling the model", async () => {
    creator.mockRejectedValue(
      new RepositoryError("unauthorized", "Sign in first."),
    );
    await expect(extractAgreement({ dmText: "deal" })).resolves.toEqual({
      ok: false,
      error: { code: "unauthorized", message: "Sign in first." },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("builds a follow-up on the original DM, earlier follow-ups and the latest version", async () => {
    const older = { ...exampleAgreement, title: "Version 1" };
    const latest = { ...exampleAgreement, title: "Version 2" };
    commission.mockResolvedValue({
      sourceDm: "original deal",
      versions: [{ agreement: older }, { agreement: latest }],
      followUpDms: [{ message: "first reply" }, { message: "second reply" }],
    } as never);
    await extractAgreement({ dmText: "make it 200", commissionId });
    expect(commission).toHaveBeenCalledWith(commissionId);
    expect(run).toHaveBeenCalledWith(
      {
        dmText: "make it 200",
        pasteDate: "2026-11-02",
        originalDm: "original deal",
        earlierFollowUps: ["first reply", "second reply"],
        currentAgreement: latest,
      },
      client,
    );
  });

  it("does not call the model for someone else's commission", async () => {
    commission.mockRejectedValue(
      new RepositoryError("not_found", "Commission not found."),
    );
    const response = await extractAgreement({ dmText: "deal", commissionId });
    expect(response).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("returns a safe message when extraction fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    run.mockRejectedValue(
      new ExtractionError("MODEL_CALL_FAILED", '{"error":{"code":503}}'),
    );
    const response = await extractAgreement({ dmText: "deal" });
    expect(response).toEqual({
      ok: false,
      error: {
        code: "extraction_failed",
        message:
          "Extraction failed. Try again or fill in the agreement by hand.",
      },
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("does not hide unexpected errors", async () => {
    run.mockRejectedValue(new Error("boom"));
    await expect(extractAgreement({ dmText: "deal" })).rejects.toThrow("boom");
  });
});
