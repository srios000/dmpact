import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const paymentBadgeVariants = cva(
  "inline-flex items-center gap-1.5 text-sm whitespace-nowrap before:size-1.5 before:shrink-0 before:rounded-full before:bg-current",
  {
    variants: {
      tone: {
        paid: "text-status-fully-paid",
        waiting: "text-warning",
        late: "font-medium text-destructive",
        idle: "text-muted-foreground before:opacity-50",
      },
    },
    defaultVariants: {
      tone: "idle",
    },
  },
);

export interface PaymentBadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof paymentBadgeVariants> {}

function PaymentBadge({ className, tone, ...props }: PaymentBadgeProps) {
  return (
    <span
      className={cn(paymentBadgeVariants({ tone }), className)}
      {...props}
    />
  );
}

export { PaymentBadge, paymentBadgeVariants };
