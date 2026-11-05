import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { InboxIcon, HeartIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const emptyStateVariants = cva(
  "flex flex-col items-center justify-center text-center transition-all",
  {
    variants: {
      surface: {
        dashed:
          "rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/20",
        plain: "",
        vtuber: "rounded-[2.5rem] border-2 border-white bg-white shadow-2xl",
      },
      size: {
        sm: "gap-3 p-8",
        default: "gap-4 p-12",
        lg: "gap-6 p-20",
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
      <div className="relative">
        <div className="flex size-16 items-center justify-center rounded-[1.5rem] border-2 border-white bg-pink-50 text-pink-500 shadow-lg shadow-pink-100">
          <Icon className="size-7" />
        </div>
        <HeartIcon className="absolute -top-2 -right-2 size-5 animate-pulse fill-cyan-400 text-cyan-400" />
      </div>
      <p className="mt-4 text-lg font-black tracking-tight text-[#1E2F50] uppercase">
        {title}
      </p>
      {description ? (
        <p className="mt-2 max-w-xs text-sm leading-relaxed font-medium text-slate-500">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export { EmptyState, emptyStateVariants };
