import { describe, expect, it } from "vitest";
import {
  computeAmounts,
  currencyExponent,
  fromMinor,
  toMinor,
} from "./decimal";

describe("toMinor / fromMinor", () => {
  it("round-trips two-decimal amounts", () => {
    expect(toMinor("150.00", 2)).toBe(15000);
    expect(toMinor("150", 2)).toBe(15000);
    expect(toMinor("0.5", 2)).toBe(50);
    expect(fromMinor(15000, 2)).toBe("150.00");
    expect(fromMinor(5, 2)).toBe("0.05");
  });

  it("handles zero-decimal currencies", () => {
    expect(currencyExponent("JPY")).toBe(0);
    expect(currencyExponent("USD")).toBe(2);
    expect(currencyExponent(null)).toBe(2);
    expect(toMinor("15000", 0)).toBe(15000);
    expect(toMinor("15000.00", 0)).toBe(15000);
    expect(() => toMinor("15000.50", 0)).toThrow();
    expect(fromMinor(15000, 0)).toBe("15000");
  });

  it("rejects malformed strings", () => {
    expect(() => toMinor("1,500.00", 2)).toThrow();
    expect(() => toMinor("-5", 2)).toThrow();
    expect(() => toMinor("1.234", 2)).toThrow();
  });
});

describe("computeAmounts", () => {
  it("computes a percent deposit", () => {
    expect(
      computeAmounts("150.00", "USD", {
        type: "percent",
        percent: 50,
        fixed_amount: null,
      }),
    ).toEqual({ deposit: "75.00", balance: "75.00", exceeds: false });
  });

  it("rounds half up to the minor unit", () => {
    // 33.33% of 10.01 = 3.336333 -> 3.34
    expect(
      computeAmounts("10.01", "USD", {
        type: "percent",
        percent: 33.33,
        fixed_amount: null,
      }),
    ).toEqual({ deposit: "3.34", balance: "6.67", exceeds: false });
  });

  it("computes a fixed deposit", () => {
    expect(
      computeAmounts("150.00", "USD", {
        type: "fixed",
        percent: null,
        fixed_amount: "40.00",
      }),
    ).toEqual({ deposit: "40.00", balance: "110.00", exceeds: false });
  });

  it("treats no deposit as zero", () => {
    expect(
      computeAmounts("150.00", "USD", {
        type: "none",
        percent: null,
        fixed_amount: null,
      }),
    ).toEqual({ deposit: "0.00", balance: "150.00", exceeds: false });
  });

  it("works in JPY without decimals", () => {
    expect(
      computeAmounts("15000", "JPY", {
        type: "percent",
        percent: 30,
        fixed_amount: null,
      }),
    ).toEqual({ deposit: "4500", balance: "10500", exceeds: false });
  });

  it("flags a fixed deposit above the total", () => {
    expect(
      computeAmounts("50.00", "USD", {
        type: "fixed",
        percent: null,
        fixed_amount: "80.00",
      }),
    ).toEqual({ deposit: "80.00", balance: null, exceeds: true });
  });

  it("returns null when terms are incomplete", () => {
    expect(
      computeAmounts(null, "USD", {
        type: "none",
        percent: null,
        fixed_amount: null,
      }),
    ).toBeNull();
    expect(
      computeAmounts("10.00", "USD", {
        type: "percent",
        percent: null,
        fixed_amount: null,
      }),
    ).toBeNull();
    expect(
      computeAmounts("10.00", "USD", {
        type: "fixed",
        percent: null,
        fixed_amount: null,
      }),
    ).toBeNull();
  });
});
