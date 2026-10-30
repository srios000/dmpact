import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const invoiceStatusVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] leading-none font-bold",
  {
    variants: {
      status: {
        unbilled: "border-border bg-slate-50 text-slate-500",
        pending: "border-border bg-slate-100 text-slate-700",
        paid: "border-border bg-primary/6 text-primary",
        overdue: "border-rose-200 bg-rose-50 text-rose-700",
      },
    },
    defaultVariants: {
      status: "unbilled",
    },
  }
)

export type InvoiceStatusValue = NonNullable<
  VariantProps<typeof invoiceStatusVariants>["status"]
>

const STATUS_LABEL: Record<InvoiceStatusValue, string> = {
  unbilled: "Unbilled",
  pending: "Pending",
  paid: "Paid",
  overdue: "Overdue",
}

export interface InvoiceStatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof invoiceStatusVariants> {}

function InvoiceStatusPill({ className, status, ...props }: InvoiceStatusPillProps) {
  const resolved = status ?? "unbilled"
  return (
    <span className={cn(invoiceStatusVariants({ status: resolved }), className)} {...props}>
      {STATUS_LABEL[resolved]}
    </span>
  )
}

export { InvoiceStatusPill, invoiceStatusVariants }
