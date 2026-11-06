"use client";

import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { cva } from "class-variance-authority";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Agreement } from "@/lib/schema/agreement";
import type { Counteroffer, Strategy } from "@/lib/schema/negotiation";
import { cn } from "@/lib/utils";
import { CounterofferDiff } from "./counteroffer-diff";

export const STRATEGY_LABELS: Record<Strategy, string> = {
  reduce_scope: "Reduce scope",
  adjust_price: "Adjust price",
  split_milestones: "Split into milestones",
};

const strategyBadgeVariants = cva(
  "inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      strategy: {
        reduce_scope:
          "border-status-negotiating/30 bg-status-negotiating/10 text-status-negotiating",
        adjust_price: "border-primary/30 bg-primary/10 text-primary",
        split_milestones:
          "border-status-fully-paid/30 bg-status-fully-paid/10 text-status-fully-paid",
      },
    },
    defaultVariants: {
      strategy: "adjust_price",
    },
  },
);

export interface CounterofferCardProps {
  option: Counteroffer;
  current: Agreement;
  applying?: boolean;
  disabled?: boolean;
  onApply: (option: Counteroffer) => void;
  className?: string;
}

function CounterofferCard({
  option,
  current,
  applying,
  disabled,
  onApply,
  className,
}: CounterofferCardProps) {
  const [message, setMessage] = React.useState(option.message_draft);
  const [copied, setCopied] = React.useState(false);
  const messageId = React.useId();

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <article className={cn("rounded-2xl border bg-card p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className={strategyBadgeVariants({ strategy: option.strategy })}>
          {STRATEGY_LABELS[option.strategy]}
        </span>
      </div>

      <p className="mt-3 text-sm font-medium text-foreground">
        {option.summary}
      </p>

      <div className="mt-5">
        <h4 className="text-xs font-medium text-muted-foreground">
          What changes
        </h4>
        <div className="mt-2">
          <CounterofferDiff
            current={current}
            proposed={option.proposed_agreement}
          />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <label
          htmlFor={messageId}
          className="text-xs font-medium text-muted-foreground"
        >
          Message to the client
        </label>
        <Textarea
          id={messageId}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={copyMessage}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy message"}
        </Button>
        <Button
          type="button"
          disabled={applying || disabled}
          onClick={() => onApply(option)}
        >
          {applying ? "Applying..." : "Apply to agreement"}
        </Button>
      </div>
    </article>
  );
}

export { CounterofferCard, strategyBadgeVariants };
