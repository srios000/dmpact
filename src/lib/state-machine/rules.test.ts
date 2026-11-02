import { describe, expect, it } from "vitest";
import { checkTransition, type GuardContext } from "./rules";

const ready: GuardContext = {
  hasAgreement: true,
  agreementValid: true,
  blockerCount: 0,
  confirmedBy: { creator: true, client: true },
  depositType: "percent",
  balanceIsZero: false,
  deliveryCount: 1,
};

function expectError(result: ReturnType<typeof checkTransition>, code: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.code).toBe(code);
}

describe("allowed transitions", () => {
  it.each([
    ["draft", "negotiating", "creator"],
    ["negotiating", "agreed", "client"],
    ["negotiating", "agreed", "creator"],
    ["agreed", "dp_paid", "paypal"],
    ["dp_paid", "in_progress", "creator"],
    ["in_progress", "delivered", "creator"],
    ["delivered", "fully_paid", "paypal"],
    ["draft", "cancelled", "creator"],
    ["negotiating", "cancelled", "creator"],
    ["agreed", "cancelled", "creator"],
  ] as const)("%s → %s by %s", (from, to, actor) => {
    expect(checkTransition(from, to, actor, ready).ok).toBe(true);
  });
});

describe("rejected transitions", () => {
  it.each([
    ["draft", "agreed"],
    ["draft", "dp_paid"],
    ["negotiating", "in_progress"],
    ["dp_paid", "cancelled"],
    ["in_progress", "cancelled"],
    ["fully_paid", "draft"],
    ["cancelled", "draft"],
    ["delivered", "in_progress"],
  ] as const)("%s → %s does not exist", (from, to) => {
    expectError(checkTransition(from, to, "creator", ready), "not_allowed");
  });

  it("rejects a transition to the same state", () => {
    expectError(
      checkTransition("negotiating", "negotiating", "creator", ready),
      "not_allowed",
    );
  });
});

describe("actors", () => {
  it("only PayPal can mark the deposit paid", () => {
    for (const actor of ["creator", "client", "system"] as const) {
      expectError(
        checkTransition("agreed", "dp_paid", actor, ready),
        "actor_not_allowed",
      );
    }
  });

  it("creator and client cannot mark the balance paid", () => {
    for (const actor of ["creator", "client"] as const) {
      expectError(
        checkTransition("delivered", "fully_paid", actor, ready),
        "actor_not_allowed",
      );
    }
  });

  it("the client cannot send, deliver or cancel", () => {
    expectError(
      checkTransition("draft", "negotiating", "client", ready),
      "actor_not_allowed",
    );
    expectError(
      checkTransition("in_progress", "delivered", "client", ready),
      "actor_not_allowed",
    );
    expectError(
      checkTransition("draft", "cancelled", "client", ready),
      "actor_not_allowed",
    );
  });
});

describe("guards", () => {
  it("cannot send without an agreement", () => {
    expectError(
      checkTransition("draft", "negotiating", "creator", {
        ...ready,
        hasAgreement: false,
      }),
      "guard_failed",
    );
  });

  it("cannot send while blocker ambiguities remain", () => {
    expectError(
      checkTransition("draft", "negotiating", "creator", {
        ...ready,
        blockerCount: 2,
      }),
      "guard_failed",
    );
  });

  it.each([
    ["draft", "negotiating", "creator"],
    ["negotiating", "agreed", "client"],
    ["in_progress", "delivered", "creator"],
  ] as const)("%s → %s needs a valid agreement", (from, to, actor) => {
    expectError(
      checkTransition(from, to, actor, { ...ready, agreementValid: false }),
      "guard_failed",
    );
  });

  it("an invalid agreement can still be cancelled", () => {
    expect(
      checkTransition("agreed", "cancelled", "creator", {
        ...ready,
        agreementValid: false,
        depositType: null,
      }).ok,
    ).toBe(true);
  });

  it("agreed needs both parties to confirm the current version", () => {
    for (const confirmedBy of [
      { creator: true, client: false },
      { creator: false, client: true },
      { creator: false, client: false },
    ]) {
      expectError(
        checkTransition("negotiating", "agreed", "client", {
          ...ready,
          confirmedBy,
        }),
        "guard_failed",
      );
    }
  });

  it("deposit paid only when a deposit is required", () => {
    for (const depositType of ["none", null] as const) {
      expectError(
        checkTransition("agreed", "dp_paid", "paypal", {
          ...ready,
          depositType,
        }),
        "guard_failed",
      );
    }
  });

  it("can start without a deposit only when there is none", () => {
    expect(
      checkTransition("agreed", "in_progress", "creator", {
        ...ready,
        depositType: "none",
      }).ok,
    ).toBe(true);
    expectError(
      checkTransition("agreed", "in_progress", "creator", ready),
      "guard_failed",
    );
  });

  it("delivered needs at least one delivery", () => {
    expectError(
      checkTransition("in_progress", "delivered", "creator", {
        ...ready,
        deliveryCount: 0,
      }),
      "guard_failed",
    );
  });

  it("system completes only when the balance is zero", () => {
    expect(
      checkTransition("delivered", "fully_paid", "system", {
        ...ready,
        balanceIsZero: true,
      }).ok,
    ).toBe(true);
    expectError(
      checkTransition("delivered", "fully_paid", "system", ready),
      "guard_failed",
    );
  });
});

describe("effects", () => {
  function effectsOf(result: ReturnType<typeof checkTransition>) {
    expect(result.ok).toBe(true);
    return result.ok ? result : null;
  }

  it("agreed creates the deposit invoice", () => {
    expect(
      effectsOf(checkTransition("negotiating", "agreed", "client", ready))
        ?.effects,
    ).toEqual(["createDepositInvoice"]);
  });

  it("agreed without a deposit creates nothing", () => {
    expect(
      effectsOf(
        checkTransition("negotiating", "agreed", "client", {
          ...ready,
          depositType: "none",
        }),
      )?.effects,
    ).toEqual([]);
  });

  it("delivered creates the balance invoice", () => {
    const result = effectsOf(
      checkTransition("in_progress", "delivered", "creator", ready),
    );
    expect(result?.effects).toEqual(["createBalanceInvoice"]);
    expect(result?.followUp).toBeUndefined();
  });

  it("delivered with zero balance completes right away", () => {
    const result = effectsOf(
      checkTransition("in_progress", "delivered", "creator", {
        ...ready,
        balanceIsZero: true,
      }),
    );
    expect(result?.effects).toEqual([]);
    expect(result?.followUp).toBe("fully_paid");
  });

  it("cancelled cancels open invoices", () => {
    expect(
      effectsOf(checkTransition("agreed", "cancelled", "creator", ready))
        ?.effects,
    ).toEqual(["cancelOpenInvoices"]);
  });
});
