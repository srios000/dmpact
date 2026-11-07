/**
 * Pure scoring for the negotiation eval. Amount checks guard FR-3.7: a message
 * may only mention amounts that the option itself carries. Language checks
 * guard #32: the message is in English, whatever language the client wrote in.
 */
import {
  MAX_MESSAGE_WORDS,
  REPLY_LANGUAGE,
} from "../src/lib/ai/negotiate/prompt";
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
  /** Language the message looks like, or null if the eval can't tell. */
  language: string | null;
  /** False when the message isn't in the expected language. */
  languageOk: boolean;
  /** Space-separated words; null for Japanese. */
  words: number | null;
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
  /** Options whose message is in English, for every client (#32). */
  languageAccuracy: number;
  /** Options over MAX_MESSAGE_WORDS (info, not a gate). */
  overLength: number;
  optionCount: number;
  strategies: Record<Strategy, number>;
};

const NUMBER = String.raw`(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?`;

function normalize(whole: string, fraction: string | undefined): string {
  return Number(`${whole.replace(/,/g, "")}.${fraction ?? "0"}`).toFixed(2);
}

/** Money amounts in a message: numbers next to "$", "USD", "dollars" or "dolar". */
export function findMoneyAmounts(text: string, currency: string): string[] {
  const code = currency.replace(/[^A-Z]/g, "");
  const pattern = new RegExp(
    String.raw`(?:\$|\b${code})\s?${NUMBER}|${NUMBER}\s?(?:${code}\b|dollars?\b|dolar\b)`,
    "gi",
  );
  const found = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const [, w1, f1, w2, f2] = match;
    found.add(w1 ? normalize(w1, f1) : normalize(w2, f2));
  }
  return [...found];
}

const LANGUAGE_MARKERS: Record<"en" | "id", Set<string>> = {
  en: new Set(
    "the and you your for with can would thanks thank if is this that my now on of to it get".split(
      " ",
    ),
  ),
  id: new Set(
    "kak halo makasih terima kasih untuk aku kamu bisa jadi sesuai dulu sisanya kalau dengan yang dan ini itu harga bayar nanti udah sudah mulai cocok lengkap biar pas".split(
      " ",
    ),
  ),
};

/**
 * A rough guess at the message language: "ja" if it has kana, otherwise
 * whichever of English and Indonesian has more common words, or null on a tie.
 */
export function guessLanguage(text: string): "en" | "id" | "ja" | null {
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const count = (lang: "en" | "id") =>
    words.filter((w) => LANGUAGE_MARKERS[lang].has(w)).length;
  const en = count("en");
  const id = count("id");
  if (en === id) return null;
  return en > id ? "en" : "id";
}

/** Languages the eval can recognize; others aren't scored. */
const CHECKED_LANGUAGES = new Set(["en", "id", "ja"]);

function asAmount(value: string | null | undefined): string | null {
  return value ? Number(value).toFixed(2) : null;
}

export function scoreOption(
  option: Counteroffer,
  budget: string,
  expectedLanguage = REPLY_LANGUAGE,
): OptionScore {
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

  const language = guessLanguage(option.message_draft);
  const languageOk =
    !CHECKED_LANGUAGES.has(expectedLanguage) || language === expectedLanguage;
  const words =
    language === "ja"
      ? null
      : option.message_draft.split(/\s+/).filter(Boolean).length;

  return {
    strategy,
    unknownAmounts,
    missingAmount,
    amountsOk: unknownAmounts.length === 0 && missingAmount === null,
    language,
    languageOk,
    words,
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
      (!fallback &&
        options.length > 0 &&
        options.every((o) => o.amountsOk && o.languageOk)));

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
    languageAccuracy: ratio(
      options.filter((o) => o.languageOk).length,
      options.length,
    ),
    overLength: options.filter(
      (o) => o.words !== null && o.words > MAX_MESSAGE_WORDS,
    ).length,
    optionCount: options.length,
    strategies,
  };
}

export const NEGOTIATION_TARGETS = {
  mismatchAccuracy: 1,
  amountAccuracy: 1,
  languageAccuracy: 1,
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
