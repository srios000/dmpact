import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex w-fit items-center rounded-full border px-3 py-1 text-[10px] font-bold whitespace-nowrap uppercase",
  {
    variants: {
      state: {
        draft: "border-status-draft/20 bg-status-draft/10 text-status-draft",
        negotiating:
          "border-status-negotiating/20 bg-status-negotiating/10 text-status-negotiating",
        agreed:
          "border-status-agreed/20 bg-status-agreed/10 text-status-agreed",
        dp_paid:
          "border-status-dp-paid/20 bg-status-dp-paid/10 text-status-dp-paid",
        in_progress:
          "border-status-in-progress/20 bg-status-in-progress/10 text-status-in-progress",
        delivered:
          "border-status-delivered/20 bg-status-delivered/10 text-status-delivered",
        fully_paid:
          "border-status-fully-paid/20 bg-status-fully-paid/10 text-status-fully-paid",
        cancelled:
          "border-status-cancelled/20 bg-status-cancelled/10 text-status-cancelled",
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
    VariantProps<typeof statusBadgeVariants> {}

function StatusBadge({ className, state, ...props }: StatusBadgeProps) {
  return (
    <div className={cn(statusBadgeVariants({ state }), className)} {...props}>
      {(state ?? "draft").replace("_", " ")}
    </div>
  );
}

export { StatusBadge, statusBadgeVariants };
