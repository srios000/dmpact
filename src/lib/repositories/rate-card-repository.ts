import "server-only";
import { db } from "@/lib/db";
import {
  DEFAULT_MISMATCH_THRESHOLD_PCT,
  DEFAULT_RATE_CARD,
  rateCardSchema,
  type RateCardSettings,
} from "@/lib/schema/rate-card";
import { requireCreator } from "./shared";

export type CreatorRateCard = RateCardSettings & { is_default: boolean };

export async function getRateCard(): Promise<CreatorRateCard> {
  const creator = await requireCreator();
  const row = await db.rateCard.findUnique({
    where: { creatorId: creator.id },
  });
  const parsed = rateCardSchema.safeParse(row?.rates);
  if (!row || !parsed.success) {
    return {
      rate_card: DEFAULT_RATE_CARD,
      mismatch_threshold_pct: DEFAULT_MISMATCH_THRESHOLD_PCT,
      is_default: true,
    };
  }
  return {
    rate_card: parsed.data,
    mismatch_threshold_pct: row.mismatchThresholdPct,
    is_default: false,
  };
}

export async function saveRateCard(
  input: RateCardSettings,
): Promise<CreatorRateCard> {
  const creator = await requireCreator();
  const data = {
    rates: input.rate_card,
    mismatchThresholdPct: input.mismatch_threshold_pct,
  };
  await db.rateCard.upsert({
    where: { creatorId: creator.id },
    update: data,
    create: { creatorId: creator.id, ...data },
  });
  return { ...input, is_default: false };
}
