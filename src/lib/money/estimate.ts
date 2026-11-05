import type { Agreement } from "@/lib/schema/agreement";
import type { RateCard } from "@/lib/schema/rate-card";
import { currencyExponent, fromMinor, toMinor } from "./decimal";

export type EstimateItem = {
  key: "base" | "extra_revision" | "commercial_usage" | "rush_48h";
  quantity: number;
  amount: string;
};

export type PriceEstimate = {
  currency: string;
  total: string;
  items: EstimateItem[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isRush(deadline: string | null, today: string): boolean {
  if (deadline === null) return false;
  const days = (Date.parse(deadline) - Date.parse(today)) / DAY_MS;
  return days >= 0 && days <= 2;
}

export function estimatePrice(
  agreement: Agreement,
  rateCard: RateCard,
  today: string,
): PriceEstimate | null {
  if (agreement.service_type === "other") return null;

  const { extras } = rateCard;
  const extraRevisions = Math.max(
    0,
    (agreement.revisions.included ?? 0) - rateCard.included_revisions,
  );
  const lines: [EstimateItem["key"], number, string][] = [
    ["base", 1, rateCard.services[agreement.service_type]],
    ["extra_revision", extraRevisions, extras.extra_revision],
    [
      "commercial_usage",
      agreement.usage_rights?.commercial === true ? 1 : 0,
      extras.commercial_usage,
    ],
    [
      "rush_48h",
      isRush(agreement.deadline.date, today) ? 1 : 0,
      extras.rush_48h,
    ],
  ];

  const exponent = currencyExponent(rateCard.currency);
  let total = 0;
  const items: EstimateItem[] = [];
  for (const [key, quantity, unit] of lines) {
    const amount = toMinor(unit, exponent) * quantity;
    if (amount === 0) continue;
    total += amount;
    items.push({ key, quantity, amount: fromMinor(amount, exponent) });
  }

  return {
    currency: rateCard.currency,
    total: fromMinor(total, exponent),
    items,
  };
}
