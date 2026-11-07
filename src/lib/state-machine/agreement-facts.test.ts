import { describe, expect, it } from "vitest";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import { readAgreementFacts } from "./agreement-facts";

const blocker = {
  code: "MISSING_USAGE_RIGHTS",
  severity: "blocker",
  field: "/usage_rights",
  message: "Usage rights are missing.",
};

const invalid = {
  agreementValid: false,
  blockerCount: 0,
  depositType: null,
  hasClientEmail: false,
  balanceIsZero: false,
};

describe("readAgreementFacts", () => {
  it("accepts a complete agreement", () => {
    expect(readAgreementFacts(exampleAgreement)).toEqual({
      agreementValid: true,
      blockerCount: 0,
      depositType: "percent",
      hasClientEmail: false,
      balanceIsZero: false,
    });
  });

  it("reads whether the client has an email", () => {
    expect(
      readAgreementFacts({
        ...exampleAgreement,
        parties: { client: { display_name: "Ren", email: "ren@example.com" } },
      }).hasClientEmail,
    ).toBe(true);
  });

  it("counts blocker ambiguities only", () => {
    expect(
      readAgreementFacts({
        ...exampleAgreement,
        ambiguities: [...exampleAgreement.ambiguities, blocker, blocker],
      }).blockerCount,
    ).toBe(2);
  });

  it("reads the deposit type", () => {
    expect(
      readAgreementFacts({
        ...exampleAgreement,
        deposit: { type: "none", percent: null, fixed_amount: null },
      }).depositType,
    ).toBe("none");
  });

  it("computes a zero balance instead of trusting the stored one", () => {
    expect(
      readAgreementFacts({
        ...exampleAgreement,
        deposit: { type: "percent", percent: 100, fixed_amount: null },
      }).balanceIsZero,
    ).toBe(true);
    expect(
      readAgreementFacts({ ...exampleAgreement, balance_amount: "0.00" })
        .balanceIsZero,
    ).toBe(false);
  });

  it.each([
    ["null", null],
    ["text", "text"],
    ["an empty object", {}],
    ["only an empty ambiguity list", { ambiguities: [] }],
    [
      "an unknown deposit type",
      { ...exampleAgreement, deposit: { type: "weird" } },
    ],
    ["a missing deposit", { ...exampleAgreement, deposit: undefined }],
  ])("rejects %s", (_name, content) => {
    expect(readAgreementFacts(content)).toEqual(invalid);
  });

  it.each([
    ["no total", { total: null, currency: "USD" }],
    ["no currency", { total: "150.00", currency: null }],
    [
      "decimals in a zero-decimal currency",
      { total: "150.50", currency: "JPY" },
    ],
  ])("marks a price with %s as invalid", (_name, price) => {
    expect(
      readAgreementFacts({ ...exampleAgreement, price }).agreementValid,
    ).toBe(false);
  });

  it("marks a deposit larger than the total as invalid", () => {
    expect(
      readAgreementFacts({
        ...exampleAgreement,
        deposit: { type: "fixed", percent: null, fixed_amount: "200.00" },
      }).agreementValid,
    ).toBe(false);
  });

  it("keeps blockers visible when the price is incomplete", () => {
    expect(
      readAgreementFacts({
        ...exampleAgreement,
        price: { total: null, currency: null },
        ambiguities: [blocker],
      }),
    ).toMatchObject({ agreementValid: false, blockerCount: 1 });
  });
});
