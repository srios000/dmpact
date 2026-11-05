import { ExtractionReview } from "./_components/extraction-review";

export default async function NewCommissionPage() {
  return (
    <div className="relative flex min-h-svh flex-1 flex-col overflow-hidden p-6 md:p-12">
      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <ExtractionReview />
      </div>
    </div>
  );
}
