import { computeAmounts } from "@/lib/money/decimal";
import {
  AMBIGUITY_SEVERITY,
  type Agreement,
  type Ambiguity,
  type AmbiguityCode,
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

export const DEFAULT_DEPOSIT_PERCENT = 50;

/** Phrases that never count as an exact deadline (FR-1.9). */
const VAGUE_DEADLINE =
  /\b(asap|a\.s\.a\.p|as soon as possible|whenever|any ?time|no rush|no hurry|when you'?re free|secepatnya|secepat mungkin|sesegera mungkin|sebisanya|kapan[- ]?(aja|saja|pun|kapan)|(tidak|nggak|ngga|gak|ga) (usah )?buru[- ]?buru|santai (aja|saja)|hayaku|itsudemo)\b/i;

/**
 * Phrases that are relative to the paste date, so the AI's resolved date needs
 * the creator's confirmation (FR-1.5). Backstop for when the model forgets
 * `is_relative`.
 */
const WEEKDAY =
  "(mon|tues?|wed(nes)?|thu(rs)?|fri|sat(ur)?|sun)(day)?|senin|selasa|rabu|kamis|jum'?at|sabtu|minggu";
const RELATIVE_DATE = new RegExp(
  `\\b(today|tonight|tomorrow|besok|lusa|hari ini|nanti malam` +
    `|(next|this|coming) (week|month|weekend|${WEEKDAY})` +
    `|(by|on|before|until|sebelum|hari) (${WEEKDAY})` +
    `|in (a|an|one|two|three|\\d+) (day|week|month)s?` +
    `|\\d+ (day|week|month)s? (from now|later)` +
    `|(minggu|pekan|bulan) (ini|depan)` +
    `|\\d+ (hari|minggu|pekan|bulan) lagi` +
    `|(${WEEKDAY}) (ini|depan))\\b`,
  "i",
);
/** "the 20th", "tanggal 20": a day with no month or year. */
const DAY_ONLY = /\b\d{1,2}(st|nd|rd|th)\b|\b(tanggal|tgl\.?) ?\d{1,2}\b/i;
const HAS_MONTH_OR_YEAR =
  /\b(jan(uary|uari)?|feb(ruary|ruari)?|mar(ch|et)?|apr(il)?|may|mei|june?|juni|july?|juli|aug(ust|ustus)?|agu(stus)?|sep(t(ember)?)?|oct(ober)?|okt(ober)?|nov(ember)?|dec(ember)?|des(ember)?)\b|\b\d{4}\b|\d{1,2}[/-]\d{1,2}/i;

export function isRelativeDeadlineText(rawText: string): boolean {
  if (RELATIVE_DATE.test(rawText)) return true;
  return DAY_ONLY.test(rawText) && !HAS_MONTH_OR_YEAR.test(rawText);
}

/** Used when a flag has no question from the model (FR-1.4). English. */
const DEFAULT_QUESTIONS_EN: Partial<Record<AmbiguityCode, string>> = {
  MISSING_PRICE: "What total price are we agreeing on?",
  AMBIGUOUS_CURRENCY: "Which currency is this price in?",
  UNSUPPORTED_CURRENCY: "PayPal can't invoice this currency. Can we use USD?",
  SCOPE_UNCLEAR: "What exactly should I deliver?",
  MISSING_DEADLINE: "What exact date do you need this delivered by?",
  RELATIVE_DEADLINE: "Can you confirm the exact delivery date?",
  PAST_DEADLINE: "That date has passed. What date should we use?",
  MISSING_REVISIONS: "How many revision rounds should be included?",
  MISSING_DEPOSIT_TERMS: "Is a 50% deposit okay with you?",
  DEPOSIT_EXCEEDS_TOTAL: "What deposit amount should we use?",
  MISSING_USAGE_RIGHTS:
    "Will this be used commercially, and do you need to credit me?",
  MISSING_CLIENT_EMAIL: "What is your PayPal email for the invoice?",
};

/** Same questions for Indonesian chats (source_language "id"). */
const DEFAULT_QUESTIONS_ID: Partial<Record<AmbiguityCode, string>> = {
  MISSING_PRICE: "Total harganya berapa yang kita sepakati, Kak?",
  AMBIGUOUS_CURRENCY: "Harganya dalam mata uang apa, Kak?",
  UNSUPPORTED_CURRENCY:
    "PayPal tidak bisa membuat invoice dalam mata uang ini. Boleh pakai USD, Kak?",
  SCOPE_UNCLEAR: "Apa saja yang harus saya kerjakan, Kak?",
  MISSING_DEADLINE: "Deadline-nya tanggal berapa persisnya, Kak?",
  RELATIVE_DEADLINE: "Boleh dikonfirmasi tanggal pengirimannya, Kak?",
  PAST_DEADLINE: "Tanggal itu sudah lewat. Pakai tanggal berapa, Kak?",
  MISSING_REVISIONS: "Berapa kali revisi yang sudah termasuk, Kak?",
  MISSING_DEPOSIT_TERMS: "DP 50% oke ya, Kak?",
  DEPOSIT_EXCEEDS_TOTAL: "DP-nya berapa yang kita pakai, Kak?",
  MISSING_USAGE_RIGHTS:
    "Hasilnya dipakai untuk komersial atau tidak, dan perlu kredit ke saya, Kak?",
  MISSING_CLIENT_EMAIL: "Email PayPal Kakak apa untuk invoice-nya?",
};

const DEFAULT_QUESTIONS_JA: Partial<Record<AmbiguityCode, string>> = {
  MISSING_PRICE: "合計金額はおいくらでよろしいでしょうか？",
  AMBIGUOUS_CURRENCY: "金額の通貨を教えていただけますか？",
  UNSUPPORTED_CURRENCY:
    "この通貨ではPayPalの請求書を作成できません。USDでもよろしいでしょうか？",
  SCOPE_UNCLEAR: "具体的に何を納品すればよろしいでしょうか？",
  MISSING_DEADLINE: "納品日は具体的に何月何日がよろしいでしょうか？",
  RELATIVE_DEADLINE: "納品日を確認させていただけますか？",
  PAST_DEADLINE: "その日付はすでに過ぎています。何日にしましょうか？",
  MISSING_REVISIONS: "修正は何回まで含めればよろしいでしょうか？",
  MISSING_DEPOSIT_TERMS: "前金50%でよろしいでしょうか？",
  DEPOSIT_EXCEEDS_TOTAL: "前金はいくらにしましょうか？",
  MISSING_USAGE_RIGHTS:
    "商用で使用されますか？また、制作者としてのクレジット表記は可能でしょうか？",
  MISSING_CLIENT_EMAIL:
    "請求書をお送りするPayPalのメールアドレスを教えていただけますか？",
};

const JAPANESE_TEXT = /[぀-ヿ一-鿿]/;
const INDONESIAN_WORDS =
  /\b(kak|kakak|gak|nggak|enggak|ga|aja|dong|deh|sih|banget|bisa|boleh|berapa|harga|revisi|tanggal|tgl|bayar|udah|sudah|belum|nanti|makasih|terima kasih|sip|rb|ribu|juta|jt|buru-buru)\b/i;

function defaultQuestions(sourceLanguage: string | undefined, dmText: string) {
  if (sourceLanguage === "id") return DEFAULT_QUESTIONS_ID;
  if (sourceLanguage === "ja") return DEFAULT_QUESTIONS_JA;
  if (sourceLanguage === "en") return DEFAULT_QUESTIONS_EN;
  if (JAPANESE_TEXT.test(dmText)) return DEFAULT_QUESTIONS_JA;
  if (INDONESIAN_WORDS.test(dmText)) return DEFAULT_QUESTIONS_ID;
  return DEFAULT_QUESTIONS_EN;
}

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
    severity: AMBIGUITY_SEVERITY[a.code],
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

  // Deadline. The AI can't supply a date for a vague phrase or with no source
  // phrase at all (FR-1.9).
  const rawDeadline = result.deadline.raw_text?.trim();
  if (
    result.deadline.date !== null &&
    (!rawDeadline || VAGUE_DEADLINE.test(rawDeadline))
  ) {
    result.deadline.date = null;
    result.deadline.is_relative = false;
  }
  // The model can forget is_relative; the phrase itself decides (FR-1.5).
  if (
    result.deadline.date !== null &&
    rawDeadline &&
    isRelativeDeadlineText(rawDeadline)
  ) {
    result.deadline.is_relative = true;
  }
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
    deadlineDate !== null &&
    result.deadline.is_relative &&
    !hasFlag(flags, ["RELATIVE_DEADLINE"], "/deadline")
  ) {
    flags.push({
      code: "RELATIVE_DEADLINE",
      severity: "warning",
      field: "/deadline/date",
      message: `The deadline was relative. Resolved to ${deadlineDate} using today's date (${pasteDate}); please confirm.`,
      source_quote: result.deadline.raw_text ?? null,
      suggested_question: null,
    });
  }
  if (
    deadlineDate === null &&
    !hasAnyFlagOn(
      flags.filter((a) =>
        ["MISSING_DEADLINE", "CONFLICTING_VALUES"].includes(a.code),
      ),
      "/deadline",
    )
  ) {
    flags.push({
      code: "MISSING_DEADLINE",
      severity: "blocker",
      field: "/deadline/date",
      message: result.deadline.raw_text
        ? "A deadline was mentioned, but it has no exact date."
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

  // Usage rights.
  const rights = result.usage_rights;
  if (
    (!rights ||
      (rights.commercial == null &&
        rights.credit_required == null &&
        rights.notes == null)) &&
    !hasFlag(flags, ["MISSING_USAGE_RIGHTS"], "/usage_rights")
  ) {
    flags.push({
      code: "MISSING_USAGE_RIGHTS",
      severity: "blocker",
      field: "/usage_rights",
      message: "The chat says nothing about commercial use, credit, or usage.",
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

  // No deposit mentioned means the default applies. An explicit "no deposit"
  // has no flag and stays none (FR-6.7).
  const depositFlag = flags.find((a) => a.code === "MISSING_DEPOSIT_TERMS");
  if (depositFlag && result.deposit.type === "none") {
    result.deposit = {
      type: "percent",
      percent: DEFAULT_DEPOSIT_PERCENT,
      fixed_amount: null,
    };
    depositFlag.message = `No deposit was mentioned, so the default ${DEFAULT_DEPOSIT_PERCENT}% is used. Please confirm.`;
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

  // Blockers first; order is otherwise preserved. Questions the model left
  // empty get a default in the chat's language.
  const questions = defaultQuestions(
    result.extraction?.source_language,
    dmText,
  );
  result.ambiguities = [
    ...flags.filter((a) => a.severity === "blocker"),
    ...flags.filter((a) => a.severity !== "blocker"),
  ].map((a) => ({
    ...a,
    suggested_question: a.suggested_question ?? questions[a.code] ?? null,
  }));

  // Confidence cannot stay high when blockers exist.
  const blockers = result.ambiguities.filter(
    (a) => a.severity === "blocker",
  ).length;
  const cap = Math.max(0.1, 0.95 - 0.1 * blockers);
  if (result.extraction) {
    result.extraction = {
      ...result.extraction,
      confidence: Math.min(result.extraction.confidence, cap),
    };
  }

  return result;
}
