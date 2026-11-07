import { Skeleton } from "@/components/ui/skeleton";

export default function ClientAgreementLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8 md:py-14">
      <header className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
      </header>

      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </main>
  );
}
