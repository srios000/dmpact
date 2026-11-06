import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const eventMarkerVariants = cva(
  "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card",
  {
    variants: {
      tone: {
        neutral: "border-border text-muted-foreground",
        primary: "border-primary/30 text-primary",
        success: "border-status-fully-paid/30 text-status-fully-paid",
        warning: "border-warning/30 text-warning",
        danger: "border-destructive/30 text-destructive",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export type TimelineTone = NonNullable<
  VariantProps<typeof eventMarkerVariants>["tone"]
>;

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string | null;
  meta?: string | null;
  tone?: TimelineTone;
  icon?: LucideIcon;
}

export interface EventTimelineProps extends React.HTMLAttributes<HTMLOListElement> {
  events: TimelineEvent[];
}

function EventTimeline({ className, events, ...props }: EventTimelineProps) {
  return (
    <ol className={cn("relative space-y-5", className)} {...props}>
      <span
        aria-hidden
        className="absolute top-3 bottom-3 left-4 w-px bg-border"
      />
      {events.map((event) => {
        const Icon = event.icon;
        return (
          <li key={event.id} className="relative flex gap-3">
            <span className={eventMarkerVariants({ tone: event.tone })}>
              {Icon ? (
                <Icon className="size-4" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-foreground">
                  {event.title}
                </p>
                {event.meta ? (
                  <span className="text-xs whitespace-nowrap text-muted-foreground">
                    {event.meta}
                  </span>
                ) : null}
              </div>
              {event.description ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {event.description}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export { EventTimeline, eventMarkerVariants };
