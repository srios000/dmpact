"use client";

import * as React from "react";
import Link from "next/link";
import {
  DmPasteStep,
  DmReadError,
  DmReadingStatus,
  DmReviewStep,
  useDmExtraction,
} from "@/components/organisms/dm-extraction";
import { Button } from "@/components/ui/button";
import { blankAgreement } from "@/lib/ai/extract/review";
import type { Agreement } from "@/lib/schema/agreement";
import { saveAgreementVersion } from "../../[id]/actions";
import { createCommission, extractAgreement } from "../actions";

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
  const [saved, setSaved] = React.useState<Saved | null>(null);
  const [showSaved, setShowSaved] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saving, startSaving] = React.useTransition();
  const [pasteDate] = React.useState(todayInJakarta);
  const dm = useDmExtraction({
    extract: extractAgreement,
    commissionId: saved?.commissionId,
    manualStart: () => saved?.agreement ?? blankAgreement(pasteDate),
  });

  const isFollowUp = saved !== null;
  const phase = showSaved ? "saved" : dm.phase;

  function openSaved() {
    dm.reset();
    setShowSaved(true);
  }

  function startFollowUp() {
    dm.reset();
    setShowSaved(false);
  }

  function handleRead() {
    setSaveError(null);
    void dm.read();
  }

  function handleManual() {
    setSaveError(null);
    dm.manual();
  }

  function handleSave(agreement: Agreement) {
    const draft = dm.draft;
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
      openSaved();
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
        <DmPasteStep
          followUp={isFollowUp}
          value={dm.dmText}
          onChange={dm.setDmText}
          onRead={handleRead}
          onManual={handleManual}
          onCancel={isFollowUp ? openSaved : undefined}
        />
      )}

      {phase === "loading" && <DmReadingStatus />}

      {phase === "error" && (
        <DmReadError
          message={dm.error}
          onRetry={handleRead}
          onManual={handleManual}
          onEdit={() => dm.setPhase("paste")}
        />
      )}

      {phase === "review" && dm.draft && (
        <DmReviewStep
          draft={dm.draft}
          pasteDate={pasteDate}
          pending={saving}
          saveError={saveError}
          submitLabel={
            saved ? `Save as version ${saved.version + 1}` : "Create commission"
          }
          onSubmit={handleSave}
          secondaryAction={
            <Button
              type="button"
              size="lg"
              variant="ghost"
              onClick={() => (saved ? openSaved() : dm.setPhase("paste"))}
            >
              {saved ? "Cancel" : "Back to the DM"}
            </Button>
          }
        />
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
            <Button size="lg" variant="outline" onClick={startFollowUp}>
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
