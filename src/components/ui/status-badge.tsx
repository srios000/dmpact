import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { STATE_LABELS } from "@/lib/state-machine/labels";
import type { CommissionState } from "@/lib/state-machine/rules";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex h-6 w-fit items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap text-foreground",
  {
    variants: {
      state: {
        draft: "border-status-draft/30 bg-status-draft/10",
        negotiating: "border-status-negotiating/30 bg-status-negotiating/10",
        agreed: "border-status-agreed/30 bg-status-agreed/10",
        dp_paid: "border-status-dp-paid/30 bg-status-dp-paid/10",
        in_progress: "border-status-in-progress/30 bg-status-in-progress/10",
        delivered: "border-status-delivered/30 bg-status-delivered/10",
        fully_paid: "border-status-fully-paid/30 bg-status-fully-paid/10",
        cancelled:
          "border-status-cancelled/30 bg-status-cancelled/10 text-muted-foreground",
      },
    },
    defaultVariants: {
      state: "draft",
    },
  },
);

const statusDotVariants = cva("size-1.5 shrink-0 rounded-full", {
  variants: {
    state: {
      draft: "bg-status-draft",
      negotiating: "bg-status-negotiating",
      agreed: "bg-status-agreed",
      dp_paid: "bg-status-dp-paid",
      in_progress: "bg-status-in-progress",
      delivered: "bg-status-delivered",
      fully_paid: "bg-status-fully-paid",
      cancelled: "bg-status-cancelled",
    },
  },
  defaultVariants: {
    state: "draft",
  },
});

export interface StatusBadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {}

function StatusBadge({ className, state, ...props }: StatusBadgeProps) {
  const value: CommissionState = state ?? "draft";
  return (
    <span className={cn(statusBadgeVariants({ state }), className)} {...props}>
      <span aria-hidden className={statusDotVariants({ state })} />
      {STATE_LABELS[value]}
    </span>
  );
}

export { StatusBadge, statusBadgeVariants };
