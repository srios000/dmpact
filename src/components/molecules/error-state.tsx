import * as React from "react";
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  action,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-[2.5rem] border border-destructive/30 bg-destructive/5 p-12 text-center"
    >
      <div className="flex size-16 items-center justify-center rounded-3xl bg-destructive/15 text-destructive">
        <AlertTriangleIcon className="size-8" />
      </div>
      <p className="mt-5 text-lg font-black tracking-tight text-foreground">
        {title}
      </p>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed font-medium text-muted-foreground">
          {description}
        </p>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {onRetry && (
          <Button size="lg" onClick={onRetry}>
            <RefreshCwIcon data-icon="inline-start" />
            {retryLabel ?? "Retry"}
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
