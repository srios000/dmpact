import { Skeleton } from "@/components/ui/skeleton";

export default function RateCardLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 md:px-8 md:py-10">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="space-y-6 rounded-xl border bg-card p-5 md:p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>

      <div className="space-y-6 rounded-xl border bg-card p-5 md:p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
    </div>
  );
}
