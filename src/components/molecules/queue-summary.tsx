import * as React from "react";
import { cva } from "class-variance-authority";
import type { MoneyByCurrency, QueueSummary } from "@/lib/queue/queue";
import { cn } from "@/lib/utils";

const valueVariants = cva(
  "text-2xl font-semibold tracking-tight tabular-nums",
  {
    variants: {
      tone: {
        default: "text-foreground",
        alert: "text-destructive",
        quiet: "text-muted-foreground",
      },
    },
    defaultVariants: {
      tone: "default",
    },
  },
);

function money(list: MoneyByCurrency): string {
  if (list.length === 0) return "0";
  return list.map((m) => `${m.currency} ${m.amount}`).join(", ");
}

function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "alert" | "quiet";
}) {
  return (
    <div className="min-w-0 space-y-1 px-5 py-4 first:pl-0 sm:first:pl-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={valueVariants({ tone })}>{value}</dd>
      {detail && <dd className="text-sm text-muted-foreground">{detail}</dd>}
    </div>
  );
}

export interface QueueSummaryBarProps {
  summary: QueueSummary;
  className?: string;
}

function QueueSummaryBar({ summary, className }: QueueSummaryBarProps) {
  const { outstanding, depositsPending, dueThisWeek, overdue } = summary;
  return (
    <dl
      className={cn(
        "grid grid-cols-2 divide-border rounded-xl border bg-card sm:grid-cols-4 sm:divide-x",
        className,
      )}
    >
      <Stat
        label="Outstanding"
        value={money(outstanding)}
        detail="Still owed on agreed work"
        tone={outstanding.length === 0 ? "quiet" : "default"}
      />
      <Stat
        label="Deposits pending"
        value={String(depositsPending.count)}
        detail={
          depositsPending.count > 0 ? money(depositsPending.amounts) : undefined
        }
        tone={depositsPending.count === 0 ? "quiet" : "default"}
      />
      <Stat
        label="Due this week"
        value={String(dueThisWeek)}
        tone={dueThisWeek === 0 ? "quiet" : "default"}
      />
      <Stat
        label="Overdue payments"
        value={String(overdue)}
        tone={overdue > 0 ? "alert" : "quiet"}
      />
    </dl>
  );
}

export { QueueSummaryBar };
