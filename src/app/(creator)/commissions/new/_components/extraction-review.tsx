"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  MessageSquarePlusIcon,
  PencilIcon,
} from "lucide-react";
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

const GUIDELINES = [
  { text: "Paste the full conversation", dot: "bg-primary" },
  { text: "Include price and currency", dot: "bg-accent" },
  { text: "Include the deadline", dot: "bg-status-fully-paid" },
  { text: "Slang, typos and Indonesian are fine", dot: "bg-warning" },
];

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

  return (
    <div className="w-full space-y-10 pb-20">
      <header className="space-y-3">
        <h1 className="font-heading text-4xl font-black tracking-tight text-foreground md:text-5xl">
          {isFollowUp ? "Follow-up " : "Extract "}
          <span className="animate-gradient text-glow bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] bg-clip-text text-transparent">
            agreement.
          </span>
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {isFollowUp
            ? "Paste the client's follow-up DM. The AI reads it with the original DM and the result is saved as a new version."
            : "Paste the client's DM. The AI pulls out the terms and flags anything unclear before you send it."}
        </p>
      </header>

      {phase === "paste" && (
        <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            <div className="relative rounded-[2rem] border bg-card p-2 shadow-2xl backdrop-blur-3xl">
              <Textarea
                aria-label={isFollowUp ? "Follow-up DM" : "Client DM"}
                className="min-h-72 resize-y rounded-[1.5rem] border-0 bg-transparent p-6 text-base leading-relaxed focus-visible:ring-0"
                placeholder={
                  isFollowUp
                    ? "Paste the follow-up message here..."
                    : "Paste the conversation here..."
                }
                maxLength={MAX_DM_CHARS}
                value={dmText}
                onChange={(e) => setDmText(e.target.value)}
              />
              <p className="px-6 pb-3 text-right text-xs text-muted-foreground">
                {dmText.length.toLocaleString()} /{" "}
                {MAX_DM_CHARS.toLocaleString()}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="h-12 flex-1"
                onClick={handleExtract}
                disabled={!dmText.trim()}
              >
                {isFollowUp ? "Analyze follow-up" : "Analyze DM"}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12"
                onClick={handleManual}
              >
                <PencilIcon data-icon="inline-start" />
                Fill in by hand
              </Button>
              {isFollowUp && (
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-12"
                  onClick={() => setPhase("saved")}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>

          <aside className="hidden rounded-[2rem] border bg-card p-8 lg:block">
            <h2 className="text-xs font-black tracking-widest text-muted-foreground uppercase">
              Tips
            </h2>
            <ul className="mt-6 space-y-4">
              {GUIDELINES.map((item) => (
                <li
                  key={item.text}
                  className="flex items-center gap-3 text-sm font-bold text-foreground"
                >
                  <span className={`size-2 rounded-full ${item.dot}`} />
                  {item.text}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}

      {phase === "loading" && (
        <div
          role="status"
          className="flex min-h-80 flex-col items-center justify-center gap-6 text-center"
        >
          <LoaderCircleIcon className="size-12 animate-spin text-primary" />
          <div className="space-y-2">
            <p className="text-2xl font-black text-foreground">
              Analyzing the DM...
            </p>
            <p className="text-sm text-muted-foreground">
              This usually takes a few seconds.
            </p>
          </div>
        </div>
      )}

      {phase === "error" && (
        <ErrorState
          title="Extraction failed"
          description={error ?? "Something went wrong during extraction."}
          onRetry={handleExtract}
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
        <section className="space-y-6 rounded-[2rem] border bg-card p-6 shadow-2xl backdrop-blur-3xl md:p-10">
          {draft.fallback && (
            <p
              role="alert"
              className="rounded-2xl border border-warning/30 bg-warning/5 p-4 text-sm font-medium text-foreground"
            >
              The AI could not read every term from this DM. Check the flagged
              fields and fill in the rest.
            </p>
          )}
          {saveError && (
            <p
              role="alert"
              className="rounded-2xl bg-destructive/10 p-4 text-sm font-medium text-destructive"
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
        <section className="space-y-6 rounded-[2rem] border bg-card p-6 md:p-10">
          <div className="flex items-start gap-4">
            <CheckCircle2Icon className="size-8 shrink-0 text-status-fully-paid" />
            <div className="space-y-1">
              <p className="text-xl font-black text-foreground">
                {saved.version === 1
                  ? "Commission created"
                  : `Version ${saved.version} saved`}
              </p>
              <p className="text-sm text-muted-foreground">
                {saved.agreement.title} · version {saved.version} ·{" "}
                <span className="font-mono">
                  {saved.contentHash.slice(0, 12)}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {
                  saved.agreement.ambiguities.filter(
                    (a) => a.severity === "blocker",
                  ).length
                }{" "}
                blockers left to resolve before sending.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={() => setPhase("paste")}>
              <MessageSquarePlusIcon data-icon="inline-start" />
              Paste a follow-up DM
            </Button>
            <Button
              size="lg"
              variant="outline"
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
