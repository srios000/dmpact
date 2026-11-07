import { describe, expect, it } from "vitest";
import type { PaymentStatus } from "@/lib/repositories/shared";
import {
  daysLeft,
  deadlineTone,
  overduePayment,
  summarize,
  type QueueRow,
} from "./queue";

const TODAY = "2026-11-06";

function payment(
  status: PaymentStatus["status"],
  dueDate: string | null = null,
): PaymentStatus {
  return { status, amount: null, payLink: null, dueDate, paidAt: null };
}

function row(overrides: Partial<QueueRow> = {}): QueueRow {
  return {
    id: "c1",
    state: "in_progress",
    clientToken: null,
    title: "Key visual",
    clientName: "Sora",
    clientHandle: "@sora",
    serviceType: "illustration",
    total: "100.00",
    currency: "USD",
    depositAmount: "50.00",
    balanceAmount: "50.00",
    deadline: "2026-11-10",
    deposit: payment("paid"),
    balance: payment("not_created"),
    ...overrides,
  };
}

describe("daysLeft", () => {
  it("counts days until the deadline while work is open", () => {
    expect(daysLeft(row(), TODAY)).toBe(4);
    expect(daysLeft(row({ deadline: "2026-11-01" }), TODAY)).toBe(-5);
  });

  it("stops counting once the work is delivered or has no deadline", () => {
    expect(daysLeft(row({ state: "delivered" }), TODAY)).toBeNull();
    expect(daysLeft(row({ deadline: null }), TODAY)).toBeNull();
  });
});

describe("deadlineTone", () => {
  it("marks late, close and comfortable deadlines", () => {
    expect(deadlineTone(row({ deadline: "2026-11-05" }), TODAY)).toBe("late");
    expect(deadlineTone(row({ deadline: "2026-11-09" }), TODAY)).toBe("soon");
    expect(deadlineTone(row({ deadline: "2026-11-20" }), TODAY)).toBe("ok");
    expect(deadlineTone(row({ state: "fully_paid" }), TODAY)).toBe("done");
  });
});

describe("overduePayment", () => {
  it("flags a sent invoice past its due date", () => {
    expect(
      overduePayment(
        row({ state: "delivered", balance: payment("sent", "2026-11-01") }),
        TODAY,
      ),
    ).toBe("balance");
  });

  it("ignores paid invoices and ones not yet due", () => {
    expect(
      overduePayment(row({ balance: payment("sent", "2026-11-06") }), TODAY),
    ).toBeNull();
    expect(
      overduePayment(row({ deposit: payment("paid", "2026-10-01") }), TODAY),
    ).toBeNull();
  });
});

describe("summarize", () => {
  it("adds what clients still owe, per currency", () => {
    const summary = summarize(
      [
        row({ state: "agreed", deposit: payment("sent", "2026-11-12") }),
        row({ state: "delivered", balance: payment("sent", "2026-11-01") }),
        row({ state: "draft", deposit: payment("not_created") }),
        row({
          state: "dp_paid",
          currency: "SGD",
          depositAmount: "20.00",
          balanceAmount: "30.00",
        }),
      ],
      TODAY,
    );

    expect(summary.outstanding).toEqual([
      { currency: "SGD", amount: "30.00" },
      { currency: "USD", amount: "150.00" },
    ]);
    expect(summary.depositsPending).toEqual({
      count: 1,
      amounts: [{ currency: "USD", amount: "50.00" }],
    });
    expect(summary.overdue).toBe(1);
  });

  it("counts open work due in the next seven days", () => {
    const summary = summarize(
      [
        row({ deadline: "2026-11-06" }),
        row({ deadline: "2026-11-12" }),
        row({ deadline: "2026-11-13" }),
        row({ deadline: "2026-11-05" }),
        row({ state: "delivered", deadline: "2026-11-07" }),
      ],
      TODAY,
    );
    expect(summary.dueThisWeek).toBe(2);
  });
});
