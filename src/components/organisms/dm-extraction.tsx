"use client";

import * as React from "react";
import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react";
import { ErrorState } from "@/components/molecules/error-state";
import { AgreementForm } from "@/components/organisms/agreement-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ExtractResult } from "@/lib/ai/extract";
import type { ActionResult } from "@/lib/repositories/action-result";
import type { Agreement } from "@/lib/schema/agreement";
import {
  MAX_DM_CHARS,
  type ExtractAgreementInput,
} from "@/lib/schema/commission-forms";

export type ExtractDm = (
  input: ExtractAgreementInput,
) => Promise<ActionResult<ExtractResult>>;

export type DmPhase = "paste" | "loading" | "review" | "error";

export type DmDraft = {
  id: number;
  original: Agreement;
  dmText: string;
  fallback: boolean;
};

export type ReadDmOutcome =
  | { ok: true; agreement: Agreement; fallback: boolean }
  | { ok: false; message: string };

export const UNREACHABLE_MESSAGE =
  "Could not reach the server. Check your connection and retry.";

export async function readDm(
  extract: ExtractDm,
  input: ExtractAgreementInput,
): Promise<ReadDmOutcome> {
  try {
    const result = await extract(input);
    return result.ok
      ? {
          ok: true,
          agreement: result.data.agreement,
          fallback: result.data.fallback,
        }
      : { ok: false, message: result.error.message };
  } catch {
    return { ok: false, message: UNREACHABLE_MESSAGE };
  }
}

export interface UseDmExtractionOptions {
  extract: ExtractDm;
  commissionId?: string;
  manualStart: () => Agreement;
}

export function useDmExtraction({
  extract,
  commissionId,
  manualStart,
}: UseDmExtractionOptions) {
  const [phase, setPhase] = React.useState<DmPhase>("paste");
  const [dmText, setDmText] = React.useState("");
  const [draft, setDraft] = React.useState<DmDraft | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const draftCount = React.useRef(0);

  async function read() {
    const text = dmText.trim();
    if (!text) return;
    setPhase("loading");
    setError(null);
    const outcome = await readDm(extract, { dmText: text, commissionId });
    if (outcome.ok) {
      setDraft({
        id: ++draftCount.current,
        original: outcome.agreement,
        dmText: text,
        fallback: outcome.fallback,
      });
      setPhase("review");
    } else {
      setError(outcome.message);
      setPhase("error");
    }
  }

  function manual() {
    setDraft({
      id: ++draftCount.current,
      original: manualStart(),
      dmText: dmText.trim(),
      fallback: false,
    });
    setPhase("review");
  }

  function reset() {
    setDmText("");
    setDraft(null);
    setError(null);
    setPhase("paste");
  }

  return {
    phase,
    setPhase,
    dmText,
    setDmText,
    draft,
    error,
    read,
    manual,
    reset,
  };
}

export interface DmPasteStepProps {
  followUp: boolean;
  value: string;
  onChange: (value: string) => void;
  onRead: () => void;
  onManual: () => void;
  onCancel?: () => void;
}

export function DmPasteStep({
  followUp,
  value,
  onChange,
  onRead,
  onManual,
  onCancel,
}: DmPasteStepProps) {
  const hintId = React.useId();
  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-xl border bg-card">
        <Textarea
          aria-label={followUp ? "Follow-up DM" : "Client DM"}
          aria-describedby={hintId}
          className="min-h-72 resize-y border-0 bg-transparent p-5 text-base leading-relaxed focus-visible:ring-0"
          placeholder={
            followUp
              ? "Paste the follow-up message"
              : "Paste the whole conversation"
          }
          maxLength={MAX_DM_CHARS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="flex flex-wrap justify-between gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
          <span id={hintId}>
            Price, deadline and usage rights help most. Slang and Indonesian are
            fine.
          </span>
          <span>
            {value.length.toLocaleString()} of {MAX_DM_CHARS.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="h-11 px-6"
          onClick={onRead}
          disabled={!value.trim()}
        >
          {followUp ? "Read follow-up" : "Read DM"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-11 px-6"
          onClick={onManual}
        >
          Fill in by hand
        </Button>
        {onCancel && (
          <Button size="lg" variant="ghost" className="h-11" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

export function DmReadingStatus() {
  return (
    <div
      role="status"
      className="flex max-w-3xl items-center gap-4 rounded-xl border bg-card p-6"
    >
      <LoaderCircleIcon className="size-6 animate-spin text-primary motion-reduce:animate-none" />
      <div>
        <p className="font-medium text-foreground">Reading the DM</p>
        <p className="text-sm text-muted-foreground">
          This usually takes a few seconds.
        </p>
      </div>
    </div>
  );
}

export interface DmReadErrorProps {
  message: string | null;
  onRetry: () => void;
  onManual: () => void;
  onEdit: () => void;
}

export function DmReadError({
  message,
  onRetry,
  onManual,
  onEdit,
}: DmReadErrorProps) {
  return (
    <ErrorState
      title="Couldn't read this DM"
      description={message ?? "Something went wrong while reading the DM."}
      onRetry={onRetry}
      retryLabel="Try again"
      action={
        <>
          <Button size="lg" variant="outline" onClick={onManual}>
            Fill in by hand
          </Button>
          <Button size="lg" variant="ghost" onClick={onEdit}>
            Edit the DM
          </Button>
        </>
      }
    />
  );
}

export interface DmReviewStepProps {
  draft: DmDraft;
  pasteDate: string;
  pending: boolean;
  saveError: string | null;
  submitLabel: string;
  onSubmit: (agreement: Agreement) => void;
  secondaryAction: React.ReactNode;
}

export function DmReviewStep({
  draft,
  pasteDate,
  pending,
  saveError,
  submitLabel,
  onSubmit,
  secondaryAction,
}: DmReviewStepProps) {
  return (
    <section className="space-y-6 rounded-xl border bg-card p-5 md:p-8">
      {draft.fallback && (
        <Alert className="border-warning/30 bg-warning/5 p-4 text-foreground">
          <CircleAlertIcon />
          <AlertDescription className="text-foreground">
            The AI couldn&apos;t read every term from this DM. Check the flagged
            fields and fill in the rest.
          </AlertDescription>
        </Alert>
      )}
      {saveError && (
        <Alert variant="destructive" className="p-4">
          <CircleAlertIcon />
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
      <AgreementForm
        key={draft.id}
        original={draft.original}
        dmText={draft.dmText}
        pasteDate={pasteDate}
        pending={pending}
        submitLabel={submitLabel}
        onSubmit={onSubmit}
        secondaryAction={secondaryAction}
      />
    </section>
  );
}
