import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type CommissionState =
  | "draft"
  | "negotiating"
  | "agreed"
  | "dp_paid"
  | "in_progress"
  | "delivered"
  | "fully_paid"
  | "cancelled";

const badgeVariants = cva(
  "inline-flex w-fit items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      state: {
        draft: "border-status-draft/25 bg-status-draft/10 text-status-draft",
        negotiating:
          "border-status-negotiating/25 bg-status-negotiating/10 text-status-negotiating",
        agreed:
          "border-status-agreed/25 bg-status-agreed/10 text-status-agreed",
        dp_paid:
          "border-status-dp-paid/25 bg-status-dp-paid/10 text-status-dp-paid",
        in_progress:
          "border-status-in-progress/25 bg-status-in-progress/10 text-status-in-progress",
        delivered:
          "border-status-delivered/25 bg-status-delivered/10 text-status-delivered",
        fully_paid:
          "border-status-fully-paid/25 bg-status-fully-paid/10 text-status-fully-paid",
        cancelled:
          "border-status-cancelled/25 bg-status-cancelled/10 text-status-cancelled",
      },
    },
    defaultVariants: {
      state: "draft",
    },
  },
);

export interface StatusBadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  state: CommissionState;
}

function StatusBadge({ className, state, ...props }: StatusBadgeProps) {
  return (
    <div className={cn(badgeVariants({ state }), className)} {...props}>
      {state.replaceAll("_", " ")}
    </div>
  );
}

export { StatusBadge, badgeVariants };
