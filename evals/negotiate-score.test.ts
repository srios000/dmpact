import { describe, expect, it } from "vitest";
import { withComputedAmounts } from "@/lib/money/agreement";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import type { Counteroffer } from "@/lib/schema/negotiation";
import {
  evaluateNegotiationGates,
  findMoneyAmounts,
  guessLanguage,
  lowerBudget,
  percentile,
  scoreNegotiationCase,
  scoreOption,
  summarizeNegotiation,
} from "./negotiate-score";

// 150.00 USD at a 50% deposit: 75.00 now, 75.00 on delivery.
const proposed = withComputedAmounts(exampleAgreement);

function option(
  strategy: Counteroffer["strategy"],
  message_draft: string,
): Counteroffer {
  return {
    id: "opt1",
    strategy,
    summary: "summary",
    message_draft,
    proposed_agreement: proposed,
  };
}

describe("findMoneyAmounts", () => {
  it("finds amounts next to $, the currency code or dollars", () => {
    expect(
      findMoneyAmounts(
        "It's $150, or 75.00 USD now, USD 1,200.50 later, 40 dollars max.",
        "USD",
      ),
    ).toEqual(["150.00", "75.00", "1200.50", "40.00"]);
  });

  it("ignores counts, percentages and dates", () => {
    expect(
      findMoneyAmounts("2 revisions, 50% deposit, due Nov 20, 3 stems", "USD"),
    ).toEqual([]);
  });

  it("reads Indonesian dolar", () => {
    expect(findMoneyAmounts("jadi 145 dolar ya Kak", "USD")).toEqual([
      "145.00",
    ]);
  });

  it("counts an amount written twice once", () => {
    expect(findMoneyAmounts("$150 USD, so 150.00 USD", "USD")).toEqual([
      "150.00",
    ]);
  });
});

describe("scoreOption", () => {
  it("accepts amounts the option carries", () => {
    expect(
      scoreOption(
        option("adjust_price", "The full scope is 150.00 USD."),
        "40.00",
      ),
    ).toMatchObject({
      amountsOk: true,
      unknownAmounts: [],
      missingAmount: null,
    });
  });

  it("allows the client's budget", () => {
    expect(
      scoreOption(
        option("adjust_price", "Your 40.00 USD budget is below 150.00 USD."),
        "40.00",
      ).amountsOk,
    ).toBe(true);
  });

  it("flags an amount the option doesn't carry", () => {
    expect(
      scoreOption(
        option("adjust_price", "I can do 150.00 USD, or $120."),
        "40.00",
      ),
    ).toMatchObject({ amountsOk: false, unknownAmounts: ["120.00"] });
  });

  it("needs the deposit in a split message", () => {
    expect(
      scoreOption(
        option("split_milestones", "The total is 150.00 USD."),
        "40.00",
      ),
    ).toMatchObject({ amountsOk: false, missingAmount: "75.00" });
    expect(
      scoreOption(
        option("split_milestones", "Pay 75.00 USD now, 75.00 USD on delivery."),
        "40.00",
      ).amountsOk,
    ).toBe(true);
  });
});

describe("guessLanguage", () => {
  it("tells English, Indonesian and Japanese apart", () => {
    expect(
      guessLanguage("Hi Ren! The full scope comes to 150.00 USD on my rates."),
    ).toBe("en");
    expect(
      guessLanguage(
        "Halo Kak Ren! Sesuai rate aku, untuk scope lengkapnya jadi 150.00 USD.",
      ),
    ).toBe("id");
    expect(guessLanguage("Renさん、こんにちは！150.00 USDです。")).toBe("ja");
  });

  it("gives up when it can't tell", () => {
    expect(guessLanguage("150.00 USD")).toBeNull();
  });
});

describe("scoreOption language and length", () => {
  it("checks the message is in the client's language", () => {
    const english = option("adjust_price", "Hi! The full scope is 150.00 USD.");
    expect(scoreOption(english, "40.00", "en")).toMatchObject({
      language: "en",
      languageOk: true,
    });
    expect(scoreOption(english, "40.00", "id").languageOk).toBe(false);
    expect(
      scoreOption(
        option(
          "adjust_price",
          "Halo Kak! Untuk scope lengkapnya jadi 150.00 USD.",
        ),
        "40.00",
        "id",
      ).languageOk,
    ).toBe(true);
  });

  it("doesn't score languages it can't recognize", () => {
    expect(
      scoreOption(option("adjust_price", "150.00 USD"), "40.00", "ko")
        .languageOk,
    ).toBe(true);
  });

  it("counts words", () => {
    expect(
      scoreOption(option("adjust_price", "It is 150.00 USD."), "40.00").words,
    ).toBe(4);
  });
});

