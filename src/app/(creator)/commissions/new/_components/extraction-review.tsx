"use client";

import * as React from "react";
import { cva } from "class-variance-authority";
import {
  AlertTriangleIcon,
  LoaderCircleIcon,
  MessageSquareQuoteIcon,
  RefreshCwIcon,
  HeartIcon,
  ZapIcon,
  StarIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/molecules/error-state";
import {
  CounterofferEditor,
  type CounterofferOption,
} from "@/components/organisms/counteroffer-editor";
import { cn } from "@/lib/utils";
import { extractAgreement } from "../actions";
import { type Agreement, type Ambiguity } from "@/lib/schema/agreement";
import { type ExtractAgreementInput } from "@/lib/schema/commission-forms";

type Phase = "idle" | "loading" | "result" | "error" | "manual";

const DEMO_COUNTEROFFERS: CounterofferOption[] = [
  {
    id: "co-1",
    strategy: "fair",
    label: "Standard Rate",
    description:
      "Align with your base price for MV editing while keeping the requested scope.",
    suggestedMessage:
      "Thanks for reaching out! For a full MV edit, my standard rate starts at $150. Let me know if that works for you!",
    changes: [
      {
        field: "Total Price",
        oldValue: "120.00",
        newValue: "150.00",
        type: "increase",
      },
    ],
  },
  {
    id: "co-2",
    strategy: "protective",
    label: "Limited Scope",
    description:
      "Keep the $120 budget but reduce the number of revisions to protect your time.",
    suggestedMessage:
      "I can definitely do this for $120. To stay within that budget, I can include 1 round of revisions instead of 2. Would that be okay?",
    changes: [
      { field: "Revisions", oldValue: "2", newValue: "1", type: "decrease" },
    ],
  },
];

type VersionSnapshot = {
  id: string;
  version: number;
  createdAtLabel: string;
  contentHash: string;
  source: "extracted" | "manual" | "edited";
  agreement: Agreement;
};

const flagVariants = cva(
  "rounded-[2.5rem] border-2 border-white p-6 shadow-xl transition-all hover:scale-[1.01]",
  {
    variants: {
      severity: {
        blocker: "bg-red-50/90 text-red-900 border-red-200 shadow-red-100/50",
        warning:
          "bg-amber-50/90 text-amber-900 border-amber-200 shadow-amber-100/50",
      },
    },
  },
);

export function ExtractionReview() {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [inputText, setInputText] = React.useState("");
  const [agreement, setAgreement] = React.useState<Agreement | null>(null);
  const [showCounteroffers, setShowCounteroffers] = React.useState(false);
  const [history, setHistory] = React.useState<VersionSnapshot[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const handleExtract = async (existingCommissionId?: string) => {
    if (!inputText.trim()) return;
    setPhase("loading");
    setError(null);
    setShowCounteroffers(false);

    try {
      const input: ExtractAgreementInput = {
        dmText: inputText,
        commissionId: existingCommissionId,
      };
      const result = await extractAgreement(input);
      if (result.ok) {
        setAgreement(result.data.agreement);
        setPhase("result");

        const newSnapshot: VersionSnapshot = {
          id: Math.random().toString(36).substring(7),
          version: history.length + 1,
          createdAtLabel: "Just now",
          contentHash: "h" + (history.length + 1),
          source: "extracted",
          agreement: result.data.agreement,
        };
        setHistory([newSnapshot, ...history]);
      } else {
        setError(result.error.message);
        setPhase("error");
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "An unexpected error occurred.",
      );
      setPhase("error");
    }
  };

  const handleApplyCounteroffer = (option: CounterofferOption) => {
    if (!agreement) return;

    const newAgreement = structuredClone(agreement);
    option.changes.forEach((change) => {
      if (change.field === "Total Price")
        newAgreement.price.total = change.newValue;
      if (change.field === "Revisions")
        newAgreement.revisions.included = parseInt(change.newValue);
    });

    setAgreement(newAgreement);
    setShowCounteroffers(false);

    const newSnapshot: VersionSnapshot = {
      id: Math.random().toString(36).substring(7),
      version: history.length + 1,
      createdAtLabel: "Just now",
      contentHash: "h" + (history.length + 1),
      source: "edited",
      agreement: newAgreement,
    };
    setHistory([newSnapshot, ...history]);
  };

  const clientLink = agreement
    ? `https://dmpact.ai/a/${history[0]?.id || "active"}`
    : "";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-12 pb-20">
      {/* Premium Multi-layered Background for Input */}
      {phase === "idle" && (
        <div className="animate-in space-y-16 duration-1000 fade-in slide-in-from-top-4">
          <div className="relative text-center md:text-left">
            <h1 className="text-glow-white pointer-events-none absolute -top-12 left-0 font-heading text-[8rem] leading-none font-black tracking-tighter text-white/[0.03] select-none md:text-[12rem] lg:left-[-4rem]">
              RAW
            </h1>
            <div className="relative z-10 space-y-6">
              <h2 className="font-heading text-5xl font-black tracking-tight text-white md:text-7xl lg:text-8xl">
                Extract{" "}
                <span className="animate-gradient text-glow bg-gradient-to-r from-[#FF3B8E] via-[#9333EA] to-[#3B82F6] bg-[length:200%_auto] bg-clip-text text-transparent italic">
                  Agreement.
                </span>
              </h2>
              <p className="mx-auto max-w-xl text-lg leading-relaxed font-medium text-slate-300 sm:text-xl md:mx-0">
                Drop your raw client DMs here. Our AI engine strips away the
                noise and uncovers the core terms.
              </p>
            </div>
          </div>

          <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
            <div className="space-y-8">
              <div className="group relative">
                <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-[#FF3B8E] via-[#9333EA] to-[#3B82F6] opacity-20 blur-2xl transition duration-1000 group-focus-within:opacity-40" />
                <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0F1014]/40 shadow-2xl backdrop-blur-3xl transition-all duration-500 hover:border-white/20">
                  <div className="relative z-10 p-2">
                    <textarea
                      className="min-h-[400px] w-full resize-none rounded-[2rem] bg-transparent p-8 text-xl leading-relaxed font-medium text-white placeholder:text-slate-700 focus:ring-0 focus:outline-none"
                      placeholder="Paste the raw conversation here..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                    />
                    <div className="absolute right-8 bottom-8 flex items-center gap-3">
                      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-5 py-2.5 text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase backdrop-blur-md">
                        <ZapIcon className="size-3 fill-[#FF3B8E]/20 text-[#FF3B8E]" />
                        AI Engine:{" "}
                        <span className="text-emerald-400">Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <Button
                  size="lg"
                  className="group relative h-20 flex-1 overflow-hidden rounded-3xl bg-white text-lg font-black text-black shadow-2xl shadow-white/5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  onClick={() => handleExtract()}
                  disabled={!inputText.trim()}
                >
                  <span className="relative z-10 flex items-center gap-3">
                    ANALYZE REQUEST
                    <ArrowRightIcon className="size-5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-20 w-full rounded-3xl border-2 border-white/10 bg-transparent px-12 text-lg font-black text-white transition-all hover:bg-white/5 sm:w-auto"
                  onClick={() => setPhase("manual")}
                >
                  MANUAL
                </Button>
              </div>
            </div>

            <div className="hidden space-y-8 lg:block">
              <div className="rounded-[2.5rem] border border-white/5 bg-white/[0.03] p-8 backdrop-blur-md">
                <h4 className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">
                  Guidelines
                </h4>
                <ul className="mt-8 space-y-6">
                  {[
                    { text: "Paste full conversation", color: "bg-[#FF3B8E]" },
                    { text: "Include pricing mentions", color: "bg-blue-400" },
                    { text: "Include deadlines", color: "bg-emerald-400" },
                    { text: "AI handles slang & typos", color: "bg-amber-400" },
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-4 text-sm font-bold text-slate-300"
                    >
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full shadow-lg",
                          item.color,
                        )}
                      />
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[2.5rem] border border-dashed border-white/5 p-8">
                <p className="text-xs leading-relaxed font-medium text-slate-500">
                  Your privacy is priority. Conversations are processed securely
                  and never stored for training.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === "loading" && (
        <div className="flex min-h-[500px] animate-in flex-col items-center justify-center space-y-12 duration-700 zoom-in-95 fade-in">
          <div className="relative">
            <div className="absolute -inset-8 animate-pulse rounded-full bg-[#FF3B8E]/20 blur-2xl" />
            <div className="relative flex size-32 items-center justify-center rounded-full border border-white/10 bg-[#0F1014]/60 shadow-2xl backdrop-blur-xl">
              <LoaderCircleIcon className="size-12 animate-spin text-[#FF3B8E]" />
            </div>
            <HeartIcon className="absolute -top-2 -right-2 size-8 animate-bounce fill-[#FF3B8E] text-[#FF3B8E] shadow-lg" />
          </div>
          <div className="space-y-4 text-center">
            <h3 className="animate-gradient text-glow bg-gradient-to-r from-[#FF3B8E] via-blue-400 to-[#FF3B8E] bg-[length:200%_auto] bg-clip-text text-4xl font-black text-transparent">
              Analyzing your DM...
            </h3>
            <p className="mx-auto max-w-xs text-lg leading-relaxed font-medium text-slate-500">
              Our AI engine is stripping away the noise to uncover the core
              agreement.
            </p>
          </div>
        </div>
      )}

      {phase === "manual" && (
        <div className="animate-in duration-700 fade-in slide-in-from-bottom-4">
          <Card className="rounded-[3rem] border border-white/5 bg-[#0F1014]/60 p-12 text-center shadow-2xl backdrop-blur-3xl">
            <div className="flex flex-col items-center gap-8">
              <div className="flex size-24 items-center justify-center rounded-3xl bg-white/5 text-slate-500">
                <MessageSquareQuoteIcon className="size-12" />
              </div>
              <div className="space-y-4">
                <h3 className="text-3xl font-black text-white">
                  Manual Entry Mode
                </h3>
                <p className="max-w-md text-lg font-medium text-slate-500">
                  Skip the AI extraction and fill in the agreement details
                  yourself.
                </p>
              </div>
              <Button
                className="h-16 rounded-full bg-white px-10 text-base font-black text-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => setPhase("idle")}
              >
                BACK TO EXTRACTION
              </Button>
            </div>
          </Card>
        </div>
      )}

      {phase === "error" && (
        <ErrorState
          title="Extraction Failed"
          message={error || "Something went wrong during extraction."}
          onRetry={() => setPhase("idle")}
          className="rounded-[3rem] border-2 border-white shadow-2xl"
        />
      )}

      {phase === "result" && agreement && (
        <div className="grid animate-in grid-cols-1 gap-8 duration-1000 fade-in slide-in-from-bottom-8 lg:grid-cols-[1fr_380px]">
          {/* Main Analysis Results */}
          <div className="space-y-12">
            {/* Attention Flags */}
            {agreement.ambiguities.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 px-4">
                  <StarIcon className="size-5 fill-amber-400 text-amber-400 shadow-lg" />
                  <span className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">
                    Action Required
                  </span>
                </div>
                <div className="grid gap-6">
                  {agreement.ambiguities.map((amb, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-[2.5rem] border border-white/5 p-8 shadow-2xl backdrop-blur-md transition-all hover:scale-[1.01]",
                        amb.severity === "blocker"
                          ? "bg-red-500/5 shadow-red-500/5 hover:border-red-500/30"
                          : "bg-amber-500/5 shadow-amber-500/5 hover:border-amber-500/30",
                      )}
                    >
                      <div className="flex items-start gap-6">
                        <div
                          className={cn(
                            "flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 shadow-lg",
                            amb.severity === "blocker"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-amber-500/20 text-amber-400",
                          )}
                        >
                          <AlertTriangleIcon className="size-6" />
                        </div>
                        <div className="flex-1 space-y-4">
                          <h4 className="text-xs font-black tracking-[0.1em] uppercase opacity-60">
                            {amb.code.replace(/_/g, " ")}
                          </h4>
                          <p className="text-lg leading-relaxed font-bold text-white">
                            {amb.message}
                          </p>
                          {amb.source_quote && (
                            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 text-sm font-medium text-slate-400 italic">
                              &quot;{amb.source_quote}&quot;
                            </div>
                          )}
                          {amb.suggested_question && (
                            <div className="flex items-center gap-2 text-xs font-black text-blue-400 italic">
                              <ZapIcon className="size-3 fill-blue-400/20" />
                              💡 {amb.suggested_question}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Counteroffer Section */}
            {showCounteroffers && (
              <div className="animate-in rounded-[3rem] border border-white/5 bg-blue-500/5 p-10 shadow-2xl backdrop-blur-md duration-700 zoom-in-95">
                <div className="mb-10 px-4">
                  <div className="flex items-center gap-3 text-blue-400">
                    <ZapIcon className="size-6 fill-blue-400/20" />
                    <span className="text-[10px] font-black tracking-[0.2em] uppercase">
                      AI Strategy
                    </span>
                  </div>
                  <h3 className="mt-4 text-3xl font-black text-white">
                    Bridge the Gap
                  </h3>
                  <p className="mt-2 text-lg font-medium text-slate-500">
                    Select a counteroffer strategy to align with your rate card.
                  </p>
                </div>
                <CounterofferEditor
                  options={DEMO_COUNTEROFFERS}
                  onApply={handleApplyCounteroffer}
                  estimateRange="$150.00 - $220.00"
                  mismatchReason="The client's budget is below your standard rate for this service."
                />
              </div>
            )}

            {/* Agreement Preview Card */}
            <Card className="overflow-hidden rounded-[3rem] border border-white/5 bg-[#0F1014]/60 shadow-2xl backdrop-blur-3xl">
              <div className="bg-gradient-to-r from-[#FF3B8E] to-blue-600 p-10 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-3 animate-pulse rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
                    <span className="text-[10px] font-black tracking-[0.3em] uppercase opacity-80">
                      Agreement Draft
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase opacity-60">
                    v{history[0]?.version}
                  </span>
                </div>
                <h2 className="mt-6 text-4xl font-black tracking-tight">
                  {agreement.title}
                </h2>
              </div>
              <CardContent className="p-10 md:p-14">
                <div className="grid gap-8 md:grid-cols-2">
                  {[
                    {
                      label: "Service Type",
                      value: agreement.service_type.replace(/_/g, " "),
                      icon: ZapIcon,
                      color: "text-[#FF3B8E]",
                    },
                    {
                      label: "Deadline",
                      value: agreement.deadline.date || "Not set",
                      icon: StarIcon,
                      color: "text-blue-400",
                    },
                    {
                      label: "Revisions",
                      value: `${agreement.revisions.included ?? "0"} included`,
                      icon: RefreshCwIcon,
                      color: "text-emerald-400",
                    },
                    {
                      label: "Commercial Rights",
                      value: agreement.usage_rights?.commercial
                        ? "Yes"
                        : "No/Unclear",
                      icon: ShieldCheckIcon,
                      color: "text-amber-400",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="group rounded-[2.5rem] border border-white/5 bg-white/[0.02] p-8 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:shadow-xl"
                    >
                      <div
                        className={cn(
                          "flex items-center gap-3 opacity-40 transition-opacity group-hover:opacity-100",
                          item.color,
                        )}
                      >
                        <item.icon className="size-4" />
                        <span className="text-[10px] font-black tracking-[0.2em] uppercase">
                          {item.label}
                        </span>
                      </div>
                      <p className="mt-4 text-xl font-black text-white">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-14 space-y-6">
                  <h4 className="px-2 text-[10px] font-black tracking-[0.3em] text-slate-500 uppercase">
                    Deliverables
                  </h4>
                  <div className="space-y-4">
                    {agreement.deliverables.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-6 rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 transition-all hover:bg-white/[0.04]"
                      >
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#FF3B8E]/10 text-[10px] font-black text-[#FF3B8E] shadow-lg shadow-[#FF3B8E]/5">
                          {d.id.toUpperCase()}
                        </div>
                        <p className="text-lg font-bold text-white">
                          {d.description}
                        </p>
                        <span className="ml-auto text-xs font-black text-slate-600">
                          x{d.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sticky Sidebar Actions */}
          <div className="space-y-8">
            <Card className="sticky top-24 rounded-[3rem] border border-white/5 bg-[#0F1014]/60 p-10 shadow-2xl backdrop-blur-3xl">
              <div className="space-y-10">
                <div>
                  <h3 className="text-[10px] font-black tracking-[0.3em] text-slate-500 uppercase">
                    Total Investment
                  </h3>
                  <div className="mt-6 flex items-baseline gap-3">
                    <span className="text-5xl font-black text-white">
                      {agreement.price.currency} {agreement.price.total}
                    </span>
                  </div>

                  <div className="mt-10 space-y-4">
                    <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                      <span className="text-xs font-bold text-slate-500">
                        Deposit ({agreement.deposit.percent}%)
                      </span>
                      <span className="text-base font-black text-[#FF3B8E]">
                        {agreement.price.currency} {agreement.deposit.amount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                      <span className="text-xs font-bold text-slate-500">
                        Final Payment
                      </span>
                      <span className="text-base font-black text-white">
                        {agreement.price.currency} {agreement.balance_amount}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Button
                    className="h-20 w-full rounded-full bg-white text-lg font-black text-black shadow-2xl shadow-white/5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    onClick={() => setPhase("idle")}
                  >
                    ADD FOLLOW-UP DM
                  </Button>
                  <Button className="h-20 w-full rounded-full bg-gradient-to-r from-[#FF3B8E] to-[#D42A75] text-lg font-black text-white shadow-2xl shadow-[#FF3B8E]/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                    SEND TO CLIENT
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-16 w-full rounded-full text-sm font-bold text-slate-500 hover:bg-white/5 hover:text-white"
                    onClick={() => setPhase("idle")}
                  >
                    <RefreshCwIcon className="mr-3 size-4" />
                    REDO EXTRACTION
                  </Button>
                </div>

                {agreement.ambiguities.some(
                  (a) => a.field === "/price/total",
                ) &&
                  !showCounteroffers && (
                    <div className="animate-in rounded-[2rem] border border-dashed border-amber-500/30 bg-amber-500/5 p-8 text-center zoom-in-95">
                      <p className="text-xs font-bold text-amber-500/80">
                        Rate Mismatch Detected
                      </p>
                      <Button
                        variant="link"
                        className="mt-2 h-auto p-0 text-xs font-black tracking-widest text-amber-400 uppercase underline-offset-4 hover:text-amber-300"
                        onClick={() => setShowCounteroffers(true)}
                      >
                        VIEW AI STRATEGIES
                      </Button>
                    </div>
                  )}
              </div>
            </Card>

            <Card className="rounded-[3rem] border border-white/5 bg-[#0F1014]/60 p-10 text-white shadow-2xl backdrop-blur-3xl">
              <div className="flex items-center gap-3">
                <div className="size-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
                <span className="text-[10px] font-black tracking-[0.2em] uppercase opacity-60">
                  Sharing Info
                </span>
              </div>
              <p className="mt-6 text-sm leading-relaxed font-medium text-slate-400">
                Agreement will be sent to the client&apos;s email via PayPal
                Invoicing upon confirmation.
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
