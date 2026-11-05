import { ExtractionReview } from "./_components/extraction-review";

export default async function NewCommissionPage() {
  // Hardcoded for now as Issue #43 (Settings) is not yet merged
  const rateCard = {
    currency: "USD",
    defaultDepositPct: "50",
  };

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Commission</h2>
          <p className="text-muted-foreground">
            Paste a client DM, review the extraction, and resolve ambiguity
            before sending the agreement.
          </p>
        </div>
      </div>
      <ExtractionReview
        defaultCurrency={rateCard.currency}
        defaultDepositPct={rateCard.defaultDepositPct}
      />
    </div>
  );
}
