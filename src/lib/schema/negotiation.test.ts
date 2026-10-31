import { describe, expect, it } from "vitest";
import { exampleAgreement } from "./example-agreement";
import { negotiationSchema } from "./negotiation";

const mismatch = {
  detected: true,
  client_budget: "40.00",
  estimated_price: "150.00",
  currency: "USD",
  reason: "Mix + master is estimated at $150; the budget is $40.",
};

function option(strategy: string, id = strategy) {
  return {
    id,
    strategy,
    summary: "summary",
    message_draft: "Hi Ren!",
    proposed_agreement: exampleAgreement,
  };
}

function issuesFor(value: unknown) {
  const result = negotiationSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("negotiationSchema", () => {
  it("accepts up to three options with different strategies", () => {
    expect(
      issuesFor({
        mismatch,
        options: [
          option("reduce_scope"),
          option("adjust_price"),
          option("split_milestones"),
        ],
      }),
    ).toEqual([]);
  });

  it("rejects more than three options", () => {
    expect(
      issuesFor({
        mismatch,
        options: [
          option("reduce_scope", "a"),
          option("adjust_price", "b"),
          option("split_milestones", "c"),
          option("reduce_scope", "d"),
        ],
      }),
    ).toContain("options");
  });

  it("rejects two options with the same strategy", () => {
    expect(
      issuesFor({
        mismatch,
        options: [option("reduce_scope", "a"), option("reduce_scope", "b")],
      }),
    ).toContain("options");
  });

  it("rejects options when there is no mismatch", () => {
    expect(
      issuesFor({
        mismatch: { ...mismatch, detected: false },
        options: [option("adjust_price")],
      }),
    ).toContain("options");
  });

  it("accepts no mismatch with no options", () => {
    expect(
      issuesFor({ mismatch: { ...mismatch, detected: false }, options: [] }),
    ).toEqual([]);
  });

  it("validates the proposed agreement", () => {
    expect(
      issuesFor({
        mismatch,
        options: [
          {
            ...option("adjust_price"),
            proposed_agreement: { ...exampleAgreement, deliverables: [] },
          },
        ],
      }),
    ).toContain("options.0.proposed_agreement.deliverables");
  });
});
