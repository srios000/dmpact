"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BellIcon,
  CircleAlertIcon,
  DownloadIcon,
  PlayIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/repositories/action-result";
import type { TransitionCommissionInput } from "@/lib/schema/commission-forms";
import type { CommissionState } from "@/lib/state-machine/rules";
import type { TransitionResult } from "@/lib/state-machine/transition";
import { cn } from "@/lib/utils";

type TransitionAction = (
  input: TransitionCommissionInput,
) => Promise<ActionResult<TransitionResult>>;

type PaymentLine = {
  status:
    "not_required" | "not_created" | "draft" | "sent" | "paid" | "cancelled";
};

export interface CommissionActionsProps extends React.HTMLAttributes<HTMLElement> {
  commissionId: string;
  state: CommissionState;
  deposit: PaymentLine;
  balance: PaymentLine;
  transition: TransitionAction;
}

const CANCELLABLE: CommissionState[] = ["draft", "negotiating", "agreed"];

function canStartWork(state: CommissionState, deposit: PaymentLine): boolean {
  return (
    state === "dp_paid" ||
    (state === "agreed" && deposit.status === "not_required")
  );
}

function needsReminder(deposit: PaymentLine, balance: PaymentLine): boolean {
  return deposit.status === "sent" || balance.status === "sent";
}

function ActionRow({
  label,
  hint,
  disabled,
  variant,
  icon: Icon,
  pending,
  onClick,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  variant?: "default" | "outline" | "destructive";
  icon: React.ComponentType<{ className?: string; "data-icon"?: string }>;
  pending?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        size="lg"
        variant={variant ?? "default"}
        className="w-full justify-start"
        disabled={disabled || pending}
        onClick={onClick}
      >
        <Icon data-icon="inline-start" />
        {label}
      </Button>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function CommissionActions({
  className,
  commissionId,
  state,
  deposit,
  balance,
  transition,
  ...props
}: CommissionActionsProps) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function run(to: "in_progress" | "delivered" | "cancelled") {
    setError(null);
    startTransition(async () => {
      const result = await transition({ commissionId, to });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setConfirmingCancel(false);
      router.refresh();
    });
  }

  const startable = canStartWork(state, deposit);
  const isStartState = state === "agreed" || state === "dp_paid";

  return (
    <section
      className={cn("space-y-4 rounded-xl border bg-card p-5", className)}
      {...props}
    >
      <header className="space-y-1">
        <h2 className="font-medium text-foreground">Actions</h2>
        <p className="text-sm text-muted-foreground">
          What you can do while this commission is in its current state.
        </p>
      </header>

      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>That didn&apos;t work</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
        {isStartState ? (
          <ActionRow
            label="Start work"
            icon={PlayIcon}
            pending={pending}
            disabled={!startable}
            hint={
              startable
                ? "Moves the commission to in progress."
                : "The deposit must be paid before work starts."
            }
            onClick={() => run("in_progress")}
          />
        ) : null}

        {state === "in_progress" ? (
          <ActionRow
            label="Upload delivery"
            icon={UploadIcon}
            disabled
            hint="File upload ships with issue #42."
          />
        ) : null}

        {needsReminder(deposit, balance) ? (
          <ActionRow
            label="Run reminder"
            icon={BellIcon}
            variant="outline"
            disabled
            hint="Automatic reminders ship with issue #18."
          />
        ) : null}

        {state === "delivered" || state === "fully_paid" ? (
          <ActionRow
            label="Download evidence pack"
            icon={DownloadIcon}
            variant="outline"
            disabled
            hint="The PDF evidence pack ships with issue #20."
          />
        ) : null}

        {CANCELLABLE.includes(state) ? (
          <div className="space-y-1.5">
            <Button
              type="button"
              size="lg"
              variant="destructive"
              className="w-full justify-start"
              disabled={pending}
              onClick={() =>
                confirmingCancel ? run("cancelled") : setConfirmingCancel(true)
              }
            >
              <XIcon data-icon="inline-start" />
              {confirmingCancel ? "Confirm cancellation" : "Cancel commission"}
            </Button>
            {confirmingCancel ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Open invoices will be cancelled.
                </p>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setConfirmingCancel(false)}
                >
                  Keep it
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export { CommissionActions };
