import { Skeleton } from "@/components/ui/skeleton";

export default function RateCardLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 md:px-8 md:py-10">
      <header className="space-y-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </header>

      <div className="space-y-8">
        <div className="space-y-6 rounded-xl border bg-card p-5 md:p-8">
          <div className="space-y-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </div>

        <div className="space-y-6 rounded-xl border bg-card p-5 md:p-8">
          <div className="space-y-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </div>

        <div className="flex justify-end">
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
