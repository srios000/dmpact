"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { usePolling } from "@/hooks/use-polling";
import type { getClientAgreement } from "@/lib/repositories/agreement-repository";
import type { PaymentStatus } from "@/lib/repositories/shared";
import { SERVICE_LABELS } from "@/lib/schema/agreement";
import type { CommissionState } from "@/lib/state-machine/rules";
import { formatSize } from "@/lib/utils";
import { confirmAgreement, downloadDelivery, requestChanges } from "../actions";

type ClientView = NonNullable<Awaited<ReturnType<typeof getClientAgreement>>>;

type LiveStatus = {
  state: CommissionState;
  updatedAt: string;
  deposit: PaymentStatus;
  balance: PaymentStatus;
};

const FINISHED: CommissionState[] = ["fully_paid", "cancelled"];

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(date: string | null): string {
  return date ? dateFormatter.format(new Date(`${date}T00:00:00Z`)) : "Not set";
}

function money(currency: string | null, amount: string | null | undefined) {
  return amount ? `${currency ?? ""} ${amount}`.trim() : "Not set";
}

const stampFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

function yesNo(value: boolean | null | undefined, yes: string, no: string) {
  if (value === true) return yes;
  if (value === false) return no;
  return null;
}

const PAYMENT_TEXT: Record<PaymentStatus["status"], string> = {
  not_required: "Not needed",
  not_created: "Invoice not sent yet",
  draft: "Invoice not sent yet",
  sent: "Waiting for payment",
  paid: "Paid",
  cancelled: "Cancelled",
};

export interface ClientAgreementProps {
  token: string;
  view: ClientView;
}

