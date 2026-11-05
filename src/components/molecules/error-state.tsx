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
    <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-white bg-rose-50/50 p-12 text-center shadow-xl shadow-rose-100/20">
      <div className="relative">
        <div className="flex size-16 items-center justify-center rounded-[1.5rem] border-2 border-white bg-white text-rose-500 shadow-lg shadow-rose-100">
          <AlertTriangleIcon className="size-8" />
        </div>
      </div>
      <p className="mt-5 text-lg font-black tracking-tight text-[#1E2F50] uppercase">
        {title}
      </p>
      {description && (
        <p className="mt-2 max-w-xs text-sm leading-relaxed font-medium text-slate-500">
          {description}
        </p>
      )}
      <div className="mt-8 flex flex-col gap-3">
        {onRetry && (
          <Button
            onClick={onRetry}
            className="h-12 rounded-full bg-[#1E2F50] px-8 font-black text-white shadow-lg transition-all hover:bg-[#2a3f6a] active:scale-[0.98]"
          >
            <RefreshCwIcon className="mr-2 h-4 w-4" />
            {retryLabel || "Retry"}
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
