import { PageShell } from "@/components/templates/page-shell"
import { ExtractionReview } from "@/app/new/_components/extraction-review"
import { getRateCardValues } from "@/app/settings/rate-card"

export default async function NewCommissionPage() {
  const rateCard = await getRateCardValues()

  return (
    <PageShell
      title="New Commission"
      description="Paste a client DM, review the extraction, and resolve ambiguity before sending the agreement."
    >
      <ExtractionReview
        defaultCurrency={rateCard.currency}
        defaultDepositPct={rateCard.defaultDepositPct}
      />
    </PageShell>
  )
}
