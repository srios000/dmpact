import { describe, expect, it } from "vitest";
import {
  balanceFailureMessage,
  canRetryBalanceInvoice,
  canRetryDepositInvoice,
  depositFailureMessage,
} from "./deposit-retry";

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

describe("canRetryBalanceInvoice", () => {
  it.each(["not_created", "draft", "cancelled"] as const)(
    "allows a delivered commission whose balance invoice is %s",
    (balance) => {
      expect(canRetryBalanceInvoice("delivered", balance)).toBe(true);
    },
  );

  it.each(["sent", "paid", "not_required"] as const)(
    "refuses a delivered commission whose balance invoice is %s",
    (balance) => {
      expect(canRetryBalanceInvoice("delivered", balance)).toBe(false);
    },
  );

  it.each(["agreed", "dp_paid", "in_progress", "fully_paid"] as const)(
    "refuses a %s commission",
    (state) => {
      expect(canRetryBalanceInvoice(state, "not_created")).toBe(false);
    },
  );
});

describe("depositFailureMessage / balanceFailureMessage", () => {
  const failed = (
    reason: "createDepositInvoice" | "createBalanceInvoice",
    message: unknown,
  ) => ({
    type: "effect_failed",
    reason,
    meta: { message },
  });

  it("returns the latest failure for each invoice kind", () => {
    const events = [
      failed("createDepositInvoice", "first"),
      failed("createBalanceInvoice", "balance failed"),
      failed("createDepositInvoice", "second"),
      { type: "transition", reason: null, meta: null },
    ];
    expect(depositFailureMessage(events)).toBe("second");
    expect(balanceFailureMessage(events)).toBe("balance failed");
  });

  it("returns null without a usable message", () => {
    expect(depositFailureMessage([])).toBeNull();
    expect(balanceFailureMessage([])).toBeNull();
    expect(
      depositFailureMessage([failed("createDepositInvoice", 42)]),
    ).toBeNull();
    expect(
      depositFailureMessage([
        { type: "effect_failed", reason: "createDepositInvoice", meta: null },
      ]),
    ).toBeNull();
  });
});
