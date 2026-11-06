"use server";

import { updateTag } from "next/cache";
import {
  invalidInput,
  toActionFailure,
  type ActionResult,
} from "@/lib/repositories/action-result";
import * as rateCards from "@/lib/repositories/rate-card-repository";
import {
  rateCardSettingsSchema,
  type RateCardSettings,
} from "@/lib/schema/rate-card";

export async function saveRateCardSettings(
  input: RateCardSettings,
): Promise<ActionResult<RateCardSettings>> {
  const parsed = rateCardSettingsSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    await rateCards.saveRateCard(parsed.data);
    updateTag("rate-card");
    return { ok: true, data: parsed.data };
  } catch (error) {
    return toActionFailure(error);
  }
}
