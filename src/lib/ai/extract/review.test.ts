import { describe, expect, it } from "vitest";
import type { Agreement } from "@/lib/schema/agreement";
import { blankAgreement, keepUnresolvedFlags, reviewAgreement } from "./review";
import { baseAgreement } from "./test-helpers";

const PASTE = "2026-10-30";
const codes = (a: Agreement) => a.ambiguities.map((x) => x.code);

function withMissingDeadline(): Agreement {
  return baseAgreement({
    deadline: { date: null, raw_text: "asap", is_relative: false },
    ambiguities: [
      {
        code: "MISSING_DEADLINE",
        severity: "blocker",
        field: "/deadline/date",
        message: "No exact date.",
        source_quote: "asap",
        suggested_question: null,
      },
    ],
  });
}

describe("keepUnresolvedFlags", () => {
  it("keeps a flag while its field is unchanged", () => {
    const original = withMissingDeadline();
    const edited = structuredClone(original);
    edited.title = "New title";
    expect(
      codes({ ...edited, ambiguities: keepUnresolvedFlags(original, edited) }),
    ).toEqual(["MISSING_DEADLINE"]);
  });

  it("drops a flag once its field was edited", () => {
    const original = withMissingDeadline();
    const edited = structuredClone(original);
    edited.deadline.date = "2026-11-20";
    expect(keepUnresolvedFlags(original, edited)).toEqual([]);
  });

  it("always keeps flags on the whole agreement", () => {
    const original = baseAgreement({
      ambiguities: [
        {
          code: "OTHER",
          severity: "warning",
          field: "/",
          message: "Instruction-like text.",
          source_quote: null,
          suggested_question: null,
        },
      ],
    });
    const edited = structuredClone(original);
    edited.title = "Changed";
    expect(keepUnresolvedFlags(original, edited)).toHaveLength(1);
  });
});

describe("reviewAgreement", () => {
  it("keeps a date the creator typed and clears the blocker", () => {
    const original = withMissingDeadline();
    const edited = structuredClone(original);
    edited.deadline.date = "2026-11-20";
    const result = reviewAgreement({
      original,
      edited,
      dmText: "deal",
      pasteDate: PASTE,
    });
    expect(result.deadline.date).toBe("2026-11-20");
    expect(codes(result)).not.toContain("MISSING_DEADLINE");
  });

  it("flags a field the creator cleared", () => {
    const original = baseAgreement();
    const edited = structuredClone(original);
    edited.price.total = null;
    const result = reviewAgreement({
      original,
      edited,
      dmText: "deal",
      pasteDate: PASTE,
    });
    expect(codes(result)).toContain("MISSING_PRICE");
  });

  it("flags a currency PayPal can't invoice after an edit", () => {
    const original = baseAgreement();
    const edited = structuredClone(original);
    edited.price.currency = "IDR";
    const result = reviewAgreement({
      original,
      edited,
      dmText: "deal",
      pasteDate: PASTE,
    });
    expect(codes(result)).toContain("UNSUPPORTED_CURRENCY");
  });

  it("recomputes deposit and balance from the edited total", () => {
    const original = baseAgreement();
    const edited = structuredClone(original);
    edited.price.total = "200.00";
    const result = reviewAgreement({
      original,
      edited,
      dmText: "deal",
      pasteDate: PASTE,
    });
    expect(result.deposit.amount).toBe("100.00");
    expect(result.balance_amount).toBe("100.00");
  });
});

describe("blankAgreement", () => {
  it("starts manual entry with the missing terms flagged", () => {
    expect(codes(blankAgreement(PASTE))).toEqual([
      "MISSING_PRICE",
      "MISSING_DEADLINE",
      "MISSING_USAGE_RIGHTS",
      "MISSING_REVISIONS",
      "MISSING_CLIENT_EMAIL",
    ]);
  });
});
