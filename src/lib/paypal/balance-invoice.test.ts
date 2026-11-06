import { describe, expect, it } from "vitest";
import type { Agreement } from "@/lib/schema/agreement";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import { planBalanceInvoice } from "./balance-invoice";
import {
  DepositInvoiceError,
  type PlanDepositInvoiceInput,
} from "./deposit-invoice";

const agreement: Agreement = {
  ...exampleAgreement,
  parties: {
    client: {
      display_name: "Ren",
      handle: "@ren_ch",
      email: "ren@example.com",
    },
  },
};

const base: PlanDepositInvoiceInput = {
  agreement,
  version: 3,
  contentHash: "abcdef0123456789".padEnd(64, "0"),
  creatorPaypalEmail: "creator@business.example.com",
  clientToken: "tok_123",
  appBaseUrl: "https://dmpact.test/",
  today: "2026-11-10",
};

function withDeposit(deposit: Agreement["deposit"]): PlanDepositInvoiceInput {
  return { ...base, agreement: { ...agreement, deposit } };
}

describe("planBalanceInvoice", () => {
  it("bills total − deposit, due in 7 days", () => {
    expect(planBalanceInvoice(base)).toEqual({
      skip: false,
      amount: "75.00",
      currency: "USD",
      dueDate: "2026-11-17",
      itemName: "Balance — Original song mix & master — 'Starfall'",
      note: "Balance for agreement version 3 (abcdef01), due on delivery. Review it at https://dmpact.test/a/tok_123",
      invoicerEmail: "creator@business.example.com",
      recipientEmail: "ren@example.com",
      recipientName: "Ren",
    });
  });

  it("recomputes the balance instead of trusting balance_amount", () => {
    const plan = planBalanceInvoice({
      ...base,
      agreement: {
        ...agreement,
        deposit: { type: "fixed", percent: null, fixed_amount: "40.00" },
        balance_amount: "1.00",
      },
    });
    expect(plan).toMatchObject({ skip: false, amount: "110.00" });
  });

  it("bills the whole price when there was no deposit", () => {
    const plan = planBalanceInvoice(
      withDeposit({ type: "none", percent: null, fixed_amount: null }),
    );
    expect(plan).toMatchObject({
      skip: false,
      amount: "150.00",
      itemName: "Payment — Original song mix & master — 'Starfall'",
    });
  });

  it("keeps JPY balances without decimals", () => {
    const plan = planBalanceInvoice({
      ...base,
      agreement: { ...agreement, price: { total: "15001", currency: "JPY" } },
    });
    // 50% of 15001 rounds half up to 7501, leaving 7500
    expect(plan).toMatchObject({ amount: "7500", currency: "JPY" });
  });

  it("skips a zero balance (100% upfront)", () => {
    expect(
      planBalanceInvoice(
        withDeposit({ type: "percent", percent: 100, fixed_amount: null }),
      ),
    ).toEqual({ skip: true, reason: "The balance is zero." });
  });

  it("explains what is missing", () => {
    const noEmail = {
      ...base,
      agreement: {
        ...agreement,
        parties: { client: { display_name: "Ren", email: null } },
      },
    };
    expect(() => planBalanceInvoice(noEmail)).toThrow(DepositInvoiceError);
    expect(() => planBalanceInvoice(noEmail)).toThrow(/balance invoice/);
    expect(() =>
      planBalanceInvoice({ ...base, creatorPaypalEmail: null }),
    ).toThrow(/creator has no PayPal email/);
    expect(() =>
      planBalanceInvoice(
        withDeposit({ type: "fixed", percent: null, fixed_amount: "500.00" }),
      ),
    ).toThrow(/exceeds/);
  });
});
