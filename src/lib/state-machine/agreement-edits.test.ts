import { describe, expect, it } from "vitest";
import type { Agreement } from "@/lib/schema/agreement";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import {
  canClientConfirm,
  canClientRequestChanges,
  checkAgreementEdit,
} from "./agreement-edits";

const today = "2026-11-02";
const current = exampleAgreement;
const newDeadline: Agreement = {
  ...current,
  deadline: { date: "2026-12-01", raw_text: null, is_relative: false },
};
const blocker: Agreement["ambiguities"][number] = {
  code: "SCOPE_UNCLEAR",
  severity: "blocker",
  field: "/deliverables",
  message: "Scope is unclear.",
};

describe("checkAgreementEdit", () => {
  it("allows any edit in draft without confirming for the creator", () => {
    const next = { ...current, ambiguities: [blocker] };
    expect(
      checkAgreementEdit({ state: "draft", current, next, today }),
    ).toEqual({ ok: true, agreement: next, creatorConfirms: false });
  });

  it("confirms for the creator while negotiating", () => {
    const next = { ...current, title: "New title" };
    expect(
      checkAgreementEdit({ state: "negotiating", current, next, today }),
    ).toMatchObject({ ok: true, creatorConfirms: true });
  });

  it("rejects blockers while negotiating", () => {
    const next = { ...current, ambiguities: [blocker] };
    expect(
      checkAgreementEdit({ state: "negotiating", current, next, today }),
    ).toMatchObject({ ok: false, code: "invalid_agreement" });
  });

  it.each(["agreed", "dp_paid", "in_progress"] as const)(
    "allows a deadline change in %s",
    (state) => {
      expect(
        checkAgreementEdit({ state, current, next: newDeadline, today }),
      ).toMatchObject({ ok: true, creatorConfirms: true });
    },
  );

  it.each([
    ["title", { title: "New title" }],
    ["price", { price: { total: "999.00", currency: "USD" } }],
    ["revisions", { revisions: { included: 9, extra_fee: null } }],
  ])("rejects a %s change after client approval", (_name, change) => {
    expect(
      checkAgreementEdit({
        state: "agreed",
        current,
        next: { ...newDeadline, ...change },
        today,
      }),
    ).toMatchObject({ ok: false, code: "edit_not_allowed" });
  });

  it.each(["delivered", "fully_paid", "cancelled"] as const)(
    "rejects every edit in %s",
    (state) => {
      expect(
        checkAgreementEdit({ state, current, next: newDeadline, today }),
      ).toMatchObject({ ok: false, code: "edit_not_allowed" });
    },
  );

  it.each([null, "2026-11-01"])("rejects the new deadline %s", (date) => {
    expect(
      checkAgreementEdit({
        state: "agreed",
        current,
        next: {
          ...current,
          deadline: { date, raw_text: null, is_relative: false },
        },
        today,
      }),
    ).toMatchObject({ ok: false, code: "invalid_agreement" });
  });

  it("drops old deadline flags when the deadline changes", () => {
    const result = checkAgreementEdit({
      state: "agreed",
      current,
      next: newDeadline,
      today,
    });
    expect(result.ok && result.agreement.ambiguities).toEqual([]);
  });
});

describe("client permissions", () => {
  it("allows confirming until delivery", () => {
    expect(canClientConfirm("negotiating")).toBe(true);
    expect(canClientConfirm("in_progress")).toBe(true);
    expect(canClientConfirm("draft")).toBe(false);
    expect(canClientConfirm("delivered")).toBe(false);
  });

  it("allows change requests only when the client still has to decide", () => {
    expect(canClientRequestChanges("negotiating", false)).toBe(true);
    expect(canClientRequestChanges("agreed", true)).toBe(true);
    expect(canClientRequestChanges("agreed", false)).toBe(false);
    expect(canClientRequestChanges("delivered", true)).toBe(false);
  });
});
