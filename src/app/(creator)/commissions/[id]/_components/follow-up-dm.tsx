"use client";

import * as React from "react";
import { MessageSquarePlusIcon } from "lucide-react";
import {
  DmPasteStep,
  DmReadError,
  DmReadingStatus,
  DmReviewStep,
  useDmExtraction,
  type ExtractDm,
} from "@/components/organisms/dm-extraction";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/repositories/action-result";
import type { Agreement } from "@/lib/schema/agreement";
import type { SaveAgreementVersionInput } from "@/lib/schema/commission-forms";

export type SaveFollowUp = (
  input: SaveAgreementVersionInput,
) => Promise<ActionResult<{ version: number; contentHash: string }>>;

export function saveFollowUp(
  save: SaveFollowUp,
  input: { commissionId: string; agreement: Agreement; dmText: string },
) {
  return save({
    commissionId: input.commissionId,
    agreement: input.agreement,
    followUpDm: input.dmText.trim() || undefined,
  });
}

export interface FollowUpDmProps {
  commissionId: string;
  latestVersion: number;
  latestAgreement: Agreement;
  today: string;
  open: boolean;
  disabled?: boolean;
  extract: ExtractDm;
  save: SaveFollowUp;
  onOpenChange: (open: boolean) => void;
  onSaved: (version: number) => void;
}

function FollowUpDm({
  commissionId,
  latestVersion,
  latestAgreement,
  today,
  open,
  disabled,
  extract,
  save,
  onOpenChange,
  onSaved,
}: FollowUpDmProps) {
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saving, startSaving] = React.useTransition();
  const dm = useDmExtraction({
    extract,
    commissionId,
    manualStart: () => latestAgreement,
  });

  function close() {
    dm.reset();
    setSaveError(null);
    onOpenChange(false);
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
      const result = await saveFollowUp(save, {
        commissionId,
        agreement,
        dmText: draft.dmText,
      });
      if (!result.ok) return setSaveError(result.error.message);
      close();
      onSaved(result.data.version);
    });
  }

  if (!open) {
    return (
      <section className="space-y-4 rounded-xl border bg-card p-5 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-medium text-foreground">Follow-up DM</h2>
            <p className="text-sm text-muted-foreground">
              Client sent more details? Paste their next message and save the
              changes as version {latestVersion + 1}.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => onOpenChange(true)}
          >
            <MessageSquarePlusIcon />
            Add a follow-up DM
          </Button>
        </div>
        {disabled && (
          <p className="text-xs text-muted-foreground">
            Save or discard your agreement changes first.
          </p>
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby="follow-up-heading" className="space-y-6">
      <div className="max-w-2xl space-y-1">
        <h2
          id="follow-up-heading"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          {dm.phase === "review" ? "Check the follow-up" : "Add a follow-up DM"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {dm.phase === "review"
            ? "Fix anything the AI got wrong, then save it as a new version."
            : `Paste what the client sent next. It's saved as version ${latestVersion + 1}.`}
        </p>
      </div>

      {dm.phase === "paste" && (
        <DmPasteStep
          followUp
          value={dm.dmText}
          onChange={dm.setDmText}
          onRead={handleRead}
          onManual={handleManual}
          onCancel={close}
        />
      )}

      {dm.phase === "loading" && <DmReadingStatus />}

      {dm.phase === "error" && (
        <DmReadError
          message={dm.error}
          onRetry={handleRead}
          onManual={handleManual}
          onEdit={() => dm.setPhase("paste")}
        />
      )}

      {dm.phase === "review" && dm.draft && (
        <DmReviewStep
          draft={dm.draft}
          pasteDate={today}
          pending={saving}
          saveError={saveError}
          submitLabel={`Save as version ${latestVersion + 1}`}
          onSubmit={handleSave}
          secondaryAction={
            <Button type="button" size="lg" variant="ghost" onClick={close}>
              Cancel
            </Button>
          }
        />
      )}
    </section>
  );
}

export { FollowUpDm };
