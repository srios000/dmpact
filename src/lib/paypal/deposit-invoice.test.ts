import { describe, expect, it } from "vitest";
import type { Agreement } from "@/lib/schema/agreement";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import {
  addDays,
  DepositInvoiceError,
  planDepositInvoice,
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
  version: 2,
  contentHash: "abcdef0123456789".padEnd(64, "0"),
  creatorPaypalEmail: "creator@business.example.com",
  clientToken: "tok_123",
  appBaseUrl: "https://dmpact.test/",
  today: "2026-11-05",
};

function withDeposit(deposit: Agreement["deposit"]): PlanDepositInvoiceInput {
  return { ...base, agreement: { ...agreement, deposit } };
}

describe("planDepositInvoice", () => {
  it("plans a percent deposit from the computed amount", () => {
    const plan = planDepositInvoice(base);
    expect(plan).toEqual({
      skip: false,
      amount: "75.00",
      currency: "USD",
      dueDate: "2026-11-08",
      itemName: "Deposit (50%) — Original song mix & master — 'Starfall'",
      note: "Deposit for agreement version 2 (abcdef01). Review it at https://dmpact.test/a/tok_123",
      invoicerEmail: "creator@business.example.com",
      recipientEmail: "ren@example.com",
      recipientName: "Ren",
    });
  });

  it("ignores a stale deposit.amount and recomputes it", () => {
    const plan = planDepositInvoice(
      withDeposit({
        type: "percent",
        percent: 40,
        fixed_amount: null,
        amount: "1.00",
      }),
    );
    expect(plan).toMatchObject({ skip: false, amount: "60.00" });
  });

  it("plans a fixed deposit", () => {
    const plan = planDepositInvoice(
      withDeposit({ type: "fixed", percent: null, fixed_amount: "40.00" }),
    );
    expect(plan).toMatchObject({
      skip: false,
      amount: "40.00",
      itemName: "Deposit — Original song mix & master — 'Starfall'",
    });
  });

  it("keeps JPY amounts without decimals", () => {
    const plan = planDepositInvoice({
      ...base,
      agreement: { ...agreement, price: { total: "15000", currency: "JPY" } },
    });
    expect(plan).toMatchObject({ amount: "7500", currency: "JPY" });
  });

  it("skips commissions without a deposit", () => {
    expect(
      planDepositInvoice(
        withDeposit({ type: "none", percent: null, fixed_amount: null }),
      ),
    ).toMatchObject({ skip: true });
    expect(
      planDepositInvoice(
        withDeposit({ type: "percent", percent: 0, fixed_amount: null }),
      ),
    ).toMatchObject({ skip: true });
  });

  it("explains what is missing", () => {
    const noEmail = {
      ...base,
      agreement: {
        ...agreement,
        parties: { client: { display_name: "Ren", email: null } },
      },
    };
    expect(() => planDepositInvoice(noEmail)).toThrow(DepositInvoiceError);
    expect(() => planDepositInvoice(noEmail)).toThrow(/client's PayPal email/);
    expect(() =>
      planDepositInvoice({ ...base, creatorPaypalEmail: null }),
    ).toThrow(/creator has no PayPal email/);
    expect(() =>
      planDepositInvoice(
        withDeposit({ type: "fixed", percent: null, fixed_amount: "500.00" }),
      ),
    ).toThrow(/exceeds/);
  });

  it("leaves the link out when the commission has no client token", () => {
    const plan = planDepositInvoice({ ...base, clientToken: null });
    expect(plan).toMatchObject({
      note: "Deposit for agreement version 2 (abcdef01).",
    });
  });
});

describe("addDays", () => {
  it("crosses month ends in UTC", () => {
    expect(addDays("2026-11-29", 3)).toBe("2026-12-02");
  });
});
