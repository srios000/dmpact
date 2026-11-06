import { describe, expect, it } from "vitest";
import { toPayPalValue } from "./currency";

describe("toPayPalValue", () => {
  it("pads two-decimal currencies", () => {
    expect(toPayPalValue("75", "USD")).toBe("75.00");
    expect(toPayPalValue("75.5", "USD")).toBe("75.50");
    expect(toPayPalValue("75.00", "EUR")).toBe("75.00");
    expect(toPayPalValue("007.10", "USD")).toBe("7.10");
  });

  it("handles JPY without decimals", () => {
    expect(toPayPalValue("15000", "JPY")).toBe("15000");
    expect(toPayPalValue("15000.00", "JPY")).toBe("15000");
    expect(() => toPayPalValue("15000.5", "JPY")).toThrow(
      /does not allow decimals/,
    );
  });

  it("rejects currencies PayPal can't invoice, like IDR", () => {
    expect(() => toPayPalValue("150000", "IDR")).toThrow(/not supported/);
  });

  it("rejects bad or non-positive amounts", () => {
    expect(() => toPayPalValue("75.001", "USD")).toThrow(/at most 2 decimals/);
    expect(() => toPayPalValue("-5", "USD")).toThrow(/Invalid amount/);
    expect(() => toPayPalValue("1e3", "USD")).toThrow(/Invalid amount/);
    expect(() => toPayPalValue("0.00", "USD")).toThrow(/greater than zero/);
  });
});
