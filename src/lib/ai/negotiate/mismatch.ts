import { currencyExponent, toMinor } from "@/lib/money/decimal";
import {
  estimatePrice,
  type EstimateItem,
  type PriceEstimate,
} from "@/lib/money/estimate";
import type { Agreement, ServiceType } from "@/lib/schema/agreement";
import type { Negotiation } from "@/lib/schema/negotiation";
import type { RateCardSettings } from "@/lib/schema/rate-card";

export type MismatchOutcome = "mismatch" | "fair" | "skipped";

export type MismatchCheck = {
  /** `skipped` means there was nothing to compare, not that the budget is fair. */
  outcome: MismatchOutcome;
  mismatch: Negotiation["mismatch"];
  estimate: PriceEstimate | null;
  /** How far the budget is under the estimate, rounded. Negative when over. */
  gap_pct: number | null;
};

const SERVICE_LABELS: Record<Exclude<ServiceType, "other">, string> = {
  mixing: "Mixing",
  mastering: "Mastering",
  mix_and_master: "Mix & master",
  illustration: "Illustration",
  live2d_rigging: "Live2D rigging",
  mv_editing: "MV editing",
  thumbnail: "Thumbnail",
};

function extraLabel({ key, quantity }: EstimateItem): string | null {
  switch (key) {
    case "base":
      return null;
    case "extra_revision":
      return `${quantity} extra revision${quantity === 1 ? "" : "s"}`;
    case "commercial_usage":
      return "commercial use";
    case "rush_48h":
      return "a 48-hour rush";
  }
}

function money(amount: string, currency: string): string {
  return `${amount} ${currency}`;
}

function describeScope(
  serviceType: Exclude<ServiceType, "other">,
  estimate: PriceEstimate,
): string {
  const extras = estimate.items
    .map(extraLabel)
    .filter((label) => label !== null);
  const label = SERVICE_LABELS[serviceType];
  if (extras.length === 0) return label;
  const last = extras.pop();
  return extras.length === 0
    ? `${label} with ${last}`
    : `${label} with ${extras.join(", ")} and ${last}`;
}

function skipped(agreement: Agreement, reason: string): MismatchCheck {
  return {
    outcome: "skipped",
    mismatch: {
      detected: false,
      client_budget: agreement.price.total,
      estimated_price: null,
      currency: agreement.price.currency,
      reason,
    },
    estimate: null,
    gap_pct: null,
  };
}

/**
 * Compares the client's budget with the rate card estimate (FR-3.1, FR-3.8).
 * Pure code: no model call, so it never invents a mismatch (FR-3.5) and every
 * price comes from the rate card (FR-3.7).
 */
export function detectMismatch(
  agreement: Agreement,
  settings: RateCardSettings,
  today: string,
): MismatchCheck {
  const { rate_card: rateCard, mismatch_threshold_pct: threshold } = settings;
  const { total: budget, currency } = agreement.price;

  if (agreement.service_type === "other") {
    return skipped(
      agreement,
      "This service isn't on your rate card, so there is no estimate to compare.",
    );
  }
  if (budget === null) {
    return skipped(
      agreement,
      "The DM has no price yet, so there is no budget to compare.",
    );
  }
  if (currency === null) {
    return skipped(
      agreement,
      "The price has no currency, so it can't be compared with your rate card.",
    );
  }
  if (currency !== rateCard.currency) {
    return skipped(
      agreement,
      `The budget is in ${currency} but your rate card is in ${rateCard.currency}, so they can't be compared.`,
    );
  }

  const estimate = estimatePrice(agreement, rateCard, today)!;
  const exponent = currencyExponent(currency);
  const estimateMinor = toMinor(estimate.total, exponent);
  const budgetMinor = toMinor(budget, exponent);

  // Gap = (Estimate - Budget) / Estimate × 100%, compared in integers.
  const gapMinor = estimateMinor - budgetMinor;
  const detected = gapMinor * 100 > threshold * estimateMinor;
  const rounded = Math.round((gapMinor * 100) / estimateMinor) || 0;
  const gapPct = detected ? Math.max(rounded, threshold + 1) : rounded;

  const scope = describeScope(agreement.service_type, estimate);
  const estimateText = money(estimate.total, currency);
  const budgetText = money(budget, currency);
  let reason: string;
  if (detected) {
    reason = `${scope} is estimated at ${estimateText} on your rate card; the budget is ${budgetText} (${gapPct}% under).`;
  } else if (gapMinor <= 0) {
    reason = `Looks fair: the budget of ${budgetText} covers your rate card estimate of ${estimateText} (${scope}).`;
  } else {
    reason = `Looks fair: the budget of ${budgetText} is ${gapPct}% under your rate card estimate of ${estimateText}, within your ${threshold}% threshold.`;
  }

  return {
    outcome: detected ? "mismatch" : "fair",
    mismatch: {
      detected,
      client_budget: budget,
      estimated_price: estimate.total,
      currency,
      reason,
    },
    estimate,
    gap_pct: gapPct,
  };
}
