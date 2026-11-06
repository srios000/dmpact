"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangleIcon, CheckIcon, CopyIcon, InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ambiguityFlagVariants = cva(
  "flex gap-3 rounded-r-lg border-l-2 py-3 pr-3 pl-4 text-sm",
  {
    variants: {
      severity: {
        blocker: "border-destructive bg-destructive/5 [&>svg]:text-destructive",
        warning: "border-warning bg-warning/5 [&>svg]:text-warning",
      },
    },
    defaultVariants: {
      severity: "warning",
    },
  },
);

const severityTextVariants = cva("font-semibold", {
  variants: {
    severity: {
      blocker: "text-destructive",
      warning: "text-warning",
    },
  },
  defaultVariants: {
    severity: "warning",
  },
});

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
        <p className={severityTextVariants({ severity })}>
          {label} {severity === "blocker" ? "blocker" : "warning"}
        </p>
        <p className="text-foreground">{message}</p>
        {quote && (
          <blockquote className="text-muted-foreground">
            &ldquo;{quote}&rdquo;
          </blockquote>
        )}
        {question && (
          <div className="flex items-start justify-between gap-2 rounded-md bg-background/60 p-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Ask the client</p>
              <p className="text-foreground">{question}</p>
            </div>
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
