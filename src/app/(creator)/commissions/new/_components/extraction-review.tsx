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
import { type Agreement } from "@/lib/schema/agreement";

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

  const handleExtract = async () => {
    if (!inputText.trim()) return;
    setPhase("loading");
    setError(null);
    setShowCounteroffers(false);

    try {
      const result = await extractAgreement(inputText);
      if (result.ok) {
        setAgreement(result.data);
        setPhase("result");

        const newSnapshot: VersionSnapshot = {
          id: Math.random().toString(36).substring(7),
          version: 1,
          createdAtLabel: "Just now",
          contentHash: "h1",
          source: "extracted",
          agreement: result.data,
        };
        setHistory([newSnapshot]);
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
        <Card className="group relative overflow-hidden rounded-[3rem] border-2 border-white bg-white shadow-2xl transition-all duration-500 hover:shadow-indigo-100/40">
          <CardContent className="p-0">
            <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-indigo-50/50 blur-3xl transition-all group-hover:bg-indigo-100/50" />
            <div className="relative z-10 p-8 md:p-12">
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 shadow-sm">
                    <MessageSquareQuoteIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#1E2F50]">
                      Client Request
                    </h3>
                    <p className="text-sm font-medium text-slate-400">
                      Paste the DM from your client to begin extraction.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    className="min-h-[300px] w-full resize-none rounded-[2.5rem] border-2 border-slate-100 bg-slate-50/30 p-8 text-lg font-medium text-[#1E2F50] shadow-inner transition-all placeholder:text-slate-300 focus:border-indigo-200 focus:bg-white focus:ring-0 focus:outline-none"
                    placeholder="e.g., 'Hey! I saw your portfolio and I'd love to commission a 5-minute MV edit. My budget is $150 and I need it by next Friday...'"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  <div className="absolute right-6 bottom-6 flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-300 uppercase">
                    <ZapIcon className="h-3 w-3 fill-slate-300" />
                    AI Ready
                  </div>
                </div>

                <Button
                  size="lg"
                  className="group h-20 w-full rounded-full bg-[#1E2F50] text-xl font-black text-white shadow-2xl shadow-indigo-200/50 transition-all hover:bg-indigo-900 active:scale-[0.98]"
                  onClick={handleExtract}
                  disabled={!inputText.trim()}
                >
                  Analyze Agreement
                  <ArrowRightIcon className="ml-2 h-6 w-6 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {phase === "loading" && (
        <Card className="flex min-h-[500px] flex-col items-center justify-center rounded-[3rem] border-2 border-white bg-white p-12 text-center shadow-2xl">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-indigo-100 opacity-20" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-indigo-50 bg-white shadow-xl">
              <LoaderCircleIcon className="h-12 w-12 animate-spin text-indigo-600" />
            </div>
            <HeartIcon className="absolute -top-2 -right-2 h-8 w-8 animate-bounce fill-pink-500 text-pink-500" />
          </div>
          <h3 className="mt-10 text-3xl font-black text-[#1E2F50]">
            Analyzing your DM...
          </h3>
          <p className="mt-4 max-w-xs text-lg leading-relaxed font-medium text-slate-400">
            Our AI is identifying deliverables, deadlines, and pricing details.
          </p>
        </Card>
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
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
          {/* Main Analysis Results */}
          <div className="space-y-8">
            {/* Attention Flags */}
            {agreement.ambiguities.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-4">
                  <StarIcon className="h-5 w-5 fill-amber-500 text-amber-500" />
                  <span className="text-xs font-black tracking-[0.2em] text-[#1E2F50] uppercase">
                    Action Required
                  </span>
                </div>
                <div className="grid gap-4">
                  {agreement.ambiguities.map((amb, idx) => (
                    <div
                      key={idx}
                      className={flagVariants({
                        severity: amb.severity as "blocker" | "warning",
                      })}
                    >
                      <div className="flex items-start gap-5">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white shadow-sm",
                            amb.severity === "blocker"
                              ? "bg-red-100 text-red-600"
                              : "bg-amber-100 text-amber-600",
                          )}
                        >
                          <AlertTriangleIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <h4 className="text-sm font-black tracking-tight uppercase">
                            {amb.code.replace(/_/g, " ")}
                          </h4>
                          <p className="text-sm leading-relaxed font-bold opacity-90">
                            {amb.message}
                          </p>
                          {amb.source_quote && (
                            <div className="rounded-2xl border border-white/30 bg-white/50 p-4 text-[13px] font-medium italic">
                              &quot;{amb.source_quote}&quot;
                            </div>
                          )}
                          {amb.suggested_question && (
                            <p className="text-xs font-black text-indigo-600 italic">
                              💡 {amb.suggested_question}
                            </p>
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
              <div className="rounded-[3rem] border-2 border-white bg-indigo-50/30 p-8 shadow-xl">
                <div className="mb-8 px-4">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <ZapIcon className="h-5 w-5 fill-indigo-600" />
                    <span className="text-xs font-black tracking-widest uppercase">
                      AI Strategy
                    </span>
                  </div>
                  <h3 className="mt-2 text-2xl font-black text-[#1E2F50]">
                    Bridge the Gap
                  </h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">
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
            <Card className="overflow-hidden rounded-[3rem] border-2 border-white bg-white shadow-2xl">
              <div className="bg-[#1E2F50] p-8 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 animate-pulse rounded-full bg-cyan-400" />
                    <span className="text-xs font-black tracking-[0.2em] uppercase">
                      Agreement Draft
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase opacity-40">
                    v{history[0]?.version}
                  </span>
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight">
                  {agreement.title}
                </h2>
              </div>
              <CardContent className="p-8 md:p-12">
                <div className="grid gap-8 md:grid-cols-2">
                  {[
                    {
                      label: "Service Type",
                      value: agreement.service_type.replace(/_/g, " "),
                      icon: ZapIcon,
                    },
                    {
                      label: "Deadline",
                      value: agreement.deadline.date || "Not set",
                      icon: StarIcon,
                    },
                    {
                      label: "Revisions",
                      value: `${agreement.revisions.included ?? "0"} included`,
                      icon: RefreshCwIcon,
                    },
                    {
                      label: "Commercial Rights",
                      value: agreement.usage_rights?.commercial
                        ? "Yes"
                        : "No/Unclear",
                      icon: ShieldCheckIcon,
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="group rounded-[2rem] border-2 border-slate-50 bg-slate-50/20 p-6 transition-all hover:border-indigo-100 hover:bg-white hover:shadow-xl hover:shadow-indigo-50/50"
                    >
                      <div className="flex items-center gap-3 text-slate-400 transition-colors group-hover:text-indigo-500">
                        <item.icon className="h-4 w-4" />
                        <span className="text-[10px] font-black tracking-[0.2em] uppercase">
                          {item.label}
                        </span>
                      </div>
                      <p className="mt-2 text-lg font-black text-[#1E2F50]">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-10 space-y-4">
                  <h4 className="px-2 text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">
                    Deliverables
                  </h4>
                  <div className="space-y-3">
                    {agreement.deliverables.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-[10px] font-black text-indigo-600">
                          {d.id.toUpperCase()}
                        </div>
                        <p className="text-sm font-bold text-[#1E2F50]">
                          {d.description}
                        </p>
                        <span className="ml-auto text-xs font-black text-slate-300">
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
          <div className="space-y-6">
            <Card className="sticky top-24 rounded-[2.5rem] border-2 border-white bg-white p-8 shadow-2xl">
              <div className="space-y-8">
                <div>
                  <h3 className="text-xs font-black tracking-[0.2em] text-slate-400 uppercase">
                    Total Investment
                  </h3>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-4xl font-black text-[#1E2F50]">
                      {agreement.price.currency} {agreement.price.total}
                    </span>
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-indigo-100/50 bg-indigo-50/50 p-4">
                      <span className="text-xs font-bold text-slate-500">
                        Deposit ({agreement.deposit.percent}%)
                      </span>
                      <span className="text-sm font-black text-indigo-600">
                        {agreement.price.currency} {agreement.deposit.amount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <span className="text-xs font-bold text-slate-500">
                        Final Payment
                      </span>
                      <span className="text-sm font-black text-[#1E2F50]">
                        {agreement.price.currency} {agreement.balance_amount}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Button className="h-16 w-full rounded-full bg-indigo-600 font-black text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.98]">
                    Send to Client
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-14 w-full rounded-full font-bold text-slate-400 hover:text-[#1E2F50]"
                    onClick={() => setPhase("idle")}
                  >
                    <RefreshCwIcon className="mr-2 h-4 w-4" />
                    Redo Extraction
                  </Button>
                </div>

                {agreement.ambiguities.some(
                  (a) => a.field === "/price/total",
                ) &&
                  !showCounteroffers && (
                    <div className="rounded-3xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-6 text-center">
                      <p className="text-xs font-bold text-amber-800">
                        Rate Mismatch Detected
                      </p>
                      <Button
                        variant="link"
                        className="mt-1 h-auto p-0 text-xs font-black text-amber-600 uppercase underline-offset-4"
                        onClick={() => setShowCounteroffers(true)}
                      >
                        View AI Counteroffers
                      </Button>
                    </div>
                  )}
              </div>
            </Card>

            <Card className="rounded-[2.5rem] border-2 border-white bg-slate-900 p-8 text-white shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-cyan-400" />
                <span className="text-[10px] font-black tracking-[0.2em] uppercase opacity-60">
                  Sharing Info
                </span>
              </div>
              <p className="mt-4 text-xs leading-relaxed font-medium opacity-80">
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
