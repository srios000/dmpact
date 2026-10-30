import { describe, expect, it } from "vitest";
import {
  flattenExpected,
  scoreCase,
  summarize,
  valuesMatch,
  type EvalFixture,
} from "./score";

const fixture: EvalFixture = {
  paste_date: "2026-10-30",
  expected: {
    title: "ignored wording",
    price: { total: "150.00", currency: "USD" },
    deposit: { type: "percent", percent: 50 },
    deliverables: [{ description: "ignored", quantity: 2 }],
  },
  expected_ambiguity_codes: ["MISSING_CLIENT_EMAIL"],
};

const actual = {
  title: "something else",
  price: { total: "150", currency: "USD" },
  deposit: { type: "percent", percent: 50, fixed_amount: null },
  deliverables: [{ id: "d1", description: "Mix", quantity: 2 }],
  ambiguities: [
    { code: "MISSING_CLIENT_EMAIL", severity: "warning" },
    { code: "USAGE_RIGHTS_UNCLEAR", severity: "warning" },
  ],
};

describe("flattenExpected", () => {
  it("lists leaves and skips free-text keys", () => {
    const paths = flattenExpected(fixture.expected).map((l) =>
      l.path.join("/"),
    );
    expect(paths).toEqual([
      "price/total",
      "price/currency",
      "deposit/type",
      "deposit/percent",
      "deliverables/0/quantity",
    ]);
  });
});

describe("valuesMatch", () => {
  it("compares money numerically and the rest strictly", () => {
    expect(valuesMatch("150.00", "150")).toBe(true);
    expect(valuesMatch("150.00", "150.01")).toBe(false);
    expect(valuesMatch(50, "50")).toBe(false);
    expect(valuesMatch(null, undefined)).toBe(false);
    expect(valuesMatch(null, null)).toBe(true);
  });
});

describe("scoreCase", () => {
  it("passes when fields match, expected codes appear, and extra flags are warnings", () => {
    const score = scoreCase(fixture, actual);
    expect(score.pass).toBe(true);
    expect(score.fieldsTotal).toBe(5);
    expect(score.fieldsMatched).toBe(5);
  });

  it("reports mismatches", () => {
    const score = scoreCase(fixture, {
      ...actual,
      price: { total: "40.00", currency: "USD" },
    });
    expect(score.pass).toBe(false);
    expect(score.mismatches).toEqual([
      { path: "/price/total", expected: "150.00", actual: "40.00" },
    ]);
  });

  it("fails on missing expected codes and unexpected blockers", () => {
    const score = scoreCase(fixture, {
      ...actual,
      ambiguities: [{ code: "MISSING_PRICE", severity: "blocker" }],
    });
    expect(score.missingCodes).toEqual(["MISSING_CLIENT_EMAIL"]);
    expect(score.unexpectedBlockers).toEqual(["MISSING_PRICE"]);
    expect(score.pass).toBe(false);
  });
});

describe("summarize", () => {
  it("computes pass rate and field accuracy", () => {
    const pass = scoreCase(fixture, actual);
    const fail = scoreCase(fixture, {
      ...actual,
      price: { total: "1.00", currency: "USD" },
    });
    const summary = summarize([pass, fail]);
    expect(summary.cases).toBe(2);
    expect(summary.passed).toBe(1);
    expect(summary.passRate).toBe(0.5);
    expect(summary.fieldAccuracy).toBeCloseTo(9 / 10);
  });

  it("handles no cases", () => {
    expect(summarize([]).passRate).toBe(0);
  });
});
