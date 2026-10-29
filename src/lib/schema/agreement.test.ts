import { describe, expect, it } from "vitest";
import { agreementSchema } from "./agreement";
import { exampleAgreement } from "./example-agreement";

function issuesFor(value: unknown) {
  const result = agreementSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("agreementSchema", () => {
  it("accepts the documented example", () => {
    expect(issuesFor(exampleAgreement)).toEqual([]);
  });

  it("accepts a draft with unknown values left null", () => {
    expect(
      issuesFor({
        ...exampleAgreement,
        price: { total: null, currency: null },
        deadline: { date: null, is_relative: false },
        revisions: { included: null },
        deposit: { type: "none", percent: null, fixed_amount: null },
      }),
    ).toEqual([]);
  });

  it("requires at least one deliverable", () => {
    expect(issuesFor({ ...exampleAgreement, deliverables: [] })).toContain(
      "deliverables",
    );
  });

  it.each(["150", "150.5", "150.50", "15000"])("accepts money %s", (total) => {
    expect(
      issuesFor({ ...exampleAgreement, price: { total, currency: "USD" } }),
    ).toEqual([]);
  });

  it.each(["150.505", "-1", "1,000", "150 USD", ""])(
    "rejects money %s",
    (total) => {
      expect(
        issuesFor({ ...exampleAgreement, price: { total, currency: "USD" } }),
      ).toContain("price.total");
    },
  );

  it("rejects a lowercase currency code", () => {
    expect(
      issuesFor({
        ...exampleAgreement,
        price: { total: "1.00", currency: "usd" },
      }),
    ).toContain("price.currency");
  });

  it("rejects an invalid deadline date", () => {
    expect(
      issuesFor({
        ...exampleAgreement,
        deadline: { date: "20 Nov", is_relative: false },
      }),
    ).toContain("deadline.date");
  });

  it("rejects unknown fields", () => {
    expect(issuesFor({ ...exampleAgreement, tip: "5.00" })).toEqual([""]);
  });

  describe("service_other", () => {
    it("is required when service_type is other", () => {
      expect(
        issuesFor({
          ...exampleAgreement,
          service_type: "other",
          service_other: null,
        }),
      ).toContain("service_other");
    });

    it("is accepted when service_type is other", () => {
      expect(
        issuesFor({
          ...exampleAgreement,
          service_type: "other",
          service_other: "emote pack",
        }),
      ).toEqual([]);
    });

    it("must be null for other service types", () => {
      expect(
        issuesFor({ ...exampleAgreement, service_other: "emote pack" }),
      ).toContain("service_other");
    });
  });

  describe("deposit", () => {
    it("percent needs percent and no fixed amount", () => {
      expect(
        issuesFor({
          ...exampleAgreement,
          deposit: { type: "percent", percent: null, fixed_amount: "40.00" },
        }),
      ).toEqual(expect.arrayContaining(["deposit.percent", "deposit.fixed_amount"]));
    });

    it("fixed needs a fixed amount and no percent", () => {
      expect(
        issuesFor({
          ...exampleAgreement,
          deposit: { type: "fixed", percent: 50, fixed_amount: null },
        }),
      ).toEqual(expect.arrayContaining(["deposit.percent", "deposit.fixed_amount"]));
    });

    it("none has neither", () => {
      expect(
        issuesFor({
          ...exampleAgreement,
          deposit: { type: "none", percent: 50, fixed_amount: null },
        }),
      ).toContain("deposit.percent");
    });

    it("percent stays within 0–100", () => {
      expect(
        issuesFor({
          ...exampleAgreement,
          deposit: { type: "percent", percent: 120, fixed_amount: null },
        }),
      ).toContain("deposit.percent");
    });
  });

  describe("ambiguities", () => {
    it("rejects an unknown code", () => {
      expect(
        issuesFor({
          ...exampleAgreement,
          ambiguities: [
            {
              code: "TOO_CHEAP",
              severity: "warning",
              field: "/",
              message: "x",
            },
          ],
        }),
      ).toContain("ambiguities.0.code");
    });

    it("requires the field to be a JSON Pointer", () => {
      expect(
        issuesFor({
          ...exampleAgreement,
          ambiguities: [
            {
              code: "OTHER",
              severity: "warning",
              field: "deadline.date",
              message: "x",
            },
          ],
        }),
      ).toContain("ambiguities.0.field");
    });
  });
});
