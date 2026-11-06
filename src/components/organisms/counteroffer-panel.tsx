"use client";

import * as React from "react";
import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from "lucide-react";
import { CounterofferCard } from "@/components/molecules/counteroffer-card";
import type { CounterofferResult } from "@/lib/ai/negotiate/counteroffers";
import type { Agreement } from "@/lib/schema/agreement";
import type { Counteroffer } from "@/lib/schema/negotiation";
import { cn } from "@/lib/utils";

export interface CounterofferPanelProps {
  result: CounterofferResult;
  current: Agreement;
  applying?: boolean;
  applyingId?: string | null;
  onApply: (option: Counteroffer) => void;
  className?: string;
}

function CounterofferPanel({
  result,
  current,
  applying,
  applyingId,
  onApply,
  className,
}: CounterofferPanelProps) {
  const { check, negotiation, fallback } = result;
  const options = negotiation.options;

  return (
    <div className={cn("space-y-4", className)}>
      {check.outcome === "mismatch" ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
          <CircleAlertIcon
            className="mt-0.5 size-4 shrink-0 text-warning"
            aria-hidden
          />
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium text-foreground">
              Budget is below your rate card
            </p>
            <p className="text-muted-foreground">{check.mismatch.reason}</p>
          </div>
        </div>
      ) : check.outcome === "fair" ? (
        <div className="flex items-start gap-3 rounded-lg border border-status-fully-paid/30 bg-status-fully-paid/10 p-4 text-sm">
          <CircleCheckIcon
            className="mt-0.5 size-4 shrink-0 text-status-fully-paid"
            aria-hidden
          />
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium text-foreground">Looks fair</p>
            <p className="text-muted-foreground">{check.mismatch.reason}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm">
          <InfoIcon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <p className="text-muted-foreground">{check.mismatch.reason}</p>
        </div>
      )}

      {options.length > 0 && (
        <ul className="space-y-4">
          {options.map((option) => (
            <li key={option.id}>
              <CounterofferCard
                option={option}
                current={current}
                applying={applyingId === option.id && !!applying}
                disabled={!!applying}
                onApply={onApply}
              />
            </li>
          ))}
        </ul>
      )}

      {fallback && options.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Message drafts use the template wording because the model wasn&apos;t
          available.
        </p>
      )}
    </div>
  );
}

export { CounterofferPanel };
