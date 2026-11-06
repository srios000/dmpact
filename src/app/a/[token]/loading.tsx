import { Skeleton } from "@/components/ui/skeleton";

export default function ClientAgreementLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 md:py-14">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-48 max-w-full" />
      </div>

      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </main>
  );
}
