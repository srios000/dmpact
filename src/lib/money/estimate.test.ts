import { describe, expect, it } from "vitest";
import type { Agreement } from "@/lib/schema/agreement";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import { DEFAULT_RATE_CARD, type RateCard } from "@/lib/schema/rate-card";
import { estimatePrice } from "./estimate";

const today = "2026-11-04";

function agreement(overrides: Partial<Agreement> = {}): Agreement {
  return {
    ...exampleAgreement,
    service_type: "illustration",
    revisions: { included: 2 },
    usage_rights: { commercial: false },
    deadline: { date: "2026-12-01", raw_text: null, is_relative: false },
    ...overrides,
  };
}

const paidExtras: RateCard = {
  ...DEFAULT_RATE_CARD,
  extras: { ...DEFAULT_RATE_CARD.extras, commercial_usage: "40.00" },
};

describe("estimatePrice", () => {
  it("is the base price when nothing extra is asked", () => {
    expect(estimatePrice(agreement(), DEFAULT_RATE_CARD, today)).toEqual({
      currency: "USD",
      total: "100.00",
      items: [{ key: "base", quantity: 1, amount: "100.00" }],
    });
  });

  it("returns null for other", () => {
    expect(
      estimatePrice(
        agreement({ service_type: "other", service_other: "Emotes" }),
        DEFAULT_RATE_CARD,
        today,
      ),
    ).toBeNull();
  });

  it("charges revisions above the included count", () => {
    const estimate = estimatePrice(
      agreement({ revisions: { included: 5 } }),
      DEFAULT_RATE_CARD,
      today,
    );
    expect(estimate?.total).toBe("145.00");
    expect(estimate?.items[1]).toEqual({
      key: "extra_revision",
      quantity: 3,
      amount: "45.00",
    });
  });

  it("does not charge fewer or unknown revisions", () => {
    for (const included of [0, null]) {
      expect(
        estimatePrice(
          agreement({ revisions: { included } }),
          DEFAULT_RATE_CARD,
          today,
        )?.total,
      ).toBe("100.00");
    }
  });

  it("adds the commercial fee only when commercial use is asked", () => {
    const commercial = agreement({ usage_rights: { commercial: true } });
    expect(estimatePrice(commercial, paidExtras, today)?.total).toBe("140.00");
    expect(estimatePrice(agreement(), paidExtras, today)?.total).toBe("100.00");
  });

  it("leaves out free extras", () => {
    const commercial = agreement({ usage_rights: { commercial: true } });
    expect(estimatePrice(commercial, DEFAULT_RATE_CARD, today)?.items).toEqual([
      { key: "base", quantity: 1, amount: "100.00" },
    ]);
  });

  it("adds the rush fee for a deadline within 48 hours", () => {
    const due = (date: string) =>
      estimatePrice(
        agreement({ deadline: { date, raw_text: null, is_relative: false } }),
        DEFAULT_RATE_CARD,
        today,
      )?.total;
    expect(due("2026-11-04")).toBe("160.00");
    expect(due("2026-11-06")).toBe("160.00");
    expect(due("2026-11-07")).toBe("100.00");
    expect(due("2026-11-01")).toBe("100.00");
  });

  it("uses the rate card's currency", () => {
    const yen: RateCard = {
      ...DEFAULT_RATE_CARD,
      currency: "JPY",
      services: { ...DEFAULT_RATE_CARD.services, illustration: "15000" },
    };
    expect(estimatePrice(agreement(), yen, today)).toMatchObject({
      currency: "JPY",
      total: "15000",
    });
  });
});
