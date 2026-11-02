import { canonicalJson } from "@/lib/schema/content-hash";
import type { Agreement } from "@/lib/schema/agreement";
import { readAgreementFacts } from "./agreement-facts";
import type { CommissionState } from "./rules";

const DEADLINE_ONLY_STATES: CommissionState[] = [
  "agreed",
  "dp_paid",
  "in_progress",
];

export type AgreementEditInput = {
  state: CommissionState;
  current: Agreement;
  next: Agreement;
  /** YYYY-MM-DD */
  today: string;
};

export type AgreementEditCheck =
  | { ok: true; agreement: Agreement; creatorConfirms: boolean }
  | {
      ok: false;
      code: "edit_not_allowed" | "invalid_agreement";
      message: string;
    };

function isDeadlineFlag({ field }: Agreement["ambiguities"][number]) {
  return field === "/deadline" || field.startsWith("/deadline/");
}

function withoutDeadline(agreement: Agreement) {
  return canonicalJson({
    ...agreement,
    deadline: null,
    ambiguities: agreement.ambiguities.filter((a) => !isDeadlineFlag(a)),
  });
}

function sendable(agreement: Agreement): string | null {
  const facts = readAgreementFacts(agreement);
  if (facts.blockerCount > 0) {
    return `${facts.blockerCount} blocker ambiguities must be resolved first.`;
  }
  return facts.agreementValid
    ? null
    : "The agreement is invalid or its price and deposit are incomplete.";
}

export function checkAgreementEdit({
  state,
  current,
  next,
  today,
}: AgreementEditInput): AgreementEditCheck {
  if (state === "draft") {
    return { ok: true, agreement: next, creatorConfirms: false };
  }

  if (state === "negotiating") {
    const failure = sendable(next);
    return failure
      ? { ok: false, code: "invalid_agreement", message: failure }
      : { ok: true, agreement: next, creatorConfirms: true };
  }

  if (!DEADLINE_ONLY_STATES.includes(state)) {
    return {
      ok: false,
      code: "edit_not_allowed",
      message: `The agreement can't change once the commission is ${state}.`,
    };
  }

  if (withoutDeadline(current) !== withoutDeadline(next)) {
    return {
      ok: false,
      code: "edit_not_allowed",
      message: "Only the deadline can change after client approval.",
    };
  }

  if (next.deadline.date === null || next.deadline.date < today) {
    return {
      ok: false,
      code: "invalid_agreement",
      message: "The new deadline must be today or later.",
    };
  }

  const agreement = {
    ...next,
    ambiguities: next.ambiguities.filter((a) => !isDeadlineFlag(a)),
  };
  const failure = sendable(agreement);
  return failure
    ? { ok: false, code: "invalid_agreement", message: failure }
    : { ok: true, agreement, creatorConfirms: true };
}

export function canClientConfirm(state: CommissionState): boolean {
  return state === "negotiating" || DEADLINE_ONLY_STATES.includes(state);
}

export function canClientRequestChanges(
  state: CommissionState,
  awaitingClient: boolean,
): boolean {
  return (
    state === "negotiating" ||
    (DEADLINE_ONLY_STATES.includes(state) && awaitingClient)
  );
}