describe("scoreNegotiationCase", () => {
  const mismatch = {
    detected: true,
    client_budget: "40.00",
    estimated_price: "150.00",
    currency: "USD",
    reason: "reason",
  };
  const agreement = {
    ...exampleAgreement,
    price: { total: "40.00", currency: "USD" },
  };

  it("passes a fair case with no options", () => {
    expect(
      scoreNegotiationCase({
        expectMismatch: false,
        agreement,
        result: {
          negotiation: {
            mismatch: { ...mismatch, detected: false },
            options: [],
          },
          fallback: false,
        },
      }).pass,
    ).toBe(true);
  });

  it("fails a mismatch the fixture doesn't expect", () => {
    expect(
      scoreNegotiationCase({
        expectMismatch: false,
        agreement,
        result: {
          negotiation: {
            mismatch,
            options: [option("adjust_price", "It is 150.00 USD.")],
          },
          fallback: false,
        },
      }),
    ).toMatchObject({ mismatchOk: false, pass: false });
  });

  it("fails a mismatch answered with templates", () => {
    expect(
      scoreNegotiationCase({
        expectMismatch: true,
        agreement,
        result: {
          negotiation: {
            mismatch,
            options: [option("adjust_price", "It is 150.00 USD.")],
          },
          fallback: true,
        },
      }).pass,
    ).toBe(false);
  });
});

describe("summarizeNegotiation and gates", () => {
  const ok = {
    expectMismatch: true,
    detected: true,
    mismatchOk: true,
    negotiationValid: true,
    fallback: false,
    options: [
      {
        strategy: "adjust_price" as const,
        unknownAmounts: [],
        missingAmount: null,
        amountsOk: true,
        language: "en",
        languageOk: true,
        words: 20,
      },
    ],
    pass: true,
  };

  it("meets the targets when every case passes", () => {
    const summary = summarizeNegotiation([ok, ok]);
    expect(summary).toMatchObject({
      cases: 2,
      passed: 2,
      mismatchAccuracy: 1,
      modelSuccessRate: 1,
      amountAccuracy: 1,
      languageAccuracy: 1,
      overLength: 0,
      strategies: { reduce_scope: 0, adjust_price: 2, split_milestones: 0 },
    });
    expect(evaluateNegotiationGates(summary).pass).toBe(true);
  });

  it("misses the targets on one invented amount", () => {
    const bad = {
      ...ok,
      pass: false,
      options: [
        { ...ok.options[0], unknownAmounts: ["1.00"], amountsOk: false },
      ],
    };
    const gates = evaluateNegotiationGates(summarizeNegotiation([ok, bad]));
    expect(gates.pass).toBe(false);
    expect(gates.failures).toEqual(["amountAccuracy 50% < 100%"]);
  });

  it("misses the targets on a reply in the wrong language", () => {
    const wrong = {
      ...ok,
      pass: false,
      options: [{ ...ok.options[0], language: "en", languageOk: false }],
    };
    expect(
      evaluateNegotiationGates(summarizeNegotiation([ok, wrong])).failures,
    ).toEqual(["languageAccuracy 50% < 100%"]);
  });

  it("counts long messages without failing the gates", () => {
    const long = { ...ok, options: [{ ...ok.options[0], words: 81 }] };
    const summary = summarizeNegotiation([long]);
    expect(summary.overLength).toBe(1);
    expect(evaluateNegotiationGates(summary).pass).toBe(true);
  });
});

describe("lowerBudget and percentile", () => {
  it("drops the budget to 70% of the estimate", () => {
    expect(lowerBudget(exampleAgreement, "150.00").price.total).toBe("105.00");
  });

  it("picks the nearest-rank percentile", () => {
    expect(percentile([], 95)).toBeNull();
    expect(percentile([3, 1, 2, 4], 50)).toBe(2);
    expect(percentile([3, 1, 2, 4], 95)).toBe(4);
  });
});
