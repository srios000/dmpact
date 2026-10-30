import * as React from "react"
import { DownloadIcon, TruckIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/molecules/empty-state"
import type { CommissionDelivery } from "@/app/queue/queue-data"
import { cn } from "@/lib/utils"

export interface CommissionDeliveriesProps extends React.HTMLAttributes<HTMLDivElement> {
  deliveries: CommissionDelivery[]
}

function CommissionDeliveries({ className, deliveries, ...props }: CommissionDeliveriesProps) {
  return (
    <Card
      className={cn(
        "rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]",
        className
      )}
      {...props}
    >
      <CardHeader className="p-6 pb-2 md:p-8 md:pb-2">
        <CardTitle className="text-[15px] font-black tracking-tight text-foreground uppercase">
          Deliveries
        </CardTitle>
        <p className="text-[12px] font-medium text-muted-foreground">
          Files sent to the client with their SHA-256 fingerprint.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 p-6 pt-4 md:grid-cols-2 md:p-8 md:pt-4">
        {deliveries.length === 0 ? (
          <div className="col-span-2">
            <EmptyState
              icon={TruckIcon}
              size="sm"
              title="No deliveries yet"
              description="Uploaded files appear here once work is marked as delivered."
            />
          </div>
        ) : (
          deliveries.map((delivery) => (
            <div
              key={delivery.id}
              className="flex items-center justify-between gap-4 rounded-[24px] border border-border bg-background p-4"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                  {delivery.label}
                </p>
                <p className="mt-1 truncate text-[13px] font-bold text-foreground">
                  {delivery.fileName}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                  {delivery.uploadedAt}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label={`Download ${delivery.fileName}`}
                onClick={() => alert(`Downloading ${delivery.fileName}...`)}
                className="shrink-0 rounded-xl border-border bg-card"
              >
                <DownloadIcon className="size-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export { CommissionDeliveries }
