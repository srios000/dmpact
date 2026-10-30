import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function QueueLoading() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 px-4 py-6 md:px-8">
      <div className="space-y-2 py-2">
        <Skeleton className="h-8 w-56 rounded-lg bg-muted" />
        <Skeleton className="h-4 w-72 max-w-full rounded-lg bg-muted" />
      </div>

      <Card className="overflow-hidden rounded-[32px] border-2 border-white bg-card p-6 shadow-[0_15px_50px_rgba(0,0,0,0.1)] md:p-8">
        <Skeleton className="mb-6 h-5 w-48 rounded-lg bg-muted" />
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-xl bg-muted" />
          ))}
        </div>
      </Card>
    </div>
  )
}
