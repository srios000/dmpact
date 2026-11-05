import * as React from "react";
import {
  CheckIcon,
  CopyIcon,
  MinusIcon,
  PlusIcon,
  HeartIcon,
  StarIcon,
  ShieldCheckIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CounterofferStrategy = "fair" | "upsell" | "protective";

export interface CounterofferOption {
  id: string;
  strategy: CounterofferStrategy;
  label: string;
  description: string;
  suggestedMessage: string;
  changes: Array<{
    field: string;
    oldValue: string;
    newValue: string;
    type: "increase" | "decrease" | "change";
  }>;
}

export interface CounterofferEditorProps extends React.HTMLAttributes<HTMLDivElement> {
  options: CounterofferOption[];
  onApply: (option: CounterofferOption) => void;
  mismatchReason?: string;
  estimateRange?: string;
}

const STRATEGY_STYLE: Record<
  CounterofferStrategy,
  { icon: LucideIcon; tone: string; bg: string; border: string; text: string }
> = {
  fair: {
    icon: HeartIcon,
    tone: "primary",
    bg: "bg-pink-50",
    border: "border-pink-100",
    text: "text-pink-600",
  },
  upsell: {
    icon: StarIcon,
    tone: "success",
    bg: "bg-cyan-50",
    border: "border-cyan-100",
    text: "text-cyan-600",
  },
  protective: {
    icon: ShieldCheckIcon,
    tone: "warning",
    bg: "bg-amber-50",
    border: "border-amber-100",
    text: "text-amber-600",
  },
};

function CounterofferEditor({
  className,
  options,
  onApply,
  mismatchReason,
  estimateRange,
  ...props
}: CounterofferEditorProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(
    options[0]?.id ?? null,
  );

  const selectedOption = React.useMemo(
    () => options.find((o) => o.id === selectedId) ?? null,
    [options, selectedId],
  );

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      {mismatchReason && (
        <Card className="rounded-[2rem] border-2 border-amber-100 bg-amber-50/50 shadow-none">
          <CardContent className="flex items-start gap-4 p-6">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white bg-white text-amber-600 shadow-sm">
              <ZapIcon className="size-5 fill-amber-600" />
            </div>
            <div className="space-y-1">
              <p className="text-[14px] font-black tracking-tight text-amber-900 uppercase">
                AI Budget Check: {estimateRange}
              </p>
              <p className="text-[13px] leading-relaxed font-medium text-amber-800/80">
                {mismatchReason}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid gap-4 lg:col-span-5">
          <p className="px-2 text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">
            Strategy
          </p>
          {options.map((option) => {
            const style = STRATEGY_STYLE[option.strategy];
            const isActive = selectedId === option.id;
            const Icon = style.icon;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedId(option.id)}
                className={cn(
                  "relative flex flex-col items-start gap-4 rounded-[2rem] border-2 p-5 text-left transition-all",
                  isActive
                    ? "border-pink-200 bg-white shadow-xl shadow-pink-100/50"
                    : "border-transparent bg-slate-50/50 hover:bg-slate-100/50",
                )}
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-2xl border border-white shadow-sm",
                      style.bg,
                      style.text,
                    )}
                  >
                    <Icon
                      className={cn("size-5", isActive && "fill-current")}
                    />
                  </div>
                  {isActive && (
                    <div className="flex size-6 items-center justify-center rounded-full bg-pink-500 text-white shadow-lg shadow-pink-200">
                      <CheckIcon className="size-3.5" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-black text-[#1E2F50]">
                    {option.label}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed font-medium text-slate-500">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 lg:col-span-7">
          {selectedOption ? (
            <CounterofferDetailView
              key={selectedOption.id}
              option={selectedOption}
              onApply={onApply}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-slate-50/20 p-12 text-center">
              <p className="text-sm font-bold text-slate-400">
                Select a strategy to preview
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CounterofferDetailView({
  option,
  onApply,
}: {
  option: CounterofferOption;
  onApply: (option: CounterofferOption) => void;
}) {
  const [editingMessage, setEditingMessage] = React.useState(
    option.suggestedMessage,
  );
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(editingMessage);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="h-full rounded-[2.5rem] border-2 border-white bg-white shadow-2xl">
      <CardHeader className="p-8 pb-2">
        <CardTitle className="text-xs font-black tracking-[0.2em] text-slate-400 uppercase">
          Proposed Terms
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 p-8 pt-4">
        <div className="grid gap-3">
          {option.changes.map((change, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 rounded-2xl border-2 border-slate-50 bg-slate-50/30 p-4 transition-colors hover:border-pink-50"
            >
              <div>
                <p className="text-[10px] font-black tracking-[0.14em] text-slate-400 uppercase">
                  {change.field}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[13px] font-medium text-slate-300 line-through">
                    {change.oldValue}
                  </span>
                  <span className="text-[13px] font-black text-[#1E2F50]">
                    {change.newValue}
                  </span>
                </div>
              </div>
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-xl border border-white shadow-sm",
                  change.type === "increase"
                    ? "bg-cyan-50 text-cyan-600"
                    : change.type === "decrease"
                      ? "bg-pink-50 text-pink-600"
                      : "bg-slate-50 text-slate-600",
                )}
              >
                {change.type === "increase" ? (
                  <PlusIcon className="size-4" />
                ) : change.type === "decrease" ? (
                  <MinusIcon className="size-4" />
                ) : (
                  <ZapIcon className="size-4" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">
              Message Preview
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 gap-2 rounded-full px-3 text-[11px] font-black text-pink-500 uppercase hover:bg-pink-50 hover:text-pink-600"
            >
              <CopyIcon className="size-3" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <textarea
            value={editingMessage}
            onChange={(e) => setEditingMessage(e.target.value)}
            className="min-h-32 w-full rounded-[2rem] border-2 border-slate-50 bg-slate-50/30 p-5 text-[13px] leading-relaxed font-medium text-[#1E2F50] transition-all outline-none focus:border-pink-100 focus:bg-white"
          />
        </div>

        <Button
          onClick={() => onApply(option)}
          className="h-14 w-full rounded-full bg-[#1E2F50] font-black text-white shadow-xl transition-all hover:bg-[#2a3f6a] active:scale-[0.98]"
        >
          Apply to Draft
        </Button>
      </CardContent>
    </Card>
  );
}

export { CounterofferEditor };
