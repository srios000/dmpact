import * as React from "react"
import { ReceiptTextIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InvoiceStatusPill } from "@/components/molecules/invoice-status-pill"
import type { CommissionInvoice } from "@/app/queue/queue-data"
import { cn } from "@/lib/utils"

export interface CommissionInvoicesProps extends React.HTMLAttributes<HTMLDivElement> {
  invoices: CommissionInvoice[]
}

function CommissionInvoices({ className, invoices, ...props }: CommissionInvoicesProps) {
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
          Invoices
        </CardTitle>
        <p className="text-[12px] font-medium text-muted-foreground">
          Deposit and balance tracked through PayPal.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 p-6 pt-4 md:grid-cols-2 md:p-8 md:pt-4">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            className="flex flex-col justify-between gap-4 rounded-[28px] border border-border bg-background p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white bg-primary/8 text-primary shadow-[0_4px_12px_rgba(30,47,80,0.10)]">
                <ReceiptTextIcon className="size-5" />
              </div>
              <InvoiceStatusPill status={invoice.status} />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                {invoice.kind === "deposit" ? "Deposit" : "Balance"}
              </p>
              <p className="mt-1 text-[20px] font-black tracking-tight text-foreground">
                {invoice.currency} {invoice.amount}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                {invoice.id} · due {invoice.dueDate}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export { CommissionInvoices }
