import { describe, expect, it } from "vitest";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import { withComputedAmounts } from "./agreement";

describe("withComputedAmounts", () => {
  it("replaces client-supplied amounts for a percent deposit", () => {
    const result = withComputedAmounts({
      ...exampleAgreement,
      deposit: {
        type: "percent",
        percent: 50,
        fixed_amount: null,
        amount: "1.00",
      },
      balance_amount: "1.00",
    });
    expect(result.deposit.amount).toBe("75.00");
    expect(result.balance_amount).toBe("75.00");
  });

  it("handles a fixed deposit", () => {
    const result = withComputedAmounts({
      ...exampleAgreement,
      deposit: { type: "fixed", percent: null, fixed_amount: "40.00" },
    });
    expect(result.deposit.amount).toBe("40.00");
    expect(result.balance_amount).toBe("110.00");
  });

  it("handles no deposit", () => {
    const result = withComputedAmounts({
      ...exampleAgreement,
      deposit: { type: "none", percent: null, fixed_amount: null },
    });
    expect(result.deposit.amount).toBe("0.00");
    expect(result.balance_amount).toBe("150.00");
  });

  it("clears amounts when there is no total", () => {
    const result = withComputedAmounts({
      ...exampleAgreement,
      price: { total: null, currency: "USD" },
    });
    expect(result.deposit.amount).toBeNull();
    expect(result.balance_amount).toBeNull();
  });

  it("clears amounts when the total can't be read in its currency", () => {
    const result = withComputedAmounts({
      ...exampleAgreement,
      price: { total: "150.50", currency: "JPY" },
    });
    expect(result.deposit.amount).toBeNull();
    expect(result.balance_amount).toBeNull();
  });
});
