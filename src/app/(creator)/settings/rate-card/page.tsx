import type { Metadata } from "next";
import { RateCardForm } from "@/components/organisms/rate-card-form";
import { getRateCard } from "@/lib/repositories/rate-card-repository";

export const metadata: Metadata = {
  title: "Rate card | DMpact",
};

export default async function RateCardPage() {
  const { rate_card, mismatch_threshold_pct, is_default } = await getRateCard();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 md:px-8 md:py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Rate card
        </h1>
        <p className="text-muted-foreground">
          Set your base prices and extras. The mismatch check compares a
          client&apos;s budget against these rates.
        </p>
      </header>

      {is_default && (
        <p className="text-sm text-muted-foreground">
          You&apos;re using the default rate card. Save it to make it your own.
        </p>
      )}

      <RateCardForm settings={{ rate_card, mismatch_threshold_pct }} />
    </div>
  );
}
