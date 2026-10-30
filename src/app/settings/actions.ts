"use server"

import {
  getInitialRateCardActionState,
  parseRateCardFormData,
  persistRateCard,
  validateRateCardSnapshot,
  type RateCardActionState,
} from "@/app/settings/rate-card"

export async function saveRateCard(
  _prevState: RateCardActionState,
  formData: FormData
): Promise<RateCardActionState> {
  const snapshot = parseRateCardFormData(formData)
  const validationError = validateRateCardSnapshot(snapshot)

  if (validationError) {
    return {
      ...getInitialRateCardActionState({
        ..._prevState.values,
        ...snapshot,
        services: snapshot.services,
        extras: snapshot.extras,
        updatedAtLabel: _prevState.values.updatedAtLabel,
        source: _prevState.values.source,
      }),
      status: "error",
      message: validationError,
    }
  }

  const result = await persistRateCard(snapshot)

  return {
    status: "success",
    message: result.savedToDatabase
      ? "Rate card saved successfully."
      : "Saved for preview. Database is unavailable, so the draft was kept locally.",
    values: result.values,
  }
}
