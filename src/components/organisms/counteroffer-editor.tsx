import * as React from "react"
import {
  CheckIcon,
  CopyIcon,
  MinusIcon,
  PlusIcon,
  SparklesIcon,
  WandSparklesIcon,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type CounterofferStrategy = "fair" | "upsell" | "protective"

export interface CounterofferOption {
  id: string
  strategy: CounterofferStrategy
  label: string
  description: string
  suggestedMessage: string
  changes: Array<{
    field: string
    oldValue: string
    newValue: string
    type: "increase" | "decrease" | "change"
  }>
}

export interface CounterofferEditorProps extends React.HTMLAttributes<HTMLDivElement> {
  options: CounterofferOption[]
  onApply: (option: CounterofferOption) => void
  mismatchReason?: string
  estimateRange?: string
}

const STRATEGY_STYLE: Record<
  CounterofferStrategy,
  { icon: LucideIcon; tone: string; bg: string; border: string; text: string }
> = {
  fair: {
    icon: SparklesIcon,
    tone: "primary",
    bg: "bg-blue-50",
    border: "border-blue-100",
    text: "text-blue-700",
  },
  upsell: {
    icon: WandSparklesIcon,
    tone: "success",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    text: "text-emerald-700",
  },
  protective: {
    icon: PlusIcon,
    tone: "warning",
    bg: "bg-amber-50",
    border: "border-amber-100",
    text: "text-amber-700",
  },
}

function CounterofferEditor({
  className,
  options,
  onApply,
  mismatchReason,
  estimateRange,
  ...props
}: CounterofferEditorProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(options[0]?.id ?? null)

  const selectedOption = React.useMemo(
    () => options.find((o) => o.id === selectedId) ?? null,
    [options, selectedId]
  )

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      {mismatchReason && (
        <Card className="border-2 border-amber-100 bg-amber-50/50 shadow-none">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <SparklesIcon className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-[14px] font-black text-amber-900">
                AI Budget Check: {estimateRange}
              </p>
              <p className="text-[13px] font-medium leading-relaxed text-amber-800/80">
                {mismatchReason}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid gap-4 lg:col-span-5">
          <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase px-1">
            Choose Strategy
          </p>
          {options.map((option) => {
            const style = STRATEGY_STYLE[option.strategy]
            const isActive = selectedId === option.id
            const Icon = style.icon

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedId(option.id)}
                className={cn(
                  "relative flex flex-col items-start gap-3 rounded-[32px] border-2 p-5 text-left transition-all",
                  isActive
                    ? "border-primary bg-card shadow-xl shadow-primary/5"
                    : "border-transparent bg-muted/40 hover:bg-muted/60"
                )}
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <div className={cn("flex size-9 items-center justify-center rounded-xl border", style.bg, style.border, style.text)}>
                    <Icon className="size-4.5" />
                  </div>
                  {isActive && (
                    <div className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <CheckIcon className="size-3.5" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[14px] font-black text-foreground">{option.label}</p>
                  <p className="mt-1 text-[12px] font-medium leading-relaxed text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </button>
            )
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
            <div className="flex h-full items-center justify-center rounded-[32px] border-2 border-dashed border-border bg-muted/20 p-12 text-center">
              <p className="text-[13px] font-medium text-muted-foreground">
                Select an option to preview changes
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CounterofferDetailView({
  option,
  onApply,
}: {
  option: CounterofferOption
  onApply: (option: CounterofferOption) => void
}) {
  const [editingMessage, setEditingMessage] = React.useState(option.suggestedMessage)
  const [copied, setCopied] = React.useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(editingMessage)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)] h-full">
      <CardHeader className="p-6 pb-2 md:p-8 md:pb-2">
        <CardTitle className="text-[15px] font-black tracking-tight text-foreground uppercase">
          Proposed Changes
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 p-6 pt-4 md:p-8 md:pt-4">
        <div className="grid gap-3">
          {option.changes.map((change, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4"
            >
              <div>
                <p className="text-[10px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                  {change.field}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[13px] font-medium text-muted-foreground line-through opacity-50">
                    {change.oldValue}
                  </span>
                  <span className="text-[13px] font-black text-foreground">
                    {change.newValue}
                  </span>
                </div>
              </div>
              <div className={cn(
                "flex size-8 items-center justify-center rounded-lg",
                change.type === "increase" ? "bg-emerald-50 text-emerald-600" :
                change.type === "decrease" ? "bg-blue-50 text-blue-600" :
                "bg-slate-100 text-slate-600"
              )}>
                {change.type === "increase" ? <PlusIcon className="size-4" /> :
                  change.type === "decrease" ? <MinusIcon className="size-4" /> :
                  <SparklesIcon className="size-4" />}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
              Suggested Message
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 gap-1.5 rounded-lg px-2 text-[11px] font-bold"
            >
              <CopyIcon className="size-3" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <textarea
            value={editingMessage}
            onChange={(e) => setEditingMessage(e.target.value)}
            className="min-h-32 w-full rounded-2xl border border-border bg-background px-4 py-3 text-[13px] font-medium leading-relaxed text-foreground outline-none transition-colors focus:border-primary/40"
          />
        </div>

        <Button
          onClick={() => onApply(option)}
          className="h-11 w-full rounded-2xl px-6 text-[13px] font-bold shadow-lg shadow-primary/20"
        >
          Apply to Agreement Draft
        </Button>
      </CardContent>
    </Card>
  )
}

export { CounterofferEditor }
