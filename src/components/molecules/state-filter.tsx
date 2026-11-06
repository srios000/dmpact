"use client";

import * as React from "react";
import { cva } from "class-variance-authority";
import {
  COMMISSION_STATES,
  type CommissionState,
} from "@/lib/state-machine/rules";
import { STATE_LABELS } from "@/lib/state-machine/labels";
import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      active: {
        true: "border-primary bg-primary/10 text-foreground",
        false:
          "border-border text-muted-foreground hover:border-input hover:text-foreground",
      },
    },
    defaultVariants: {
      active: false,
    },
  },
);

export interface StateFilterProps {
  counts: Partial<Record<CommissionState, number>>;
  total: number;
  value: CommissionState | null;
  onChange: (value: CommissionState | null) => void;
  className?: string;
}

function StateFilter({
  counts,
  total,
  value,
  onChange,
  className,
}: StateFilterProps) {
  return (
    <div
      role="group"
      aria-label="Filter by state"
      className={cn("flex flex-wrap gap-2", className)}
    >
      <button
        type="button"
        aria-pressed={value === null}
        className={chipVariants({ active: value === null })}
        onClick={() => onChange(null)}
      >
        All
        <span className="text-muted-foreground tabular-nums">{total}</span>
      </button>
      {COMMISSION_STATES.filter((state) => counts[state]).map((state) => (
        <button
          key={state}
          type="button"
          aria-pressed={value === state}
          className={chipVariants({ active: value === state })}
          onClick={() => onChange(value === state ? null : state)}
        >
          {STATE_LABELS[state]}
          <span className="text-muted-foreground tabular-nums">
            {counts[state]}
          </span>
        </button>
      ))}
    </div>
  );
}

export { StateFilter };
