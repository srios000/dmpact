import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const kpiCardVariants = cva(
  "group/card relative overflow-hidden rounded-[32px] border-2 border-white bg-card p-1 shadow-[0_10px_40px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1",
  {
    variants: {
      tone: {
        info: "text-blue-500 [&_[data-slot=kpi-icon]]:bg-blue-50 [&_[data-slot=kpi-icon]]:text-blue-600",
        primary:
          "text-indigo-500 [&_[data-slot=kpi-icon]]:bg-indigo-50 [&_[data-slot=kpi-icon]]:text-indigo-600",
        neutral:
          "text-slate-400 [&_[data-slot=kpi-icon]]:bg-slate-100 [&_[data-slot=kpi-icon]]:text-slate-600",
        warning:
          "text-orange-500 [&_[data-slot=kpi-icon]]:bg-orange-50 [&_[data-slot=kpi-icon]]:text-orange-600",
      },
    },
    defaultVariants: {
      tone: "info",
    },
  }
)

const kpiTrendVariants = cva("text-[11px] font-bold", {
  variants: {
    trend: {
      up: "text-emerald-600",
      down: "text-rose-500",
      flat: "text-slate-400",
    },
  },
  defaultVariants: {
    trend: "flat",
  },
})

const sparklinePath = {
  up: "M0,25 Q25,5 50,15 T100,5",
  down: "M0,5 Q25,25 50,15 T100,25",
  flat: "M0,15 Q25,10 50,15 T100,15",
} as const

export interface KpiCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof kpiCardVariants>,
    VariantProps<typeof kpiTrendVariants> {
  title: string
  value: string
  change: string
  icon: LucideIcon
}

function KpiCard({
  className,
  tone,
  trend = "up",
  title,
  value,
  change,
  icon: Icon,
  ...props
}: KpiCardProps) {
  const resolvedTrend = trend ?? "flat"

  return (
    <Card
      className={cn(kpiCardVariants({ tone }), className)}
      {...props}
    >
      <CardHeader className="flex flex-row items-center gap-4 space-y-0 p-6 pb-0">
        <div
          data-slot="kpi-icon"
          className="rounded-full p-3.5 shadow-sm transition-transform group-hover/card:scale-105"
        >
          <Icon className="size-5" />
        </div>
        <div className="grid gap-0.5">
          <CardTitle className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
            {title}
          </CardTitle>
          <div className="text-[26px] font-black tracking-tight text-foreground">{value}</div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pt-1 pb-6">
        <div className="flex items-center justify-between">
          <p className={cn(kpiTrendVariants({ trend }))}>
            {resolvedTrend === "up" ? "↗ " : resolvedTrend === "down" ? "↘ " : ""}
            {change}
          </p>
          <svg viewBox="0 0 100 30" className="h-8 w-20 overflow-visible text-current opacity-30">
            <path
              d={sparklinePath[resolvedTrend]}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}

export { KpiCard, kpiCardVariants }