function ClientAgreement({ token, view }: ClientAgreementProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState<LiveStatus>({
    state: view.state,
    updatedAt: view.updatedAt,
    deposit: view.deposit,
    balance: view.balance,
  });
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [changes, setChanges] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [busy, startBusy] = React.useTransition();
  const [checking, setChecking] = React.useState(false);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const { agreement } = view;
  const isCreator = view.isCreator;
  const currency = agreement.price.currency;
  const clientEmail = agreement.parties?.client?.email ?? null;
  const awaitingClient = view.awaitingClient && status.state === view.state;
  const needsEmail = !clientEmail && awaitingClient;
  const invoiceOut =
    status.deposit.status === "sent" || status.balance.status === "sent";
  const finalFiles =
    view.finalFiles.length > 0
      ? view.finalFiles
      : view.deliveryLog.filter((file) => file.isFinal);

  const fetchStatus = React.useCallback(
    async (syncPayment: boolean): Promise<LiveStatus | null> => {
      if (syncPayment) {
        await fetch(`/api/commissions/${view.commissionId}/refresh-payment`, {
          method: "POST",
          headers: { "x-client-token": token },
        }).catch(() => null);
      }
      const response = await fetch(
        `/api/commissions/${view.commissionId}/status`,
        { headers: { "x-client-token": token }, cache: "no-store" },
      );
      return response.ok ? ((await response.json()) as LiveStatus) : null;
    },
    [view.commissionId, token],
  );

  const applyStatus = React.useCallback(
    (next: LiveStatus | null) => {
      if (!next) return;
      setStatus((prev) => {
        if (
          next.state !== prev.state ||
          next.updatedAt !== prev.updatedAt ||
          next.deposit.status !== prev.deposit.status ||
          next.balance.status !== prev.balance.status
        ) {
          router.refresh();
        }
        return next;
      });
    },
    [router],
  );

  usePolling<LiveStatus | null>({
    enabled: !FINISHED.includes(status.state),
    intervalMs: 10_000,
    poll: () => fetchStatus(invoiceOut),
    onData: applyStatus,
  });

  React.useEffect(() => {
    if (!invoiceOut) return;
    function onVisible() {
      if (document.visibilityState === "visible") {
        void fetchStatus(true).then(applyStatus);
      }
    }
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [invoiceOut, fetchStatus, applyStatus]);

  async function checkPayment() {
    setChecking(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/commissions/${view.commissionId}/refresh-payment`,
        { method: "POST", headers: { "x-client-token": token } },
      );
      if (!response.ok) {
        setError("Couldn't reach PayPal. Try again in a moment.");
        return;
      }
      applyStatus(await fetchStatus(false));
      router.refresh();
    } finally {
      setChecking(false);
    }
  }

  async function handleDownload(deliveryId: string) {
    setDownloadingId(deliveryId);
    setError(null);
    try {
      const result = await downloadDelivery(token, deliveryId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      window.location.assign(result.data.url);
    } finally {
      setDownloadingId(null);
    }
  }

  function run(action: () => Promise<string | null>) {
    setError(null);
    setNotice(null);
    startBusy(async () => {
      const message = await action();
      if (message === null) return;
      setNotice(message);
      router.refresh();
    });
  }

  function handleConfirm() {
    run(async () => {
      const result = await confirmAgreement(token, view.versionHash);
      if (!result.ok) {
        setError(result.error.message);
        return null;
      }
      return "Confirmed. Thanks!";
    });
  }

  function handleChanges() {
    const message = changes?.trim();
    if (!message) return;
    run(async () => {
      const result = await requestChanges(token, message);
      if (!result.ok) {
        setError(result.error.message);
        return null;
      }
      setChanges(null);
      return `Sent to ${view.creatorName}. You'll see the updated agreement here.`;
    });
  }

  function handleEmail(event: React.FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!value) return;
    run(async () => {
      const result = await requestChanges(
        token,
        `My PayPal email for the invoice is ${value}.`,
      );
      if (!result.ok) {
        setError(result.error.message);
        return null;
      }
      setEmail("");
      return `Sent to ${view.creatorName}. They'll add it to the agreement.`;
    });
  }

  const terms: { label: string; value: React.ReactNode }[] = [
    {
      label: "Service",
      value:
        agreement.service_type === "other"
          ? (agreement.service_other ?? "Other")
          : SERVICE_LABELS[agreement.service_type],
    },
    {
      label: "Deliverables",
      value: (
        <ul className="space-y-1">
          {agreement.deliverables.map((d) => (
            <li key={d.id}>
              {d.quantity > 1 ? `${d.quantity} × ` : ""}
              {d.description}
              {d.format && (
                <span className="text-muted-foreground"> ({d.format})</span>
              )}
            </li>
          ))}
        </ul>
      ),
    },
    { label: "Price", value: money(currency, agreement.price.total) },
    {
      label: "Deposit",
      value:
        agreement.deposit.type === "none"
          ? "No deposit"
          : money(currency, agreement.deposit.amount),
    },
    { label: "On delivery", value: money(currency, agreement.balance_amount) },
    {
      label: "Deadline",
      value: view.deadlineInForce ? (
        <>
          {formatDate(agreement.deadline.date)}
          <span className="block text-muted-foreground">
            Changed from {formatDate(view.deadlineInForce.date)}
          </span>
        </>
      ) : (
        formatDate(agreement.deadline.date)
      ),
    },
    {
      label: "Revisions",
      value:
        agreement.revisions.included === null
          ? "Not set"
          : `${agreement.revisions.included} included`,
    },
    {
      label: "Usage",
      value:
        [
          yesNo(
            agreement.usage_rights?.commercial,
            "Commercial use allowed",
            "Personal use only",
          ),
          yesNo(
            agreement.usage_rights?.credit_required,
            "credit required",
            "no credit needed",
          ),
          agreement.usage_rights?.notes,
        ]
          .filter(Boolean)
          .join(", ") || "Not set",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8 md:py-14">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">From {view.creatorName}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {agreement.title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <StatusBadge state={status.state} />
          <span>Version {view.version}</span>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border bg-card p-4 text-sm text-foreground"
        >
          {notice}
        </p>
      )}

      <section
        aria-labelledby="next-heading"
        className="space-y-4 rounded-xl border bg-card p-5 md:p-6"
      >
        <h2 id="next-heading" className="text-lg font-medium text-foreground">
          {awaitingClient && !isCreator
            ? view.deadlineInForce
              ? "Confirm the new deadline"
              : "Check and confirm"
            : "What happens next"}
        </h2>

        {awaitingClient && isCreator ? (
          <p className="text-muted-foreground">
            You&apos;re viewing your own client link. Only the client can
            confirm this agreement or ask for changes here.
          </p>
        ) : awaitingClient ? (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {view.deadlineInForce
                ? `${view.creatorName} changed the deadline. The old one stays until you confirm.`
                : `Read the terms below. Confirm if they're right, or ask ${view.creatorName} for changes.`}
            </p>

            {needsEmail && (
              <form onSubmit={handleEmail} className="space-y-2">
                <Label htmlFor="paypal-email">Your PayPal email</Label>
                <p className="text-sm text-muted-foreground">
                  {agreement.deposit.type === "none"
                    ? "The invoice goes to this address."
                    : "The deposit invoice goes to this address."}{" "}
                  You can confirm once {view.creatorName} adds it.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="paypal-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                  />
                  <Button
                    type="submit"
                    size="lg"
                    variant="outline"
                    className="h-11"
                    disabled={busy || !email.trim()}
                  >
                    Send email
                  </Button>
                </div>
              </form>
            )}

            {changes === null ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-11 px-6"
                  disabled={busy || needsEmail}
                  onClick={handleConfirm}
                >
                  {busy ? "Sending..." : "Confirm agreement"}
                </Button>
                {!view.deadlineInForce && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-11 px-6"
                    disabled={busy}
                    onClick={() => setChanges("")}
                  >
                    Ask for changes
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="changes">What should change?</Label>
                <Textarea
                  id="changes"
                  className="min-h-28"
                  value={changes}
                  onChange={(e) => setChanges(e.target.value)}
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    className="h-11 px-6"
                    disabled={busy || !changes.trim()}
                    onClick={handleChanges}
                  >
                    {busy ? "Sending..." : "Send changes"}
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    className="h-11"
                    onClick={() => setChanges(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <NextStep view={view} status={status} />
        )}
      </section>

      <section
        aria-labelledby="payments-heading"
        className="space-y-4 rounded-xl border bg-card p-5 md:p-6"
      >
        <h2 id="payments-heading" className="text-lg font-medium">
          Payments
        </h2>
        <dl className="divide-y divide-border text-sm">
          <PaymentRow
            label="Deposit"
            amount={money(currency, agreement.deposit.amount)}
            payment={status.deposit}
          />
          <PaymentRow
            label="On delivery"
            amount={money(currency, agreement.balance_amount)}
            payment={status.balance}
          />
        </dl>
        {invoiceOut && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={checking}
              onClick={checkPayment}
            >
              {checking ? "Checking..." : "Check payment status"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Paid already? This asks PayPal now.
            </p>
          </div>
        )}
      </section>

      <section
        aria-labelledby="terms-heading"
        className="space-y-4 rounded-xl border bg-card p-5 md:p-6"
      >
        <h2 id="terms-heading" className="text-lg font-medium">
          Terms
        </h2>
        <dl className="divide-y divide-border text-sm">
          {terms.map((term) => (
            <div
              key={term.label}
              className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[8rem_1fr] sm:gap-4"
            >
              <dt className="text-muted-foreground">{term.label}</dt>
              <dd className="text-foreground">{term.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {view.deliveryLog.length > 0 && (
        <section
          aria-labelledby="delivery-log-heading"
          className="space-y-4 rounded-xl border bg-card p-5 md:p-6"
        >
          <div className="space-y-1">
            <h2 id="delivery-log-heading" className="text-lg font-medium">
              Delivery record
            </h2>
            <p className="text-sm text-muted-foreground">
              Every file {view.creatorName} delivered, when it was logged, and
              its SHA-256 fingerprint. A file with the same fingerprint is
              byte-for-byte the same file.
            </p>
          </div>
          <ul className="divide-y divide-border text-sm">
            {view.deliveryLog.map((file) => (
              <li key={file.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                <div className="flex justify-between gap-4">
                  <span className="min-w-0 truncate font-medium">
                    {file.filename}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {file.isFinal ? "Final" : "Preview"} ·{" "}
                    {formatSize(file.sizeBytes)} · {file.mimeType}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  Logged {stampFormatter.format(new Date(file.loggedAt))}
                </p>
                <p className="font-mono text-xs break-all text-muted-foreground">
                  SHA-256 {file.sha256}
                </p>
                {!file.isFinal && status.state !== "cancelled" && (
                  <div className="pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={downloadingId !== null}
                      onClick={() => handleDownload(file.id)}
                    >
                      {downloadingId === file.id
                        ? "Preparing..."
                        : "Download preview"}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {status.state === "fully_paid" && (
        <section
          aria-labelledby="files-heading"
          className="space-y-4 rounded-xl border bg-card p-5 md:p-6"
        >
          <h2 id="files-heading" className="text-lg font-medium">
            Final files
          </h2>
          {finalFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No final files yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {finalFiles.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {file.filename}
                    </p>
                    <p className="text-muted-foreground">
                      {formatSize(file.sizeBytes)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloadingId !== null}
                    onClick={() => handleDownload(file.id)}
                  >
                    {downloadingId === file.id ? "Preparing..." : "Download"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

function PaymentRow({
  label,
  amount,
  payment,
}: {
  label: string;
  amount: string;
  payment: PaymentStatus;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div>
        <dt className="text-foreground">
          {label}: {amount}
        </dt>
        <dd
          className={
            payment.status === "paid"
              ? "text-status-fully-paid"
              : "text-muted-foreground"
          }
        >
          {PAYMENT_TEXT[payment.status]}
        </dd>
      </div>
      {payment.status === "sent" && payment.payLink && (
        <Button
          nativeButton={false}
          render={<a href={payment.payLink} target="_blank" rel="noreferrer" />}
        >
          Pay with PayPal
        </Button>
      )}
    </div>
  );
}

function NextStep({ view, status }: { view: ClientView; status: LiveStatus }) {
  const creator = view.creatorName;
  const text: Record<CommissionState, string> = {
    draft: `${creator} hasn't sent this yet.`,
    negotiating: `You confirmed version ${view.version}. Waiting for ${creator} to confirm too.`,
    agreed:
      status.deposit.status === "sent"
        ? "Both of you confirmed. Pay the deposit below to start the work."
        : status.deposit.status === "not_required"
          ? `Both of you confirmed. ${creator} can start the work.`
          : "Both of you confirmed. The deposit invoice is on its way.",
    dp_paid: `Deposit paid. ${creator} will start soon.`,
    in_progress: `${creator} is working on it.`,
    delivered: `${creator} delivered the work. Pay the rest below to get the final files.`,
    fully_paid: "Paid in full. Thanks!",
    cancelled: "This commission was cancelled.",
  };
  return <p className="text-muted-foreground">{text[status.state]}</p>;
}

export { ClientAgreement };
