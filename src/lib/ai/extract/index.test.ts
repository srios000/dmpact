import { describe, expect, it, vi } from "vitest";
import {
  withFallback,
  type ModelAnswer,
  type ModelClient,
} from "@/lib/ai/gemini";
import { ExtractionError, extractAgreement, todayInZone } from "./index";
import { baseAgreement } from "./test-helpers";

function mockClient(
  responses: Array<string | Error | ModelAnswer>,
  model = "gemini-test",
): ModelClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    model,
    calls,
    async generateJson({ user }) {
      calls.push(user);
      const next = responses.shift();
      if (next === undefined) throw new Error("no more responses");
      if (next instanceof Error) throw next;
      return typeof next === "string" ? { text: next, model } : next;
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
    expect(agreement.extraction?.prompt_version).toBe("extract-v4");
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

  it("records the fallback model when the main model's call fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = withFallback(
      mockClient([new Error("429")], "main"),
      mockClient([valid()], "backup"),
    );
    const { agreement, fallback } = await extractAgreement(input, client);
    expect(fallback).toBe(false);
    expect(agreement.extraction?.model).toBe("backup");
  });

  it("records the model of the last answer on the fallback draft", async () => {
    const client = mockClient([
      "not json",
      { text: JSON.stringify({ title: 5 }), model: "backup" },
    ]);
    const { agreement, fallback } = await extractAgreement(input, client);
    expect(fallback).toBe(true);
    expect(agreement.extraction?.model).toBe("backup");
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

describe("extractAgreement for a follow-up", () => {
  const current = () =>
    baseAgreement({
      price: { total: "165.00", currency: "USD" },
      parties: {
        client: {
          display_name: "Mina",
          handle: "@hoshimiya_mina",
          email: "mina@example.com",
        },
      },
    });
  const followUp = {
    dmText: "commercial use on YouTube, credit in the description",
    originalDm: "mix and master for 100 USD",
    currentAgreement: current(),
    pasteDate: "2026-10-30",
  };

  it("sends the saved agreement and the follow-up rules to the model", async () => {
    const systems: string[] = [];
    const client = mockClient([valid()]);
    const generate = client.generateJson.bind(client);
    client.generateJson = async (request) => {
      systems.push(request.system);
      return generate(request);
    };
    await extractAgreement(followUp, client);
    expect(client.calls[0]).toContain("<current_agreement>");
    expect(client.calls[0]).toContain("mina@example.com");
    expect(systems[0]).toContain("FOLLOW-UPS");
  });

  it("keeps the follow-up rules out of a first extraction", async () => {
    const systems: string[] = [];
    const client = mockClient([valid()]);
    const generate = client.generateJson.bind(client);
    client.generateJson = async (request) => {
      systems.push(request.system);
      return generate(request);
    };
    await extractAgreement(input, client);
    expect(systems[0]).not.toContain("FOLLOW-UPS");
  });

  it("keeps saved client details the model left empty", async () => {
    const answer = baseAgreement({
      parties: { client: { display_name: null, handle: null, email: null } },
      ambiguities: [
        {
          code: "MISSING_CLIENT_EMAIL",
          severity: "warning",
          field: "/parties/client/email",
          message: "No email.",
          source_quote: null,
          suggested_question: null,
        },
      ],
    });
    const client = mockClient([JSON.stringify(answer)]);
    const { agreement } = await extractAgreement(followUp, client);
    expect(agreement.parties?.client).toEqual({
      display_name: "Mina",
      handle: "@hoshimiya_mina",
      email: "mina@example.com",
    });
    expect(agreement.ambiguities.map((a) => a.code)).not.toContain(
      "MISSING_CLIENT_EMAIL",
    );
  });

  it("uses a new email from the follow-up", async () => {
    const answer = baseAgreement({
      parties: {
        client: {
          display_name: "Mina",
          handle: null,
          email: "new@example.com",
        },
      },
    });
    const client = mockClient([JSON.stringify(answer)]);
    const { agreement } = await extractAgreement(followUp, client);
    expect(agreement.parties?.client?.email).toBe("new@example.com");
    expect(agreement.parties?.client?.handle).toBe("@hoshimiya_mina");
  });

  it("falls back to the saved agreement, not a blank draft", async () => {
    const client = mockClient(["not json", "still not json"]);
    const { agreement, fallback } = await extractAgreement(followUp, client);
    expect(fallback).toBe(true);
    expect(agreement.price.total).toBe("165.00");
    expect(agreement.deliverables).toEqual(current().deliverables);
    expect(agreement.parties?.client?.email).toBe("mina@example.com");
    expect(agreement.ambiguities.map((a) => a.code)).toEqual(["OTHER"]);
  });

  it("checks the length of earlier follow-ups too", async () => {
    const client = mockClient([valid()]);
    await expect(
      extractAgreement(
        { ...followUp, earlierFollowUps: ["x".repeat(10_001)] },
        client,
      ),
    ).rejects.toMatchObject({ code: "INPUT_INVALID" });
    expect(client.calls).toHaveLength(0);
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
