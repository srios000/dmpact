import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const daysLeftVariants = cva("text-sm whitespace-nowrap tabular-nums", {
  variants: {
    tone: {
      late: "font-medium text-destructive",
      soon: "font-medium text-warning",
      ok: "text-foreground",
      done: "text-muted-foreground",
    },
  },
  defaultVariants: {
    tone: "ok",
  },
});

function describeDays(days: number | null): string {
  if (days === null) return "Done";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 0) return `${days} days`;
  return days === -1 ? "1 day late" : `${-days} days late`;
}

export interface DaysLeftProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof daysLeftVariants> {
  days: number | null;
}

function DaysLeft({ className, tone, days, ...props }: DaysLeftProps) {
  return (
    <span className={cn(daysLeftVariants({ tone }), className)} {...props}>
      {describeDays(days)}
    </span>
  );
}

export { DaysLeft, daysLeftVariants };
