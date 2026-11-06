import * as React from "react";
import { AlertTriangleIcon } from "lucide-react";
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
      className="flex max-w-3xl gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6"
    >
      <AlertTriangleIcon
        aria-hidden
        className="mt-1 size-5 shrink-0 text-destructive"
      />
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{title}</p>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {onRetry && (
            <Button size="lg" onClick={onRetry}>
              {retryLabel ?? "Try again"}
            </Button>
          )}
          {action}
        </div>
      </div>
    </div>
  );
}
