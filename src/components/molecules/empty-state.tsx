import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { InboxIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const emptyStateVariants = cva(
  "flex flex-col items-center justify-center text-center",
  {
    variants: {
      surface: {
        dashed: "rounded-2xl border-2 border-dashed border-border bg-muted/40",
        plain: "",
      },
      size: {
        sm: "gap-2 p-6",
        default: "gap-3 p-10",
        lg: "gap-4 p-14",
      },
    },
    defaultVariants: {
      surface: "dashed",
      size: "default",
    },
  },
);

export interface EmptyStateProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof emptyStateVariants> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

function EmptyState({
  className,
  surface,
  size,
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(emptyStateVariants({ surface, size }), className)}
      {...props}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl border border-white bg-white shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <p className="mt-3 text-[13px] font-bold text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-xs text-[12px] leading-relaxed font-medium text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export { EmptyState, emptyStateVariants };
