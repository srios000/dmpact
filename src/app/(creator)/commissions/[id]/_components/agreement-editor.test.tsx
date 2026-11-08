import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { blankAgreement } from "@/lib/ai/extract/review";
import {
  agreementEditMode,
  type AgreementEditMode,
} from "@/lib/state-machine/agreement-edits";
import type { CommissionState } from "@/lib/state-machine/rules";
import { AgreementEditor, type AgreementEditorProps } from "./agreement-editor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("../actions", () => ({
  retryBalanceInvoice: vi.fn(),
  retryDepositInvoice: vi.fn(),
  saveAgreementVersion: vi.fn(),
  sendToClient: vi.fn(),
  suggestCounteroffers: vi.fn(),
}));
vi.mock("../../new/actions", () => ({ extractAgreement: vi.fn() }));

function render(state: CommissionState) {
  const mode: AgreementEditMode = agreementEditMode(state);
  const commission = {
    id: "0190f1a2-0000-7000-8000-000000000001",
    state,
    sourceDm: "need a lyric video",
    clientToken: state === "draft" ? null : "a".repeat(22),
    inForceVersion: null,
    depositRetry: null,
    balanceRetry: null,
    versions: [
      {
        version: 1,
        agreement: blankAgreement("2026-11-08"),
        contentHash: "a".repeat(64),
        createdBy: "creator",
        createdAt: new Date("2026-11-08T03:00:00Z"),
        confirmations: [],
      },
    ],
  } as unknown as AgreementEditorProps["commission"];
  return renderToStaticMarkup(
    <AgreementEditor commission={commission} mode={mode} today="2026-11-08" />,
  );
}

describe("AgreementEditor follow-up entry point", () => {
  it.each(["draft", "negotiating"] as const)(
    "offers a follow-up DM while %s",
    (state) => {
      expect(render(state)).toContain("Add a follow-up DM");
    },
  );

  it.each([
    "agreed",
    "dp_paid",
    "in_progress",
    "delivered",
    "fully_paid",
    "cancelled",
  ] as const)("hides the follow-up DM once %s", (state) => {
    expect(render(state)).not.toContain("Add a follow-up DM");
  });
});
