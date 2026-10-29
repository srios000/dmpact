import { describe, expect, it } from "vitest";
import { readAgreementFacts } from "./agreement-facts";

describe("readAgreementFacts", () => {
  it("counts blocker ambiguities only", () => {
    expect(
      readAgreementFacts({
        ambiguities: [
          { severity: "blocker" },
          { severity: "warning" },
          { severity: "blocker" },
        ],
      }).blockerCount,
    ).toBe(2);
  });

  it("reads the deposit type", () => {
    expect(readAgreementFacts({ deposit: { type: "none" } }).depositType).toBe(
      "none",
    );
    expect(readAgreementFacts({ deposit: { type: "weird" } }).depositType).toBe(
      null,
    );
  });

  it("detects a zero balance from the money string", () => {
    expect(readAgreementFacts({ balance_amount: "0.00" }).balanceIsZero).toBe(
      true,
    );
    expect(readAgreementFacts({ balance_amount: "0" }).balanceIsZero).toBe(
      true,
    );
    expect(readAgreementFacts({ balance_amount: "75.00" }).balanceIsZero).toBe(
      false,
    );
    expect(readAgreementFacts({ balance_amount: null }).balanceIsZero).toBe(
      false,
    );
  });

  it("handles missing or malformed content", () => {
    expect(readAgreementFacts(null)).toEqual({
      blockerCount: 0,
      depositType: null,
      balanceIsZero: false,
    });
    expect(readAgreementFacts("text").blockerCount).toBe(0);
  });
});
