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
    const { agreement, attempts, fallback } = await extractAgreement(
      input,
      client,
    );
    expect(attempts).toBe(1);
    expect(fallback).toBe(false);
    expect(agreement.deposit.amount).toBe("75.00");
    expect(agreement.extraction?.model).toBe("gemini-test");
    expect(agreement.extraction?.prompt_version).toBe("extract-v2");
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

  it("does not spend the retry on a wrong severity or missing metadata", async () => {
    const output = baseAgreement({
      price: { total: null, currency: null },
      ambiguities: [
        {
          code: "MISSING_PRICE",
          severity: "warning",
          field: "/price/total",
          message: "no price",
          source_quote: null,
          suggested_question: null,
        },
      ],
    });
    const client = mockClient([JSON.stringify(output)]);
    const { agreement, attempts } = await extractAgreement(input, client);
    expect(attempts).toBe(1);
    expect(agreement.ambiguities[0].severity).toBe("blocker");
  });

  it.each([
    [
      "percent",
      { type: "percent", percent: 50, fixed_amount: "75.00" },
      { type: "percent", percent: 50, fixed_amount: null },
    ],
    [
      "fixed",
      { type: "fixed", percent: 50, fixed_amount: "75.00" },
      { type: "fixed", percent: null, fixed_amount: "75.00" },
    ],
    [
      "none",
      { type: "none", percent: 0, fixed_amount: "0.00" },
      { type: "none", percent: null, fixed_amount: null },
    ],
  ] as const)(
    "does not spend the retry on an unused %s deposit field",
    async (_type, deposit, expected) => {
      const output = { ...baseAgreement(), deposit };
      const client = mockClient([JSON.stringify(output)]);
      const { agreement, attempts } = await extractAgreement(input, client);
      expect(attempts).toBe(1);
      expect(agreement.deposit).toMatchObject(expected);
    },
  );

  it("does not spend the retry on a URL-encoded field pointer", async () => {
    const output = baseAgreement({
      ambiguities: [
        {
          code: "OTHER",
          severity: "warning",
          field: "%2F",
          message: "instruction-like text",
          source_quote: null,
          suggested_question: null,
        },
      ],
    });
    const client = mockClient([JSON.stringify(output)]);
    const { agreement, attempts, fallback } = await extractAgreement(
      input,
      client,
    );
    expect(attempts).toBe(1);
    expect(fallback).toBe(false);
    expect(agreement.ambiguities[0].field).toBe("/");
  });

  it("falls back to a flagged draft after a second bad answer", async () => {
    const client = mockClient(["not json", "still not json"]);
    const { agreement, attempts, fallback } = await extractAgreement(
      input,
      client,
    );
    expect(attempts).toBe(2);
    expect(fallback).toBe(true);
    expect(client.calls).toHaveLength(2);
    expect(agreement.ambiguities.map((a) => a.code)).toEqual(
      expect.arrayContaining([
        "SCOPE_UNCLEAR",
        "MISSING_PRICE",
        "MISSING_DEADLINE",
        "MISSING_USAGE_RIGHTS",
        "MISSING_REVISIONS",
        "MISSING_DEPOSIT_TERMS",
        "MISSING_CLIENT_EMAIL",
      ]),
    );
    expect(agreement.extraction?.model).toBe("gemini-test");
  });

  it("keeps valid fields in the fallback draft", async () => {
    const bad = JSON.stringify({
      ...baseAgreement(),
      deadline: "soon",
      surprise: true,
    });
    const client = mockClient([bad, bad]);
    const { agreement, fallback } = await extractAgreement(input, client);
    expect(fallback).toBe(true);
    expect(agreement.price.total).toBe("150.00");
    expect(agreement.service_type).toBe("mix_and_master");
    expect(agreement.service_other).toBeNull();
    expect(agreement.deadline.date).toBeNull();
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
        { dmText: "x".repeat(10_001), pasteDate: "2026-10-30" },
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
