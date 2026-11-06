/**
 * Pure scoring for the negotiation eval. Amount checks guard FR-3.7: a message
 * may only mention amounts that the option itself carries.
 */
import { fromMinor, toMinor } from "../src/lib/money/decimal";
import type { Agreement } from "../src/lib/schema/agreement";
import {
  negotiationSchema,
  type Counteroffer,
  type Strategy,
} from "../src/lib/schema/negotiation";

export type OptionScore = {
  strategy: Strategy;
  /** Amounts in the message that the option doesn't carry. */
  unknownAmounts: string[];
  /** The amount this strategy's message must name, if it's missing. */
  missingAmount: string | null;
  amountsOk: boolean;
};

export type NegotiationCaseScore = {
  expectMismatch: boolean;
  detected: boolean;
  mismatchOk: boolean;
  negotiationValid: boolean;
  fallback: boolean;
  options: OptionScore[];
  pass: boolean;
};

export type NegotiationSummary = {
  cases: number;
  passed: number;
  /** Detected mismatch matches the fixture (FR-3.5: never invent one). */
  mismatchAccuracy: number;
  /** Mismatch cases where the model wrote the messages, not the templates. */
  modelSuccessRate: number;
  /** Options whose message names only the option's own amounts (FR-3.7). */
  amountAccuracy: number;
  optionCount: number;
  strategies: Record<Strategy, number>;
};

const NUMBER = String.raw`(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?`;

function normalize(whole: string, fraction: string | undefined): string {
  return Number(`${whole.replace(/,/g, "")}.${fraction ?? "0"}`).toFixed(2);
}

/** Money amounts in a message: numbers next to "$", "USD" or "dollars". */
export function findMoneyAmounts(text: string, currency: string): string[] {
  const code = currency.replace(/[^A-Z]/g, "");
  const pattern = new RegExp(
    String.raw`(?:\$|\b${code})\s?${NUMBER}|${NUMBER}\s?(?:${code}\b|dollars?\b)`,
    "gi",
  );
  const found = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const [, w1, f1, w2, f2] = match;
    found.add(w1 ? normalize(w1, f1) : normalize(w2, f2));
  }
  return [...found];
}

function asAmount(value: string | null | undefined): string | null {
  return value ? Number(value).toFixed(2) : null;
}

export function scoreOption(option: Counteroffer, budget: string): OptionScore {
  const { proposed_agreement: proposed, strategy } = option;
  const currency = proposed.price.currency ?? "USD";
  const allowed = new Set(
    [
      budget,
      proposed.price.total,
      proposed.deposit.amount,
      proposed.balance_amount,
    ]
      .map(asAmount)
      .filter((v) => v !== null),
  );
  const mentioned = findMoneyAmounts(option.message_draft, currency);
  const unknownAmounts = mentioned.filter((a) => !allowed.has(a));

  const key =
    strategy === "split_milestones"
      ? asAmount(proposed.deposit.amount)
      : asAmount(proposed.price.total);
  const missingAmount = key && !mentioned.includes(key) ? key : null;

  return {
    strategy,
    unknownAmounts,
    missingAmount,
    amountsOk: unknownAmounts.length === 0 && missingAmount === null,
  };
}

export function scoreNegotiationCase(input: {
  expectMismatch: boolean;
  agreement: Agreement;
  result: {
    negotiation: { mismatch: { detected: boolean }; options: Counteroffer[] };
    fallback: boolean;
  };
}): NegotiationCaseScore {
  const { negotiation, fallback } = input.result;
  const detected = negotiation.mismatch.detected;
  const mismatchOk = detected === input.expectMismatch;
  const negotiationValid = negotiationSchema.safeParse(negotiation).success;
  const budget = input.agreement.price.total ?? "0";
  const options = negotiation.options.map((o) => scoreOption(o, budget));

  const pass =
    mismatchOk &&
    negotiationValid &&
    (!detected ||
      (!fallback && options.length > 0 && options.every((o) => o.amountsOk)));

  return {
    expectMismatch: input.expectMismatch,
    detected,
    mismatchOk,
    negotiationValid,
    fallback,
    options,
    pass,
  };
}

export function summarizeNegotiation(
  scores: NegotiationCaseScore[],
): NegotiationSummary {
  const ratio = (n: number, d: number) => (d === 0 ? 1 : n / d);
  const mismatchCases = scores.filter((s) => s.detected);
  const options = scores.flatMap((s) => s.options);
  const strategies: Record<Strategy, number> = {
    reduce_scope: 0,
    adjust_price: 0,
    split_milestones: 0,
  };
  for (const o of options) strategies[o.strategy] += 1;

  return {
    cases: scores.length,
    passed: scores.filter((s) => s.pass).length,
    mismatchAccuracy: ratio(
      scores.filter((s) => s.mismatchOk).length,
      scores.length,
    ),
    modelSuccessRate: ratio(
      mismatchCases.filter((s) => !s.fallback).length,
      mismatchCases.length,
    ),
    amountAccuracy: ratio(
      options.filter((o) => o.amountsOk).length,
      options.length,
    ),
    optionCount: options.length,
    strategies,
  };
}

export const NEGOTIATION_TARGETS = {
  mismatchAccuracy: 1,
  amountAccuracy: 1,
  modelSuccessRate: 0.9,
};

export function evaluateNegotiationGates(summary: NegotiationSummary): {
  pass: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  for (const [key, target] of Object.entries(NEGOTIATION_TARGETS)) {
    const actual = summary[key as keyof typeof NEGOTIATION_TARGETS];
    if (actual < target) {
      failures.push(`${key} ${pct(actual)} < ${pct(target)}`);
    }
  }
  return { pass: failures.length === 0, failures };
}

/**
 * A fair case turned into a near miss: the budget drops to `factor` of the
 * estimate, so the model gets cases where a smaller scope can fit.
 */
export function lowerBudget(
  agreement: Agreement,
  estimate: string,
  factor = 0.7,
): Agreement {
  const minor = Math.floor(toMinor(estimate, 2) * factor);
  return {
    ...agreement,
    price: { ...agreement.price, total: fromMinor(minor, 2) },
  };
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, index)];
}
