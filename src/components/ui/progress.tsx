import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const progressVariants = cva(
  "relative h-2 w-full overflow-hidden rounded-full bg-muted",
  {
    variants: {
      status: {
        active: "[&>div]:bg-primary",
        success: "[&>div]:bg-status-fully-paid",
      },
    },
    defaultVariants: {
      status: "active",
    },
  },
);

export interface ProgressProps
  extends
    HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants> {
  value: number;
}

function Progress({ className, value, status, ...props }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn(progressVariants({ status }), className)}
      {...props}
    >
      <div
        className="h-full rounded-full transition-[width] duration-150"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export { Progress, progressVariants };
