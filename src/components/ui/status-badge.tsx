import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      state: {
        draft: "bg-slate-100 text-slate-600 border border-slate-200",
        negotiation: "bg-amber-100 text-amber-700 border border-amber-200",
        ambiguous: "bg-amber-100 text-amber-700 border border-amber-200 animate-pulse",
        agreed: "bg-blue-100 text-blue-700 border border-blue-200",
        dp_pending: "bg-orange-100 text-orange-700 border border-orange-200",
        paid: "bg-emerald-100 text-emerald-700 border border-emerald-200",
        in_progress: "bg-sky-100 text-sky-700 border border-sky-200",
        delivered: "bg-cyan-100 text-cyan-700 border border-cyan-200",
        completed: "bg-green-100 text-green-700 border border-green-200",
      },
    },
    defaultVariants: {
      state: "draft",
    },
  }
)

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function StatusBadge({ className, state, ...props }: StatusBadgeProps) {
  const label = React.useMemo(() => {
    if (!state) return "UNKNOWN";
    return state.replace("_", " ").toUpperCase();
  }, [state]);

  return (
    <div 
      className={cn(
        badgeVariants({ state }), 
        "whitespace-nowrap px-3 py-1 text-[10px] w-fit",
        className
      )} 
      {...props}
    >
      {label}
    </div>
  )
}

export { StatusBadge, badgeVariants }
