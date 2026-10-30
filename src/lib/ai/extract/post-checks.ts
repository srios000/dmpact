import { computeAmounts } from "@/lib/money/decimal";
import type {
  Agreement,
  Ambiguity,
  AmbiguityCode,
} from "@/lib/schema/agreement";
import { findInjectionText } from "./injection";

/** Currencies PayPal Invoicing accepts for this project. IDR is not one. */
export const SUPPORTED_CURRENCIES = new Set([
  "AUD",
  "BRL",
  "CAD",
  "CHF",
  "CNY",
  "CZK",
  "DKK",
  "EUR",
  "GBP",
  "HKD",
  "HUF",
  "ILS",
  "JPY",
  "MXN",
  "MYR",
  "NOK",
  "NZD",
  "PHP",
  "PLN",
  "SEK",
  "SGD",
  "THB",
  "TWD",
  "USD",
]);

const BLOCKER_CODES = new Set<AmbiguityCode>([
  "MISSING_PRICE",
  "AMBIGUOUS_CURRENCY",
  "UNSUPPORTED_CURRENCY",
  "CONFLICTING_VALUES",
  "SCOPE_UNCLEAR",
  "PAST_DEADLINE",
  "DEPOSIT_EXCEEDS_TOTAL",
]);

export type PostCheckInput = {
  agreement: Agreement;
  dmText: string;
  /** YYYY-MM-DD */
  pasteDate: string;
};

function hasFlag(
  list: Ambiguity[],
  codes: AmbiguityCode[],
  fieldPrefix: string,
): boolean {
  return list.some(
    (a) =>
      codes.includes(a.code) &&
      (a.field === fieldPrefix || a.field.startsWith(`${fieldPrefix}/`)),
  );
}

/** Any flag on this field, whatever the code, means the model already dealt with it. */
function hasAnyFlagOn(list: Ambiguity[], fieldPrefix: string): boolean {
  return list.some(
    (a) => a.field === fieldPrefix || a.field.startsWith(`${fieldPrefix}/`),
  );
}

/**
 * Deterministic checks that must not depend on the model alone. Returns a new
 * agreement with: canonical severities, added flags, sequential deliverable
 * ids, server-computed money, and a confidence capped by the blocker count.
 */
