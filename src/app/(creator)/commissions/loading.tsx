import { Skeleton } from "@/components/ui/skeleton";

export default function CommissionsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 md:px-8 md:py-10">
      <header className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>

      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
