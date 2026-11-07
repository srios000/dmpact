import { Skeleton } from "@/components/ui/skeleton";

export default function CommissionsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </header>

      <Skeleton className="h-24 rounded-xl" />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 lg:w-72 lg:flex-none" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
