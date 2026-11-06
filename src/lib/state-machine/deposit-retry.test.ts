import { describe, expect, it } from "vitest";
import { canRetryDepositInvoice, depositFailureMessage } from "./deposit-retry";

describe("canRetryDepositInvoice", () => {
  it.each(["not_created", "draft", "cancelled"] as const)(
    "allows an agreed commission whose deposit invoice is %s",
    (deposit) => {
      expect(canRetryDepositInvoice("agreed", deposit)).toBe(true);
    },
  );

  it.each(["sent", "paid", "not_required"] as const)(
    "refuses an agreed commission whose deposit invoice is %s",
    (deposit) => {
      expect(canRetryDepositInvoice("agreed", deposit)).toBe(false);
    },
  );

  it.each(["draft", "negotiating", "dp_paid", "cancelled"] as const)(
    "refuses a %s commission",
    (state) => {
      expect(canRetryDepositInvoice(state, "not_created")).toBe(false);
    },
  );
});

describe("depositFailureMessage", () => {
  const failed = (message: unknown) => ({
    type: "effect_failed",
    reason: "createDepositInvoice",
    meta: { message },
  });

  it("returns the latest deposit invoice failure", () => {
    expect(
      depositFailureMessage([
        failed("first"),
        { type: "effect_failed", reason: "createBalanceInvoice", meta: {} },
        failed("second"),
        { type: "transition", reason: null, meta: null },
      ]),
    ).toBe("second");
  });

  it("returns null without a usable message", () => {
    expect(depositFailureMessage([])).toBeNull();
    expect(depositFailureMessage([failed(42)])).toBeNull();
    expect(
      depositFailureMessage([
        { type: "effect_failed", reason: "createDepositInvoice", meta: null },
      ]),
    ).toBeNull();
  });
});
