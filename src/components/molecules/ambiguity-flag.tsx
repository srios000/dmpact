"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangleIcon, CheckIcon, CopyIcon, InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ambiguityFlagVariants = cva("flex gap-3 rounded-2xl border p-4 text-sm", {
  variants: {
    severity: {
      blocker:
        "border-destructive/40 bg-destructive/10 [&>svg]:text-destructive",
      warning: "border-warning/30 bg-warning/5 [&>svg]:text-warning",
    },
  },
  defaultVariants: {
    severity: "warning",
  },
});

const severityLabelVariants = cva(
  "w-fit rounded-full px-2 py-0.5 text-[10px] font-black tracking-widest uppercase",
  {
    variants: {
      severity: {
        blocker: "bg-destructive/20 text-destructive",
        warning: "bg-warning/15 text-warning",
      },
    },
    defaultVariants: {
      severity: "warning",
    },
  },
);

export interface AmbiguityFlagProps extends VariantProps<
  typeof ambiguityFlagVariants
> {
  label: string;
  message: string;
  quote?: string | null;
  question?: string | null;
  className?: string;
}

function AmbiguityFlag({
  severity,
  label,
  message,
  quote,
  question,
  className,
}: AmbiguityFlagProps) {
  const [copied, setCopied] = React.useState(false);
  const Icon = severity === "blocker" ? AlertTriangleIcon : InfoIcon;

  async function copyQuestion() {
    if (!question) return;
    await navigator.clipboard.writeText(question);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      role={severity === "blocker" ? "alert" : "note"}
      className={cn(ambiguityFlagVariants({ severity }), className)}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={severityLabelVariants({ severity })}>
            {severity === "blocker" ? "Blocker" : "Warning"}
          </span>
          <span className="text-xs font-bold text-muted-foreground">
            {label}
          </span>
        </div>
        <p className="font-medium text-foreground">{message}</p>
        {quote && (
          <blockquote className="border-l-2 border-border pl-3 text-muted-foreground italic">
            &ldquo;{quote}&rdquo;
          </blockquote>
        )}
        {question && (
          <div className="flex items-start justify-between gap-2 rounded-xl bg-background/60 p-3">
            <p className="text-foreground">{question}</p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={copyQuestion}
              aria-label="Copy suggested question"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export { AmbiguityFlag, ambiguityFlagVariants };