export function runPostChecks({
  agreement,
  dmText,
  pasteDate,
}: PostCheckInput): Agreement {
  const result: Agreement = structuredClone(agreement);
  const flags: Ambiguity[] = result.ambiguities.map((a) => ({
    ...a,
    severity:
      a.code === "OTHER"
        ? a.severity
        : BLOCKER_CODES.has(a.code)
          ? "blocker"
          : "warning",
  }));

  // Deliverable ids are d1, d2, ... in order.
  result.deliverables = result.deliverables.map((d, i) => ({
    ...d,
    id: `d${i + 1}`,
  }));

  // Currency.
  if (
    result.price.currency !== null &&
    !SUPPORTED_CURRENCIES.has(result.price.currency)
  ) {
    if (!hasFlag(flags, ["UNSUPPORTED_CURRENCY"], "/price/currency")) {
      flags.push({
        code: "UNSUPPORTED_CURRENCY",
        severity: "blocker",
        field: "/price/currency",
        message: `${result.price.currency} cannot be invoiced through PayPal. Agree on a supported currency (e.g. USD) before sending.`,
        source_quote: null,
        suggested_question: null,
      });
    }
  }

  // Price.
  if (
    result.price.total === null &&
    !hasAnyFlagOn(
      flags.filter(
        (a) => a.code === "MISSING_PRICE" || a.code === "CONFLICTING_VALUES",
      ),
      "/price",
    )
  ) {
    flags.push({
      code: "MISSING_PRICE",
      severity: "blocker",
      field: "/price/total",
      message: "No agreed price was found in the chat.",
      source_quote: null,
      suggested_question: null,
    });
  }
  if (
    result.price.total !== null &&
    result.price.currency === null &&
    !hasFlag(flags, ["AMBIGUOUS_CURRENCY"], "/price/currency")
  ) {
    flags.push({
      code: "AMBIGUOUS_CURRENCY",
      severity: "blocker",
      field: "/price/currency",
      message:
        "The currency was not stated clearly. Confirm it with the client.",
      source_quote: null,
      suggested_question: null,
    });
  }

  // Deadline.
  const deadlineDate = result.deadline.date;
  if (
    deadlineDate !== null &&
    deadlineDate < pasteDate &&
    !hasFlag(flags, ["PAST_DEADLINE"], "/deadline")
  ) {
    flags.push({
      code: "PAST_DEADLINE",
      severity: "blocker",
      field: "/deadline/date",
      message: `The deadline ${deadlineDate} is before today (${pasteDate}).`,
      source_quote: result.deadline.raw_text ?? null,
      suggested_question: null,
    });
  }
  if (
    result.deadline.is_relative &&
    !hasFlag(flags, ["RELATIVE_DEADLINE"], "/deadline")
  ) {
    flags.push({
      code: "RELATIVE_DEADLINE",
      severity: "warning",
      field: "/deadline/date",
      message: deadlineDate
        ? `The deadline was relative. Resolved to ${deadlineDate} using today's date (${pasteDate}); please confirm.`
        : "The deadline was relative and could not be resolved to a date.",
      source_quote: result.deadline.raw_text ?? null,
      suggested_question: null,
    });
  }
  if (
    deadlineDate === null &&
    !hasAnyFlagOn(
      flags.filter((a) =>
        [
          "MISSING_DEADLINE",
          "RELATIVE_DEADLINE",
          "CONFLICTING_VALUES",
        ].includes(a.code),
      ),
      "/deadline",
    )
  ) {
    flags.push({
      code: result.deadline.raw_text ? "RELATIVE_DEADLINE" : "MISSING_DEADLINE",
      severity: "warning",
      field: "/deadline/date",
      message: result.deadline.raw_text
        ? "A deadline was mentioned but could not be turned into a date."
        : "No deadline was agreed.",
      source_quote: result.deadline.raw_text ?? null,
      suggested_question: null,
    });
  }

  // Revisions.
  if (
    result.revisions.included === null &&
    !hasAnyFlagOn(
      flags.filter((a) =>
        ["MISSING_REVISIONS", "VAGUE_REVISIONS", "CONFLICTING_VALUES"].includes(
          a.code,
        ),
      ),
      "/revisions",
    )
  ) {
    flags.push({
      code: "MISSING_REVISIONS",
      severity: "warning",
      field: "/revisions/included",
      message: "The number of included revisions was not stated.",
      source_quote: null,
      suggested_question: null,
    });
  }

  // Client email.
  const email = result.parties?.client?.email ?? null;
  if (
    email === null &&
    !hasFlag(flags, ["MISSING_CLIENT_EMAIL"], "/parties/client/email")
  ) {
    flags.push({
      code: "MISSING_CLIENT_EMAIL",
      severity: "warning",
      field: "/parties/client/email",
      message: "The client's email is needed to send the PayPal invoice.",
      source_quote: null,
      suggested_question: null,
    });
  }

  // Money is computed here; whatever the model wrote is discarded.
  delete result.deposit.amount;
  delete result.balance_amount;
  let amounts: ReturnType<typeof computeAmounts> = null;
  try {
    amounts = computeAmounts(
      result.price.total,
      result.price.currency,
      result.deposit,
    );
  } catch {
    amounts = null;
  }
  if (amounts) {
    result.deposit.amount = amounts.deposit;
    result.balance_amount = amounts.balance;
    if (
      amounts.exceeds &&
      !hasFlag(flags, ["DEPOSIT_EXCEEDS_TOTAL"], "/deposit")
    ) {
      flags.push({
        code: "DEPOSIT_EXCEEDS_TOTAL",
        severity: "blocker",
        field: "/deposit",
        message: `The deposit (${amounts.deposit}) is higher than the total price (${result.price.total}).`,
        source_quote: null,
        suggested_question: null,
      });
    }
  } else if (
    (result.deposit.type === "percent" && result.deposit.percent === null) ||
    (result.deposit.type === "fixed" && result.deposit.fixed_amount === null)
  ) {
    flags.push({
      code: "OTHER",
      severity: "warning",
      field: "/deposit",
      message: `Deposit type is "${result.deposit.type}" but its value is missing.`,
      source_quote: null,
      suggested_question: null,
    });
  }

  // Prompt-injection backstop.
  const injected = findInjectionText(dmText);
  if (
    injected !== null &&
    !flags.some((a) => a.code === "OTHER" && a.field === "/")
  ) {
    flags.push({
      code: "OTHER",
      severity: "warning",
      field: "/",
      message:
        "The chat contains instruction-like text aimed at the AI. It was ignored; only agreed terms were extracted.",
      source_quote: injected,
      suggested_question: null,
    });
  }

  // Blockers first; order is otherwise preserved.
  result.ambiguities = [
    ...flags.filter((a) => a.severity === "blocker"),
    ...flags.filter((a) => a.severity !== "blocker"),
  ];

  // Confidence cannot stay high when blockers exist.
  const blockers = result.ambiguities.filter(
    (a) => a.severity === "blocker",
  ).length;
  const cap = Math.max(0.1, 0.95 - 0.1 * blockers);
  const confidence = result.extraction?.confidence;
  if (confidence !== undefined) {
    result.extraction = {
      ...result.extraction,
      confidence: Math.min(confidence, cap),
    };
  }

  return result;
}
