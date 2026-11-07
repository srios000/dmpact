import { Skeleton } from "@/components/ui/skeleton";

export default function CommissionDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 md:px-12 md:py-10">
      <div className="space-y-4">
        <Skeleton className="h-7 w-28" />
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <Skeleton className="h-24 rounded-xl" />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-96 rounded-xl" />
          <div className="space-y-6">
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
