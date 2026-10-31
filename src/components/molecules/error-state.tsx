"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertTriangleIcon, RefreshCwIcon, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const errorStateVariants = cva(
  "flex flex-col items-center justify-center rounded-2xl border-2 text-center",
  {
    variants: {
      tone: {
        error: "border-destructive/20 bg-destructive/5",
        warning: "border-amber-200 bg-amber-50/60",
      },
      size: {
        sm: "gap-2 p-5",
        default: "gap-3 p-8",
      },
    },
    defaultVariants: {
      tone: "error",
      size: "default",
    },
  }
)

const iconVariants = cva(
  "flex items-center justify-center rounded-2xl border border-white bg-white shadow-[0_4px_14px_rgba(0,0,0,0.06)]",
  {
    variants: {
      tone: {
        error: "text-destructive",
        warning: "text-amber-500",
      },
      size: {
        sm: "size-10 [&_svg]:size-5",
        default: "size-14 [&_svg]:size-6",
      },
    },
    defaultVariants: {
      tone: "error",
      size: "default",
    },
  }
)

export interface ErrorStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof errorStateVariants> {
  icon?: LucideIcon
  title: string
  description?: string
  retryLabel?: string
  isRetrying?: boolean
  onRetry?: () => void
  action?: React.ReactNode
}

function ErrorState({
  className,
  tone,
  size,
  icon: Icon = AlertTriangleIcon,
  title,
  description,
  retryLabel = "Try again",
  isRetrying = false,
  onRetry,
  action,
  ...props
}: ErrorStateProps) {
  return (
    <div role="alert" className={cn(errorStateVariants({ tone, size }), className)} {...props}>
      <div className={cn(iconVariants({ tone, size }))}>
        <Icon />
      </div>
      <p className="text-[13px] font-bold text-foreground">{title}</p>
      {description ? (
        <p className="max-w-xs text-[12px] font-medium leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-1 h-9 gap-2 rounded-xl border-border bg-white px-4 text-[12px] font-bold"
        >
          <RefreshCwIcon className={cn("size-4", isRetrying && "animate-spin")} />
          {isRetrying ? "Retrying..." : retryLabel}
        </Button>
      ) : null}
      {action}
    </div>
  )
}

export { ErrorState, errorStateVariants }
