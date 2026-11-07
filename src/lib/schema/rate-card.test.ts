import { describe, expect, it } from "vitest";
import { SERVICE_TYPES } from "./agreement";
import { DEFAULT_RATE_CARD, rateCardSchema } from "./rate-card";

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
