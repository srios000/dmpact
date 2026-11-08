import {
  generateStructured,
  ModelCallError,
  StructuredOutputError,
  type ModelClient,
} from "@/lib/ai/gemini";
import { withComputedAmounts } from "@/lib/money/agreement";
import { currencyExponent, toMinor } from "@/lib/money/decimal";
import type { Agreement, ServiceType } from "@/lib/schema/agreement";
import {
  counterofferSchema,
  negotiationSchema,
  type Counteroffer,
  type Negotiation,
  type Strategy,
} from "@/lib/schema/negotiation";
import type { RateCardSettings } from "@/lib/schema/rate-card";
import { detectMismatch, type MismatchCheck } from "./mismatch";
import {
  buildCounterofferUserMessage,
  COUNTEROFFER_PROMPT_VERSION,
  COUNTEROFFER_SYSTEM_PROMPT,
  counterofferDraftsSchema,
  type CounterofferDrafts,
  type CounterofferNumbers,
} from "./prompt";

export const MIN_SPLIT_DEPOSIT_PCT = 10;
export const MAX_SPLIT_DEPOSIT_PCT = 50;

/** Cheaper services a reduced scope may switch to, closest to the request first. */
const SCOPE_DOWNGRADES: Partial<Record<ServiceType, ServiceType[]>> = {
  mix_and_master: ["mixing", "mastering"],
};

export type CounterofferInput = {
  agreement: Agreement;
  settings: RateCardSettings;
  /** YYYY-MM-DD */
  today: string;
  /** null skips the model and uses the template messages. */
  client: ModelClient | null;
};

export type CounterofferResult = {
  check: MismatchCheck;
  negotiation: Negotiation;
  /** True when the messages are templates because the model failed. */
  fallback: boolean;
};

function withPrice(agreement: Agreement, total: string): Agreement {
  return withComputedAmounts({
    ...agreement,
    price: { ...agreement.price, total },
  });
}

/**
 * The deposit for split_milestones: what the client's budget covers now,
 * kept between 10% and 50% of the rate card price.
 */
export function splitDepositPct(
  budget: string,
  price: string,
  currency: string,
): number {
  const exponent = currencyExponent(currency);
  const pct = Math.floor(
    (toMinor(budget, exponent) * 100) / toMinor(price, exponent),
  );
  return Math.min(MAX_SPLIT_DEPOSIT_PCT, Math.max(MIN_SPLIT_DEPOSIT_PCT, pct));
}

/**
 * The closest smaller scope the budget covers on the rate card: the current
 * service first, then its downgrades in order, each with as many of the current
 * revisions as still fit. Null when nothing fits.
 */
export function smallerScope(
  agreement: Agreement,
  settings: RateCardSettings,
  today: string,
): CounterofferNumbers["reduce_scope"] {
  const services = [
    agreement.service_type,
    ...(SCOPE_DOWNGRADES[agreement.service_type] ?? []),
  ];
  const current = agreement.revisions.included;
  const counts =
    current === null
      ? [null]
      : Array.from({ length: current + 1 }, (_, i) => current - i);
  for (const service_type of services) {
    for (const included of counts) {
      const candidate = {
        ...agreement,
        service_type,
        revisions: { ...agreement.revisions, included },
      };
      if (detectMismatch(candidate, settings, today).outcome === "fair") {
        return { service_type, max_revisions: included };
      }
    }
  }
  return null;
}

/** Apply the model's smaller scope at the client's budget, or null if invalid. */
function reducedScope(
  agreement: Agreement,
  draft: NonNullable<CounterofferDrafts["reduce_scope"]>,
  target: CounterofferNumbers["reduce_scope"],
): Agreement | null {
  if (!target || draft.service_type !== target.service_type) return null;

  const ids = new Set(agreement.deliverables.map((d) => d.id));
  if (!draft.keep_deliverable_ids.every((id) => ids.has(id))) return null;
  const keep = new Set(draft.keep_deliverable_ids);

  const current = agreement.revisions.included;
  const asked = draft.revisions_included;
  // The model's message names its count, so a higher one drops the option.
  if (asked !== null && current !== null && asked > current) return null;
  const max = target.max_revisions;
  if (asked !== null && max !== null && asked > max) return null;
  const included = asked ?? max;

  return withComputedAmounts({
    ...agreement,
    service_type: draft.service_type,
    deliverables: agreement.deliverables.filter((d) => keep.has(d.id)),
    revisions: { ...agreement.revisions, included },
  });
}

