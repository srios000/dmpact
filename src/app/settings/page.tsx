import { PageShell } from "@/components/templates/page-shell"
import { RateCardForm } from "@/app/settings/_components/rate-card-form"
import {
  EXTRA_RATE_FIELDS,
  getInitialRateCardActionState,
  getRateCardValues,
  SERVICE_RATE_FIELDS,
} from "@/app/settings/rate-card"

export default async function SettingsPage() {
  const values = await getRateCardValues()

  return (
    <PageShell
      title="Settings"
      description="Manage your rate card defaults so AI and PayPal flows stay aligned."
    >
      <RateCardForm
        initialState={getInitialRateCardActionState(values)}
        serviceFields={SERVICE_RATE_FIELDS}
        extraFields={EXTRA_RATE_FIELDS}
      />
    </PageShell>
  )
}
