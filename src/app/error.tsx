"use client";

import { ErrorState } from "@/components/molecules/error-state";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <ErrorState
        title="Something went wrong"
        description="This screen hit an unexpected error. Please try again."
        onRetry={reset}
        retryLabel="Try again"
      />
    </main>
  );
}
