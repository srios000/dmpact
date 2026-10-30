import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const timelineMarkerVariants = cva(
  "flex size-10 shrink-0 items-center justify-center rounded-xl border border-white shadow-[0_4px_12px_rgba(30,47,80,0.10)]",
  {
    variants: {
      tone: {
        primary: "bg-primary/8 text-primary",
        neutral: "bg-slate-100 text-slate-600",
        success: "bg-emerald-50 text-emerald-600",
        warning: "bg-orange-50 text-orange-600",
        danger: "bg-rose-50 text-rose-600",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
)

export type TimelineTone = NonNullable<VariantProps<typeof timelineMarkerVariants>["tone"]>

export interface TimelineEvent {
  id: string
  title: string
  description?: string
  meta?: string
  tone?: TimelineTone
  icon?: LucideIcon
}

export interface EventTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  events: TimelineEvent[]
}

function EventTimeline({ className, events, ...props }: EventTimelineProps) {
  return (
    <div className={cn("relative space-y-4", className)} {...props}>
      <div className="absolute top-3 bottom-3 left-5 w-[6px] rounded-full bg-muted shadow-inner" />

      {events.map((event) => {
        const Icon = event.icon
        return (
          <div key={event.id} className="group relative z-10 flex items-center gap-4 rounded-[24px] border border-transparent p-2 transition-colors hover:border-white hover:bg-white/50">
            <div className={cn(timelineMarkerVariants({ tone: event.tone }), "size-9")}>
              {Icon ? (
                <Icon className="size-4" />
              ) : (
                <div className="size-2 rounded-full bg-current" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <p className="text-[13px] font-black text-foreground">{event.title}</p>
                {event.meta ? (
                  <span className="text-[10px] font-bold whitespace-nowrap text-muted-foreground/60 uppercase tracking-tight">
                    {event.meta}
                  </span>
                ) : null}
              </div>
              {event.description ? (
                <p className="mt-0.5 text-[11px] leading-snug font-medium text-muted-foreground">
                  {event.description}
                </p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export { EventTimeline, timelineMarkerVariants }
