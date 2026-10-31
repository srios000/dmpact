import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 px-4 py-6 md:px-8">
      <div className="flex flex-col items-center justify-between gap-6 py-2 md:flex-row">
        <Skeleton className="h-11 w-full max-w-xl rounded-full bg-muted" />
        <div className="flex w-full items-center justify-between gap-6 md:w-auto">
          <Skeleton className="size-9 rounded-full bg-muted" />
          <Skeleton className="h-9 w-32 rounded-full bg-muted" />
        </div>
      </div>

      <div className="space-y-2 py-2">
        <Skeleton className="h-8 w-64 rounded-lg bg-muted" />
        <Skeleton className="h-4 w-80 max-w-full rounded-lg bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[132px] rounded-[32px] bg-muted" />
        ))}
      </div>

      <div className="mt-2 grid items-start gap-8 lg:grid-cols-12">
        <Card className="rounded-[32px] border-2 border-white bg-card p-6 shadow-[0_15px_50px_rgba(0,0,0,0.1)] md:p-8 lg:col-span-8">
          <Skeleton className="mb-6 h-5 w-48 rounded-lg bg-muted" />
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-xl bg-muted" />
            ))}
          </div>
        </Card>
        <Card className="rounded-[32px] border-2 border-white bg-card p-6 shadow-[0_15px_50px_rgba(0,0,0,0.1)] md:p-8 lg:col-span-4">
          <Skeleton className="mb-6 h-5 w-40 rounded-lg bg-muted" />
          <Skeleton className="h-44 w-full rounded-2xl bg-muted" />
          <Skeleton className="mt-4 h-12 w-full rounded-xl bg-muted" />
          <Skeleton className="mt-3 h-12 w-full rounded-xl bg-muted" />
        </Card>
      </div>
    </div>
  )
}
