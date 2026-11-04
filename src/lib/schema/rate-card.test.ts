import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toMinor } from "@/lib/money/decimal";
import { estimatePrice } from "@/lib/money/estimate";
import { SERVICE_TYPES, type Agreement } from "./agreement";
import {
  DEFAULT_MISMATCH_THRESHOLD_PCT,
  DEFAULT_RATE_CARD,
  rateCardSchema,
} from "./rate-card";

function issuesFor(value: unknown) {
  const result = rateCardSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

const services = DEFAULT_RATE_CARD.services;

describe("rateCardSchema", () => {
  it("accepts the default rate card", () => {
    expect(issuesFor(DEFAULT_RATE_CARD)).toEqual([]);
  });

  it("prices every service type except other", () => {
    expect(Object.keys(services).sort()).toEqual(
      SERVICE_TYPES.filter((type) => type !== "other").sort(),
    );
  });

  it("rejects a price for other", () => {
    expect(
      issuesFor({
        ...DEFAULT_RATE_CARD,
        services: { ...services, other: "10.00" },
      }),
    ).toContain("services");
  });

  it("rejects a missing service", () => {
    expect(
      issuesFor({
        ...DEFAULT_RATE_CARD,
        services: { ...services, thumbnail: undefined },
      }),
    ).toContain("services.thumbnail");
  });

  it("rejects a base price of zero", () => {
    expect(
      issuesFor({
        ...DEFAULT_RATE_CARD,
        services: { ...services, mixing: "0.00" },
      }),
    ).toContain("services.mixing");
  });

  it("allows a free extra", () => {
    expect(
      issuesFor({
        ...DEFAULT_RATE_CARD,
        extras: { ...DEFAULT_RATE_CARD.extras, source_file: "0.00" },
      }),
    ).toEqual([]);
  });

  it("rejects money that is not a decimal string", () => {
    expect(
      issuesFor({
        ...DEFAULT_RATE_CARD,
        services: { ...services, mixing: 100 },
      }),
    ).toContain("services.mixing");
  });

  it("rejects a negative revision count", () => {
    expect(
      issuesFor({ ...DEFAULT_RATE_CARD, included_revisions: -1 }),
    ).toContain("included_revisions");
  });
});

describe("DEFAULT_RATE_CARD on the test DMs", () => {
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
    }))
    .filter(
      ({ expected }) =>
        expected.service_type !== "other" &&
        expected.price.total !== null &&
        expected.price.currency === DEFAULT_RATE_CARD.currency,
    );

  it("has cases to check", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)("$file", ({ paste_date, expected, expect_mismatch }) => {
    const { total } = estimatePrice(expected, DEFAULT_RATE_CARD, paste_date)!;
    const estimate = toMinor(total, 2);
    const budget = toMinor(expected.price.total as string, 2);

    expect((estimate - budget) * 100 > DEFAULT_MISMATCH_THRESHOLD_PCT * estimate).toBe(
      expect_mismatch,
    );
  });
});
