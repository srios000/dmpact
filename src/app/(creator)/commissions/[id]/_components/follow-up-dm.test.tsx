import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  readDm,
  UNREACHABLE_MESSAGE,
  type ExtractDm,
} from "@/components/organisms/dm-extraction";
import { blankAgreement } from "@/lib/ai/extract/review";
import { FollowUpDm, saveFollowUp, type SaveFollowUp } from "./follow-up-dm";

const commissionId = "0190f1a2-0000-7000-8000-000000000001";
const agreement = { ...blankAgreement("2026-11-08"), title: "Lyric video" };

function renderFollowUp(props: { open: boolean; disabled?: boolean }) {
  return renderToStaticMarkup(
    <FollowUpDm
      commissionId={commissionId}
      latestVersion={2}
      latestAgreement={agreement}
      today="2026-11-08"
      extract={vi.fn()}
      save={vi.fn()}
      onOpenChange={vi.fn()}
      onSaved={vi.fn()}
      {...props}
    />,
  );
}

describe("readDm", () => {
  it("sends the follow-up with the commission id and returns the draft", async () => {
    const extract = vi.fn<ExtractDm>().mockResolvedValue({
      ok: true,
      data: { agreement, attempts: 1, fallback: false },
    });

    const outcome = await readDm(extract, {
      dmText: "can we move it to friday?",
      commissionId,
    });

    expect(extract).toHaveBeenCalledWith({
      dmText: "can we move it to friday?",
      commissionId,
    });
    expect(outcome).toEqual({ ok: true, agreement, fallback: false });
  });

  it("passes the action's error message through", async () => {
    const extract = vi.fn<ExtractDm>().mockResolvedValue({
      ok: false,
      error: { code: "extraction_failed", message: "Extraction failed." },
    });

    await expect(
      readDm(extract, { dmText: "hi", commissionId }),
    ).resolves.toEqual({ ok: false, message: "Extraction failed." });
  });

  it("reports an unreachable server when the action throws", async () => {
    const extract = vi.fn<ExtractDm>().mockRejectedValue(new Error("offline"));

    await expect(
      readDm(extract, { dmText: "hi", commissionId }),
    ).resolves.toEqual({ ok: false, message: UNREACHABLE_MESSAGE });
  });
});

describe("saveFollowUp", () => {
  it("saves a new version with the follow-up DM attached", async () => {
    const save = vi.fn<SaveFollowUp>().mockResolvedValue({
      ok: true,
      data: { version: 3, contentHash: "a".repeat(64) },
    });

    const result = await saveFollowUp(save, {
      commissionId,
      agreement,
      dmText: "  can we move it to friday?  ",
    });

    expect(save).toHaveBeenCalledWith({
      commissionId,
      agreement,
      followUpDm: "can we move it to friday?",
    });
    expect(result).toEqual({
      ok: true,
      data: { version: 3, contentHash: "a".repeat(64) },
    });
  });

  it("leaves followUpDm out when filled in by hand without a DM", async () => {
    const save = vi.fn<SaveFollowUp>().mockResolvedValue({
      ok: true,
      data: { version: 3, contentHash: "a".repeat(64) },
    });

    await saveFollowUp(save, { commissionId, agreement, dmText: "   " });

    expect(save).toHaveBeenCalledWith({
      commissionId,
      agreement,
      followUpDm: undefined,
    });
  });
});

describe("FollowUpDm", () => {
  it("offers the follow-up flow and names the next version", () => {
    const html = renderFollowUp({ open: false });

    expect(html).toContain("Add a follow-up DM");
    expect(html).toContain("version 3");
    expect(html).not.toContain("<textarea");
  });

  it("blocks the flow while the agreement has unsaved edits", () => {
    const html = renderFollowUp({ open: false, disabled: true });

    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*Add a follow-up DM/);
    expect(html).toContain("Save or discard your agreement changes first.");
  });

  it("shows the paste step when opened", () => {
    const html = renderFollowUp({ open: true });

    expect(html).toContain('aria-label="Follow-up DM"');
    expect(html).toContain("Read follow-up");
    expect(html).toContain("Fill in by hand");
    expect(html).toContain("Cancel");
  });
});
