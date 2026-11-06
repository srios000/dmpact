"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CircleAlertIcon, CopyIcon } from "lucide-react";
import { AgreementForm } from "@/components/organisms/agreement-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Agreement } from "@/lib/schema/agreement";
import type { AgreementEditMode } from "@/lib/state-machine/agreement-edits";
import { readAgreementFacts } from "@/lib/state-machine/agreement-facts";
import type { getCommission } from "@/lib/repositories/commission-repository";
import {
  retryBalanceInvoice,
  retryDepositInvoice,
  saveAgreementVersion,
  sendToClient,
} from "../actions";
import {
  AgreementVersionHistory,
  type VersionItem,
} from "./agreement-version-history";

type CommissionDetail = NonNullable<Awaited<ReturnType<typeof getCommission>>>;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export interface AgreementEditorProps {
  commission: CommissionDetail;
  mode: AgreementEditMode;
  today: string;
}

function AgreementEditor({ commission, mode, today }: AgreementEditorProps) {
  const router = useRouter();
  const latest = commission.versions[commission.versions.length - 1];
  const [loaded, setLoaded] = React.useState<VersionItem | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [saving, startSaving] = React.useTransition();
  const [sending, startSending] = React.useTransition();
  const [retryError, setRetryError] = React.useState<string | null>(null);
  const [retrying, startRetrying] = React.useTransition();

  const facts = readAgreementFacts(latest.agreement);
  const unsaved = dirty || loaded !== null;
  const clientLink = commission.clientToken
    ? `/a/${commission.clientToken}`
    : null;

  const sendHint =
    facts.blockerCount > 0
      ? `${plural(facts.blockerCount, "blocker needs", "blockers need")} an answer before you can send this.`
      : !facts.agreementValid
        ? "Add the price, currency and deposit before you can send this."
        : unsaved
          ? "Save your changes first. The client gets the saved version."
          : null;

  const activeRetry = commission.depositRetry
    ? {
        kind: "deposit" as const,
        error: commission.depositRetry.error,
        action: retryDepositInvoice,
      }
    : commission.balanceRetry
      ? {
          kind: "balance" as const,
          error: commission.balanceRetry.error,
          action: retryBalanceInvoice,
        }
      : null;

  function handleSave(agreement: Agreement) {
    setError(null);
    setNotice(null);
    startSaving(async () => {
      const result = await saveAgreementVersion({
        commissionId: commission.id,
        agreement,
      });
      if (!result.ok) return setError(result.error.message);
      setLoaded(null);
      setNotice(`Saved as version ${result.data.version}.`);
      router.refresh();
    });
  }

  function handleSend() {
    setError(null);
    setNotice(null);
    startSending(async () => {
      const result = await sendToClient({
        commissionId: commission.id,
        versionHash: latest.contentHash,
      });
      if (!result.ok) return setError(result.error.message);
      setNotice("Sent. Copy the client link and share it with them.");
      router.refresh();
    });
  }

  function handleRetryInvoice() {
    if (!activeRetry) return;
    setError(null);
    setNotice(null);
    setRetryError(null);
    startRetrying(async () => {
      const result = await activeRetry.action({ commissionId: commission.id });
      if (result.ok) {
        const label = activeRetry.kind === "deposit" ? "Deposit" : "Balance";
        setNotice(
          `${label} invoice sent. The client can pay it from their link.`,
        );
      } else if (result.error.code === "invoice_failed") {
        setRetryError(result.error.message);
      } else {
        setError(result.error.message);
      }
      router.refresh();
    });
  }

  async function handleCopy() {
    if (!clientLink) return;
    await navigator.clipboard.writeText(
      `${window.location.origin}${clientLink}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const original = loaded?.agreement ?? latest.agreement;

  return (
    <div className="w-full space-y-8 pb-20">
      {activeRetry && (
        <Alert variant="destructive" className="max-w-2xl p-4">
          <CircleAlertIcon />
          <AlertTitle>
            {retryError
              ? `The ${activeRetry.kind} invoice still wasn't sent`
              : `The ${activeRetry.kind} invoice wasn't sent`}
          </AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              The client can&apos;t pay the {activeRetry.kind} until it goes
              out.
            </p>
            {(retryError ?? activeRetry.error) && (
              <p className="break-words">{retryError ?? activeRetry.error}</p>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={retrying}
              onClick={handleRetryInvoice}
            >
              {retrying
                ? "Sending..."
                : `Send ${activeRetry.kind} invoice again`}
            </Button>
          </AlertDescription>
        </Alert>
      )}

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

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="space-y-6 rounded-xl border bg-card p-5 md:p-8">
          {loaded && (
            <p className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
              Showing version {loaded.version}. Save it to make it version{" "}
              {latest.version + 1}, or discard to go back to version{" "}
              {latest.version}.
            </p>
          )}
          <AgreementForm
            key={`${latest.version}-${loaded?.version ?? "latest"}`}
            original={original}
            dmText={commission.sourceDm}
            pasteDate={today}
            mode={mode}
            pending={saving}
            submitLabel={
              mode === "deadline"
                ? "Save new deadline"
                : `Save as version ${latest.version + 1}`
            }
            onDirtyChange={setDirty}
            onSubmit={handleSave}
            secondaryAction={
              loaded && (
                <Button
                  type="button"
                  size="lg"
                  variant="ghost"
                  onClick={() => setLoaded(null)}
                >
                  Discard
                </Button>
              )
            }
          />
        </section>

        <aside className="space-y-6 lg:sticky lg:top-20">
          <section
            aria-labelledby="share-heading"
            className="space-y-4 rounded-xl border bg-card p-5"
          >
            <h2 id="share-heading" className="font-medium text-foreground">
              Share with the client
            </h2>
            {commission.state === "draft" ? (
              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full"
                  disabled={sendHint !== null || sending}
                  onClick={handleSend}
                >
                  {sending ? "Sending..." : "Send to client"}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {sendHint ??
                    `Sends version ${latest.version} and gives you a link to share.`}
                </p>
              </div>
            ) : null}
            {clientLink ? (
              <div className="space-y-2">
                <label
                  htmlFor="client-link"
                  className="text-sm text-muted-foreground"
                >
                  Client link
                </label>
                <div className="flex gap-2">
                  <Input id="client-link" readOnly value={clientLink} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopy}
                    aria-label="Copy client link"
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            ) : (
              commission.state !== "draft" && (
                <p className="text-sm text-muted-foreground">
                  No client link yet.
                </p>
              )
            )}
          </section>

          <div className="rounded-xl border bg-card p-5">
            <AgreementVersionHistory
              versions={commission.versions}
              inForceVersion={commission.inForceVersion}
              loadedVersion={loaded?.version ?? null}
              onLoad={mode === "full" ? setLoaded : undefined}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

export { AgreementEditor };
