"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlertIcon,
  UploadIcon,
  HandshakeIcon,
  SearchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/repositories/action-result";
import { cn } from "@/lib/utils";

export type DisputeView = {
  id: string;
  invoiceKind: "deposit" | "balance";
  status: string;
  reason: string | null;
  stage: string | null;
  amount: { currency: string; value: string } | null;
  sellerResponseDueDate: string | null;
  canProvideEvidence: boolean;
};

type CommissionDisputesProps = React.ComponentProps<"section"> & {
  commissionId: string;
  listDisputes: (input: {
    commissionId: string;
  }) => Promise<ActionResult<DisputeView[]>>;
  sendEvidence: (input: {
    commissionId: string;
    disputeId: string;
  }) => Promise<ActionResult<DisputeView>>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" -> "Merchandise or service not received" */
function humanize(value: string | null): string {
  if (!value) return "-";
  const text = value.toLowerCase().replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * PayPal disputes on this commission's paid invoices (stretch #21): check
 * PayPal, then send the evidence pack PDF to a dispute that is waiting for the
 * seller.
 */
function CommissionDisputes({
  className,
  commissionId,
  listDisputes,
  sendEvidence,
  ...props
}: CommissionDisputesProps) {
  const router = useRouter();
  const [disputes, setDisputes] = React.useState<DisputeView[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function check() {
    setError(null);
    setSent(null);
    startTransition(async () => {
      const result = await listDisputes({ commissionId });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setDisputes(result.data);
    });
  }

  function send(disputeId: string) {
    setError(null);
    startTransition(async () => {
      const result = await sendEvidence({ commissionId, disputeId });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSent(disputeId);
      setDisputes((current) =>
        (current ?? []).map((d) => (d.id === disputeId ? result.data : d)),
      );
      router.refresh();
    });
  }

  return (
    <section
      data-slot="commission-disputes"
      aria-labelledby="disputes-heading"
      className={cn("space-y-4 rounded-xl border bg-card p-5", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2
            id="disputes-heading"
            className="flex items-center gap-2 text-base font-medium"
          >
            <HandshakeIcon className="size-4 text-muted-foreground" />
            PayPal disputes
          </h2>
          <p className="text-sm text-muted-foreground">
            If the client opened a dispute on a payment, send the evidence pack
            to PayPal from here.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={check}
        >
          <SearchIcon data-icon="inline-start" />
          {disputes ? "Check again" : "Check PayPal"}
        </Button>
      </div>

      {error ? (
        <p className="flex items-start gap-2 text-sm text-destructive">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {disputes && disputes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No disputes on this commission&apos;s payments.
        </p>
      ) : null}

      {disputes && disputes.length > 0 ? (
        <ul className="divide-y divide-border">
          {disputes.map((dispute) => (
            <li
              key={dispute.id}
              className="space-y-2 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-sm">{dispute.id}</span>
                <span className="text-sm text-muted-foreground">
                  {dispute.invoiceKind === "deposit" ? "Deposit" : "Balance"}
                  {dispute.amount
                    ? ` · ${dispute.amount.value} ${dispute.amount.currency}`
                    : ""}
                </span>
              </div>
              <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Reason</dt>
                <dd>{humanize(dispute.reason)}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  {humanize(dispute.status)}
                  {dispute.stage ? ` (${humanize(dispute.stage)})` : ""}
                </dd>
                {dispute.sellerResponseDueDate ? (
                  <>
                    <dt className="text-muted-foreground">Respond by</dt>
                    <dd>
                      {dateFormatter.format(
                        new Date(dispute.sellerResponseDueDate),
                      )}
                    </dd>
                  </>
                ) : null}
              </dl>
              {sent === dispute.id ? (
                <p className="text-sm text-muted-foreground">
                  Evidence pack sent to PayPal.
                </p>
              ) : dispute.canProvideEvidence ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => send(dispute.id)}
                >
                  <UploadIcon data-icon="inline-start" />
                  Send evidence pack
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  PayPal only accepts evidence while it&apos;s waiting for your
                  response.
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export { CommissionDisputes };