function templateDrafts(
  agreement: Agreement,
  n: CounterofferNumbers,
): CounterofferDrafts {
  const name = agreement.parties?.client?.display_name;
  const hi = name ? `Hi ${name}!` : "Hi!";
  const price = `${n.rate_card_price} ${n.currency}`;
  return {
    reduce_scope: null,
    adjust_price: {
      summary: `Keep the full scope for ${price}`,
      message_draft: `${hi} Thanks for the details. Based on my rates, the full scope comes to ${price}. If that works for you, I can get started.`,
    },
    split_milestones: {
      summary: `${price} in 2 payments: ${n.split_deposit} ${n.currency} now`,
      message_draft: `${hi} The full scope comes to ${price} on my rates. To make it easier, you can pay ${n.split_deposit} ${n.currency} now and the remaining ${n.split_balance} ${n.currency} on delivery.`,
    },
  };
}

/**
 * Up to 3 counteroffers when the budget is under the rate card (FR-3.2, FR-3.3).
 * The model only writes summaries and messages and picks a smaller scope; every
 * amount comes from the rate card and is computed here (FR-3.7).
 */
export async function generateCounteroffers({
  agreement,
  settings,
  today,
  client,
}: CounterofferInput): Promise<CounterofferResult> {
  const check = detectMismatch(agreement, settings, today);
  if (check.outcome !== "mismatch") {
    return {
      check,
      negotiation: { mismatch: check.mismatch, options: [] },
      fallback: false,
    };
  }

  // A mismatch always has a price, a currency and an estimate.
  const budget = agreement.price.total!;
  const currency = agreement.price.currency!;
  const ratePrice = check.estimate!.total;

  const adjusted = withPrice(agreement, ratePrice);
  const split = withComputedAmounts({
    ...adjusted,
    deposit: {
      type: "percent",
      percent: splitDepositPct(budget, ratePrice, currency),
      fixed_amount: null,
    },
  });

  const numbers: CounterofferNumbers = {
    currency,
    client_budget: budget,
    rate_card_price: ratePrice,
    split_deposit: split.deposit.amount!,
    split_balance: split.balance_amount!,
    reduce_scope: smallerScope(agreement, settings, today),
  };

  let drafts: CounterofferDrafts;
  let fallback = false;
  if (client === null) {
    drafts = templateDrafts(agreement, numbers);
    fallback = true;
  } else {
    try {
      const result = await generateStructured(
        {
          system: COUNTEROFFER_SYSTEM_PROMPT,
          user: buildCounterofferUserMessage(agreement, numbers),
        },
        counterofferDraftsSchema,
        { client, promptVersion: COUNTEROFFER_PROMPT_VERSION },
      );
      drafts = result.data;
    } catch (error) {
      if (
        !(error instanceof ModelCallError) &&
        !(error instanceof StructuredOutputError)
      ) {
        throw error;
      }
      drafts = templateDrafts(agreement, numbers);
      fallback = true;
    }
  }

  // A smaller scope is offered only if the rate card says the budget covers it.
  let reduced = drafts.reduce_scope
    ? reducedScope(agreement, drafts.reduce_scope, numbers.reduce_scope)
    : null;
  if (reduced && detectMismatch(reduced, settings, today).outcome !== "fair") {
    reduced = null;
  }

  const candidates: [
    Strategy,
    Agreement | null,
    CounterofferDrafts["adjust_price"] | null,
  ][] = [
    ["reduce_scope", reduced, drafts.reduce_scope],
    ["adjust_price", adjusted, drafts.adjust_price],
    [
      "split_milestones",
      split.deposit.amount === adjusted.deposit.amount ? null : split,
      drafts.split_milestones,
    ],
  ];

  const options: Counteroffer[] = [];
  for (const [strategy, proposed, draft] of candidates) {
    if (!proposed || !draft) continue;
    const option = counterofferSchema.safeParse({
      id: `opt${options.length + 1}`,
      strategy,
      summary: draft.summary,
      message_draft: draft.message_draft,
      proposed_agreement: proposed,
    });
    if (option.success) options.push(option.data);
  }

  return {
    check,
    negotiation: negotiationSchema.parse({ mismatch: check.mismatch, options }),
    fallback,
  };
}
