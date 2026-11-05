import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Agreement } from "@/lib/schema/agreement";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import { negotiationSchema } from "@/lib/schema/negotiation";
import {
  DEFAULT_MISMATCH_THRESHOLD_PCT,
  DEFAULT_RATE_CARD,
  type RateCardSettings,
} from "@/lib/schema/rate-card";
import { detectMismatch } from "./mismatch";

const today = "2026-11-05";

const settings: RateCardSettings = {
  rate_card: DEFAULT_RATE_CARD,
  mismatch_threshold_pct: DEFAULT_MISMATCH_THRESHOLD_PCT,
};

// Illustration at the default rate card is 100.00 USD with nothing extra.
function agreement(
  total: string | null,
  overrides: Partial<Agreement> = {},
): Agreement {
  return {
    ...exampleAgreement,
    service_type: "illustration",
    price: { total, currency: "USD" },
    revisions: { included: 2 },
    usage_rights: { commercial: false },
    deadline: { date: "2026-12-01", raw_text: null, is_relative: false },
    ...overrides,
  };
}

describe("detectMismatch", () => {
  it("flags a budget more than the threshold under the estimate", () => {
    expect(detectMismatch(agreement("40.00"), settings, today)).toEqual({
      outcome: "mismatch",
      mismatch: {
        detected: true,
        client_budget: "40.00",
        estimated_price: "100.00",
        currency: "USD",
        reason:
          "Illustration is estimated at 100.00 USD on your rate card; the budget is 40.00 USD (60% under).",
      },
      estimate: {
        currency: "USD",
        total: "100.00",
        items: [{ key: "base", quantity: 1, amount: "100.00" }],
      },
      gap_pct: 60,
    });
  });

  it("treats a gap of exactly the threshold as fair", () => {
    const check = detectMismatch(agreement("80.00"), settings, today);
    expect(check.outcome).toBe("fair");
    expect(check.mismatch.detected).toBe(false);
    expect(check.gap_pct).toBe(20);
  });

  it("flags a gap just over the threshold", () => {
    expect(detectMismatch(agreement("79.99"), settings, today).outcome).toBe(
      "mismatch",
    );
  });

  it("says a budget at or above the estimate looks fair", () => {
    const check = detectMismatch(agreement("150.00"), settings, today);
    expect(check.outcome).toBe("fair");
    expect(check.gap_pct).toBe(-50);
    expect(check.mismatch.reason).toBe(
      "Looks fair: the budget of 150.00 USD covers your rate card estimate of 100.00 USD (Illustration).",
    );
  });

  it("uses the creator's threshold", () => {
    const strict = { ...settings, mismatch_threshold_pct: 5 };
    const check = detectMismatch(agreement("90.00"), strict, today);
    expect(check.outcome).toBe("mismatch");
    expect(detectMismatch(agreement("90.00"), settings, today).outcome).toBe(
      "fair",
    );
  });

  it("names the extras that make up the estimate", () => {
    const check = detectMismatch(
      agreement("50.00", {
        revisions: { included: 3 },
        deadline: { date: "2026-11-06", raw_text: null, is_relative: false },
      }),
      settings,
      today,
    );
    expect(check.mismatch.estimated_price).toBe("175.00");
    expect(check.mismatch.reason).toBe(
      "Illustration with 1 extra revision and a 48-hour rush is estimated at 175.00 USD on your rate card; the budget is 50.00 USD (71% under).",
    );
  });

  it.each([
    [
      "other",
      agreement("10.00", { service_type: "other", service_other: "Emotes" }),
    ],
    ["no price", agreement(null)],
    [
      "no currency",
      agreement("10.00", { price: { total: "10.00", currency: null } }),
    ],
    [
      "another currency",
      agreement("10.00", { price: { total: "10.00", currency: "EUR" } }),
    ],
  ])("skips %s without calling it fair", (_name, input) => {
    const check = detectMismatch(input, settings, today);
    expect(check.outcome).toBe("skipped");
    expect(check.mismatch.detected).toBe(false);
    expect(check.mismatch.estimated_price).toBeNull();
    expect(check.estimate).toBeNull();
    expect(check.mismatch.reason).not.toMatch(/fair/i);
  });

  it("gives a mismatch the negotiation schema accepts", () => {
    for (const total of ["40.00", "150.00", null]) {
      const { mismatch } = detectMismatch(agreement(total), settings, today);
      expect(
        negotiationSchema.safeParse({ mismatch, options: [] }).success,
      ).toBe(true);
    }
  });
});

describe("detectMismatch on the test DMs", () => {
  const dir = join(process.cwd(), "fixtures/dms");
  const cases = readdirSync(dir)
    .filter((file) => file.endsWith(".expected.json"))
    .map((file) => ({
      file,
      ...(JSON.parse(readFileSync(join(dir, file), "utf8")) as {
        paste_date: string;
        expected: Agreement;
        expect_mismatch: boolean;
      }),
    }));

  it("covers every case", () => {
    expect(cases).toHaveLength(21);
  });

  it.each(cases)("$file", ({ paste_date, expected, expect_mismatch }) => {
    expect(
      detectMismatch(expected, settings, paste_date).mismatch.detected,
    ).toBe(expect_mismatch);
  });
});
