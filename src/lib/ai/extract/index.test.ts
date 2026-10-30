import { describe, expect, it } from "vitest";
import type { ModelClient } from "@/lib/ai/gemini";
import { ExtractionError, extractAgreement, todayInZone } from "./index";
import { baseAgreement } from "./test-helpers";

function mockClient(
  responses: Array<string | Error>,
): ModelClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    model: "gemini-test",
    calls,
    async generateJson({ user }) {
      calls.push(user);
      const next = responses.shift();
      if (next === undefined) throw new Error("no more responses");
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

const input = { dmText: "deal 150 USD", pasteDate: "2026-10-30" };
const valid = () => JSON.stringify(baseAgreement());

describe("extractAgreement", () => {
  it("returns a validated agreement with metadata and computed money", async () => {
    const client = mockClient([valid()]);
    const { agreement, attempts } = await extractAgreement(input, client);
    expect(attempts).toBe(1);
    expect(agreement.deposit.amount).toBe("75.00");
    expect(agreement.extraction?.model).toBe("gemini-test");
    expect(agreement.extraction?.prompt_version).toBe("extract-v1");
  });

  it("accepts JSON wrapped in code fences", async () => {
    const client = mockClient(["```json\n" + valid() + "\n```"]);
    const { attempts } = await extractAgreement(input, client);
    expect(attempts).toBe(1);
  });

  it("retries once with the validation errors, then succeeds", async () => {
    const bad = JSON.stringify({ ...baseAgreement(), surprise: true });
    const client = mockClient([bad, valid()]);
    const { attempts } = await extractAgreement(input, client);
    expect(attempts).toBe(2);
    expect(client.calls[1]).toContain("rejected by validation");
    expect(client.calls[1]).toContain("surprise");
  });

  it("fails with INVALID_OUTPUT after a second bad answer", async () => {
    const client = mockClient(["not json", "still not json"]);
    await expect(extractAgreement(input, client)).rejects.toMatchObject({
      code: "INVALID_OUTPUT",
    });
    expect(client.calls).toHaveLength(2);
  });

  it("wraps model failures", async () => {
    const client = mockClient([new Error("503")]);
    await expect(extractAgreement(input, client)).rejects.toMatchObject({
      code: "MODEL_CALL_FAILED",
    });
  });

  it("rejects bad input before calling the model", async () => {
    const client = mockClient([valid()]);
    await expect(
      extractAgreement({ dmText: "x", pasteDate: "tomorrow" }, client),
    ).rejects.toBeInstanceOf(ExtractionError);
    await expect(
      extractAgreement(
        { dmText: "x".repeat(20_001), pasteDate: "2026-10-30" },
        client,
      ),
    ).rejects.toMatchObject({ code: "INPUT_INVALID" });
    expect(client.calls).toHaveLength(0);
  });

  it("drops model-written money before validating", async () => {
    const withMoney = baseAgreement();
    withMoney.deposit.amount = "1.00";
    withMoney.balance_amount = "1.00";
    const client = mockClient([JSON.stringify(withMoney)]);
    const { agreement } = await extractAgreement(input, client);
    expect(agreement.deposit.amount).toBe("75.00");
  });
});

describe("todayInZone", () => {
  it("uses the creator's time zone", () => {
    // 2026-10-30 18:00 UTC is already Oct 31 in Jakarta (UTC+7).
    const now = new Date("2026-10-30T18:00:00Z");
    expect(todayInZone("Asia/Jakarta", now)).toBe("2026-10-31");
    expect(todayInZone("UTC", now)).toBe("2026-10-30");
  });
});
