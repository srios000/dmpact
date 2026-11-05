import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  label: string;
  active: boolean;
  current?: boolean;
}

export interface ProgressStepperProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: StepperStep[];
}

const DEFAULT_STEPS: StepperStep[] = [
  { label: "Agreement", active: true },
  { label: "DP Payment", active: true },
  { label: "Work In Progress", active: false, current: true },
  { label: "Final Payment", active: false },
  { label: "Final Delivery", active: false },
];

function ProgressStepper({ className, steps, ...props }: ProgressStepperProps) {
  const displaySteps = steps.length > 0 ? steps : DEFAULT_STEPS;

  return (
    <div
      className={cn(
        "relative flex flex-col items-start justify-between gap-8 px-2 md:flex-row md:items-center md:gap-0 md:px-6",
        className,
      )}
      {...props}
    >
      <div className="absolute top-[24px] right-12 left-12 -z-0 hidden h-[8px] rounded-full bg-muted shadow-inner md:block" />

      {displaySteps.map((step, i, arr) => (
        <div
          key={i}
          className="group relative z-10 flex w-full flex-1 flex-row items-center gap-6 md:w-auto md:flex-col"
        >
          <div className="relative flex shrink-0 items-center justify-center">
            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-2xl border-2 shadow-[0_8px_20px_rgba(0,0,0,0.06)] transition-all duration-500",
                step.active
                  ? "rotate-0 border-primary bg-primary text-primary-foreground"
                  : step.current
                    ? "rotate-45 border-primary bg-card text-primary ring-4 ring-primary/10"
                    : "rotate-0 border-border bg-card text-muted",
              )}
            >
              <div
                className={cn(
                  "transition-transform duration-500",
                  step.current && "-rotate-45",
                )}
              >
                {step.active ? (
                  <CheckIcon className="size-5" />
                ) : (
                  <div
                    className={cn(
                      "size-3 rounded-full",
                      step.current ? "animate-pulse bg-primary" : "bg-muted",
                    )}
                  />
                )}
              </div>
            </div>

            {step.current ? (
              <div className="absolute -inset-1 -z-10 animate-ping rounded-2xl bg-primary/20" />
            ) : null}
          </div>

          <div className="flex min-w-[100px] flex-col items-start gap-1 md:items-center">
            <span
              className={cn(
                "text-left text-[11px] leading-tight font-black tracking-[0.15em] uppercase transition-colors duration-300 md:text-center",
                step.active || step.current
                  ? "text-foreground"
                  : "text-muted-foreground/50",
              )}
            >
              {step.label}
            </span>
            {(step.active || step.current) && (
              <span className="hidden text-[9px] font-bold tracking-widest text-muted-foreground uppercase md:block">
                {step.active ? "Completed" : "In Progress"}
              </span>
            )}
          </div>

          {i < arr.length - 1 && step.active ? (
            <div
              className={cn(
                "absolute top-[24px] left-[calc(50%+24px)] -z-10 hidden h-[8px] w-[calc(100%-48px)] rounded-full shadow-[0_4px_10px_rgba(30,47,80,0.2)] transition-all duration-700 md:block",
                arr[i + 1].active
                  ? "bg-primary"
                  : "bg-gradient-to-r from-primary to-muted",
              )}
            />
          ) : null}

          {i < arr.length - 1 ? (
            <div
              className={cn(
                "absolute top-12 left-[21px] -z-10 h-8 w-[6px] rounded-full shadow-inner md:hidden",
                step.active && arr[i + 1].active ? "bg-primary" : "bg-muted",
              )}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export { ProgressStepper };
