import * as React from "react";
import { AlertCircleIcon } from "lucide-react";
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
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-rose-100 bg-rose-50/50 p-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-white bg-white shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
        <AlertCircleIcon className="size-6 text-rose-500" />
      </div>
      <p className="mt-3 text-[13px] font-bold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-[12px] leading-relaxed font-medium text-muted-foreground">
          {description}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            className="h-9 rounded-xl px-4 text-[12px] font-bold"
          >
            {retryLabel || "Retry"}
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
