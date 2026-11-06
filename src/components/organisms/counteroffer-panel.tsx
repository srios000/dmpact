"use client";

import * as React from "react";
import { cva } from "class-variance-authority";
import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from "lucide-react";
import { CounterofferCard } from "@/components/molecules/counteroffer-card";
import {
  CounterofferDiff,
  diffAgreement,
} from "@/components/molecules/counteroffer-diff";
import type { CounterofferResult } from "@/lib/ai/negotiate/counteroffers";
import type { MismatchOutcome } from "@/lib/ai/negotiate/mismatch";
import type { Agreement } from "@/lib/schema/agreement";
import type { Counteroffer } from "@/lib/schema/negotiation";
import { cn } from "@/lib/utils";

const outcomeBannerVariants = cva(
  "flex items-start gap-3 rounded-lg border p-4 text-sm",
  {
    variants: {
      outcome: {
        mismatch: "border-warning/30 bg-warning/10 [&>svg]:text-warning",
        fair: "border-status-fully-paid/30 bg-status-fully-paid/10 [&>svg]:text-status-fully-paid",
        skipped: "bg-card [&>svg]:text-muted-foreground",
      },
    },
    defaultVariants: {
      outcome: "skipped",
    },
  },
);

const OUTCOME_TITLES: Partial<Record<MismatchOutcome, string>> = {
  mismatch: "Budget is below your rate card",
  fair: "Looks fair",
};

const OUTCOME_ICONS: Record<MismatchOutcome, typeof InfoIcon> = {
  mismatch: CircleAlertIcon,
  fair: CircleCheckIcon,
  skipped: InfoIcon,
};

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
  const Icon = OUTCOME_ICONS[check.outcome];
  const title = OUTCOME_TITLES[check.outcome];

  return (
    <div className={cn("space-y-4", className)}>
      <div className={outcomeBannerVariants({ outcome: check.outcome })}>
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          {title && <p className="font-medium text-foreground">{title}</p>}
          <p className="text-muted-foreground">{check.mismatch.reason}</p>
        </div>
      </div>

      {options.length > 0 && (
        <ul className="space-y-4">
          {options.map((option) => (
            <li key={option.id}>
              <CounterofferCard
                strategy={option.strategy}
                summary={option.summary}
                messageDraft={option.message_draft}
                diff={
                  <CounterofferDiff
                    changes={diffAgreement(current, option.proposed_agreement)}
                  />
                }
                applying={applyingId === option.id && !!applying}
                disabled={!!applying}
                onApply={() => onApply(option)}
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

export { CounterofferPanel, outcomeBannerVariants };
