"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/molecules/error-state";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
      <ErrorState
        title="Something went wrong"
        description="This screen hit an unexpected error. Try again, or head back to your queue."
        onRetry={reset}
        retryLabel="Try again"
        action={
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={<Link href="/commissions" />}
          >
            Go to your queue
          </Button>
        }
      />
    </div>
  );
}
