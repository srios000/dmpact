"use client";

import * as React from "react";
import Link from "next/link";
import { LoaderCircleIcon } from "lucide-react";
import { ErrorState } from "@/components/molecules/error-state";
import { AgreementForm } from "@/components/organisms/agreement-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { blankAgreement } from "@/lib/ai/extract/review";
import type { Agreement } from "@/lib/schema/agreement";
import { MAX_DM_CHARS } from "@/lib/schema/commission-forms";
import { saveAgreementVersion } from "../../[id]/actions";
import { createCommission, extractAgreement } from "../actions";

type Phase = "paste" | "loading" | "review" | "error" | "saved";

type Draft = {
  id: number;
  original: Agreement;
  dmText: string;
  fallback: boolean;
};

type Saved = {
  commissionId: string;
  version: number;
  contentHash: string;
  agreement: Agreement;
};

function todayInJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function blockerCount(agreement: Agreement): number {
  return agreement.ambiguities.filter((a) => a.severity === "blocker").length;
}

export function ExtractionReview() {
  const [phase, setPhase] = React.useState<Phase>("paste");
  const [dmText, setDmText] = React.useState("");
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saved, setSaved] = React.useState<Saved | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saving, startSaving] = React.useTransition();
  const [pasteDate] = React.useState(todayInJakarta);
  const draftCount = React.useRef(0);

  const isFollowUp = saved !== null;

  async function handleExtract() {
    const text = dmText.trim();
    if (!text) return;
    setPhase("loading");
    setError(null);
    try {
      const result = await extractAgreement({
        dmText: text,
        commissionId: saved?.commissionId,
      });
      if (result.ok) {
        setDraft({
          id: ++draftCount.current,
          original: result.data.agreement,
          dmText: text,
          fallback: result.data.fallback,
        });
        setSaveError(null);
        setPhase("review");
      } else {
        setError(result.error.message);
        setPhase("error");
      }
    } catch {
      setError("Could not reach the server. Check your connection and retry.");
      setPhase("error");
    }
  }

  function handleManual() {
    setDraft({
      id: ++draftCount.current,
      original: saved?.agreement ?? blankAgreement(pasteDate),
      dmText: dmText.trim(),
      fallback: false,
    });
    setSaveError(null);
    setPhase("review");
  }

  function handleSave(agreement: Agreement) {
    if (!draft) return;
    setSaveError(null);
    startSaving(async () => {
      if (saved) {
        const result = await saveAgreementVersion({
          commissionId: saved.commissionId,
          agreement,
          followUpDm: draft.dmText || undefined,
        });
        if (!result.ok) return setSaveError(result.error.message);
        setSaved({ ...saved, ...result.data, agreement });
      } else {
        const result = await createCommission({
          sourceDm: draft.dmText,
          agreement,
        });
        if (!result.ok) return setSaveError(result.error.message);
        setSaved({
          commissionId: result.data.id,
          version: result.data.version,
          contentHash: result.data.contentHash,
          agreement,
        });
      }
      setDmText("");
      setDraft(null);
      setPhase("saved");
    });
  }

  const heading =
    phase === "review"
      ? "Check the agreement"
      : isFollowUp
        ? "Add a follow-up DM"
        : "New commission";

  return (
    <div className="w-full space-y-8 pb-20">
      <header hidden={phase === "saved"} className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {heading}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          {phase === "review"
            ? "Fix anything the AI got wrong. Flags sit under the field they belong to."
            : isFollowUp
              ? "Paste what the client sent next. It's read together with the first DM and saved as a new version."
              : "Paste the client's DM. You'll get the terms back as a form, with anything unclear flagged."}
        </p>
      </header>

      {phase === "paste" && (
        <div className="max-w-3xl space-y-4">
          <div className="rounded-xl border bg-card">
            <Textarea
              aria-label={isFollowUp ? "Follow-up DM" : "Client DM"}
              aria-describedby="dm-hint"
              className="min-h-72 resize-y border-0 bg-transparent p-5 text-base leading-relaxed focus-visible:ring-0"
              placeholder={
                isFollowUp
                  ? "Paste the follow-up message"
                  : "Paste the whole conversation"
              }
              maxLength={MAX_DM_CHARS}
              value={dmText}
              onChange={(e) => setDmText(e.target.value)}
            />
            <div className="flex flex-wrap justify-between gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
              <span id="dm-hint">
                Price, deadline and usage rights help most. Slang and Indonesian
                are fine.
              </span>
              <span>
                {dmText.length.toLocaleString()} of{" "}
                {MAX_DM_CHARS.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-11 px-6"
              onClick={handleExtract}
              disabled={!dmText.trim()}
            >
              {isFollowUp ? "Read follow-up" : "Read DM"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-6"
              onClick={handleManual}
            >
              Fill in by hand
            </Button>
            {isFollowUp && (
              <Button
                size="lg"
                variant="ghost"
                className="h-11"
                onClick={() => setPhase("saved")}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {phase === "loading" && (
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
      )}

      {phase === "error" && (
        <ErrorState
          title="Couldn't read this DM"
          description={error ?? "Something went wrong while reading the DM."}
          onRetry={handleExtract}
          retryLabel="Try again"
          action={
            <>
              <Button size="lg" variant="outline" onClick={handleManual}>
                Fill in by hand
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => setPhase("paste")}
              >
                Edit the DM
              </Button>
            </>
          }
        />
      )}

      {phase === "review" && draft && (
        <section className="space-y-6 rounded-xl border bg-card p-5 md:p-8">
          {draft.fallback && (
            <p
              role="alert"
              className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-foreground"
            >
              The AI couldn&apos;t read every term from this DM. Check the
              flagged fields and fill in the rest.
            </p>
          )}
          {saveError && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive"
            >
              {saveError}
            </p>
          )}
          <AgreementForm
            key={draft.id}
            original={draft.original}
            dmText={draft.dmText}
            pasteDate={pasteDate}
            pending={saving}
            submitLabel={
              saved
                ? `Save as version ${saved.version + 1}`
                : "Create commission"
            }
            onSubmit={handleSave}
            secondaryAction={
              <Button
                type="button"
                size="lg"
                variant="ghost"
                onClick={() => setPhase(saved ? "saved" : "paste")}
              >
                {saved ? "Cancel" : "Back to the DM"}
              </Button>
            }
          />
        </section>
      )}

      {phase === "saved" && saved && (
        <section className="max-w-3xl space-y-6 rounded-xl border bg-card p-6 md:p-8">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {saved.version === 1
                ? "Commission created"
                : `Version ${saved.version} saved`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {saved.agreement.title}, version {saved.version}.{" "}
              {blockerCount(saved.agreement) === 0
                ? "No blockers left."
                : `${blockerCount(saved.agreement)} ${
                    blockerCount(saved.agreement) === 1
                      ? "blocker needs"
                      : "blockers need"
                  } an answer before you send it.`}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href={`/commissions/${saved.commissionId}`} />}
            >
              Open the agreement
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setPhase("paste")}
            >
              Add a follow-up DM
            </Button>
            <Button
              size="lg"
              variant="ghost"
              nativeButton={false}
              render={<Link href="/commissions" />}
            >
              Go to the queue
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
