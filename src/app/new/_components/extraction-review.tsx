"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CopyIcon,
  FilePenLineIcon,
  LoaderCircleIcon,
  MessageSquareQuoteIcon,
  RefreshCwIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/molecules/empty-state"
import { ErrorState } from "@/components/molecules/error-state"
import { CounterofferEditor, type CounterofferOption } from "@/components/organisms/counteroffer-editor"
import { cn } from "@/lib/utils"

type Severity = "blocker" | "warning"
type Phase = "idle" | "loading" | "result" | "error" | "manual"

const DEMO_COUNTEROFFERS: CounterofferOption[] = [
  {
    id: "co-1",
    strategy: "fair",
    label: "Standard Rate",
    description: "Align with your base price for MV editing while keeping the requested scope.",
    suggestedMessage:
      "Thanks for reaching out! For a full MV edit, my standard rate starts at $150. Let me know if that works for you and I can get started right away!",
    changes: [
      { field: "Total Price", oldValue: "120.00", newValue: "150.00", type: "increase" },
    ],
  },
  {
    id: "co-2",
    strategy: "protective",
    label: "Limited Scope",
    description: "Keep the $120 budget but reduce the number of revisions to protect your time.",
    suggestedMessage:
      "I can definitely do this for $120! To stay within that budget, I can include 1 round of revisions instead of 2. Would that be okay?",
    changes: [
      { field: "Revisions", oldValue: "2", newValue: "1", type: "decrease" },
    ],
  },
  {
    id: "co-3",
    strategy: "upsell",
    label: "Premium Package",
    description: "Include the thumbnail and commercial rights for a comprehensive premium price.",
    suggestedMessage:
      "I saw you mentioned a thumbnail and commercial usage. I can include both plus the MV edit in a premium package for $200. This covers everything you need!",
    changes: [
      { field: "Total Price", oldValue: "120.00", newValue: "200.00", type: "increase" },
      { field: "Usage Rights", oldValue: "Unclear", newValue: "Full Commercial", type: "change" },
    ],
  },
]

type AgreementDraft = {
  serviceType: string
  deliverables: string
  totalPrice: string
  currency: string
  depositPercent: string
  deadline: string
  revisions: string
  usageRights: string
}

type VersionSnapshot = {
  id: string
  version: number
  createdAtLabel: string
  contentHash: string
  source: "extracted" | "manual" | "edited"
  draft: AgreementDraft
}

type Ambiguity = {
  id: string
  severity: Severity
  field: keyof AgreementDraft
  title: string
  message: string
  quote: string
  question: string
}

type ExtractionReviewProps = {
  defaultCurrency: string
  defaultDepositPct: string
}

const flagVariants = cva("rounded-3xl border p-4 shadow-sm", {
  variants: {
    severity: {
      blocker: "border-rose-200 bg-rose-50/80 text-rose-900",
      warning: "border-amber-200 bg-amber-50/80 text-amber-900",
    },
  },
  defaultVariants: {
    severity: "warning",
  },
})

const flagLabelVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black tracking-[0.12em] uppercase",
  {
    variants: {
      severity: {
        blocker: "bg-rose-100 text-rose-700",
        warning: "bg-amber-100 text-amber-700",
      },
    },
    defaultVariants: {
      severity: "warning",
    },
  }
)

const fieldShellVariants = cva("rounded-[28px] border p-4 transition-colors", {
  variants: {
    highlighted: {
      true: "border-amber-200 bg-amber-50/40",
      false: "border-border bg-background",
    },
  },
  defaultVariants: {
    highlighted: false,
  },
})

const DEMO_DM = `Hi! I need an MV edit for a vocal cover.
Budget is around $120. I need it before next Friday if possible.
Maybe 2 revisions? I also need commercial usage because it will be monetized.
Not sure yet if the thumbnail is included.`

function createEmptyDraft(defaultCurrency: string, defaultDepositPct: string): AgreementDraft {
  return {
    serviceType: "",
    deliverables: "",
    totalPrice: "",
    currency: defaultCurrency,
    depositPercent: defaultDepositPct,
    deadline: "",
    revisions: "",
    usageRights: "",
  }
}

function createDemoDraft(defaultCurrency: string, defaultDepositPct: string): AgreementDraft {
  return {
    serviceType: "MV Editing",
    deliverables: "1 lyric video edit for a vocal cover, thumbnail unclear",
    totalPrice: "120.00",
    currency: defaultCurrency,
    depositPercent: defaultDepositPct,
    deadline: "",
    revisions: "2",
    usageRights: "",
  }
}

function createDemoFlags(): Ambiguity[] {
  return [
    {
      id: "usage-rights",
      severity: "blocker",
      field: "usageRights",
      title: "Usage rights missing",
      message: "The DM says the cover will be monetized, but the exact usage rights are still unclear.",
      quote: "\"I also need commercial usage because it will be monetized.\"",
      question: "Can you confirm the exact usage rights you need for this commission?",
    },
    {
      id: "deadline",
      severity: "blocker",
      field: "deadline",
      title: "Deadline is relative",
      message: "Next Friday depends on when the message was sent, so the app needs a fixed date.",
      quote: "\"I need it before next Friday if possible.\"",
      question: "What exact date should we use as the final delivery deadline?",
    },
    {
      id: "deliverables",
      severity: "warning",
      field: "deliverables",
      title: "Scope may be incomplete",
      message: "The thumbnail sounds optional, so the deliverables list may still change.",
      quote: "\"Not sure yet if the thumbnail is included.\"",
      question: "Should the thumbnail be included in this agreement or kept outside the scope?",
    },
  ]
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function computeFlags(draft: AgreementDraft, baseFlags: Ambiguity[]) {
  return baseFlags.filter((flag) => {
    if (flag.field === "deadline") {
      return normalizeText(draft.deadline).length === 0
    }

    if (flag.field === "usageRights") {
      return normalizeText(draft.usageRights).length === 0
    }

    if (flag.field === "deliverables") {
      const value = normalizeText(draft.deliverables)
      return value.length === 0 || value.includes("unclear") || value.includes("not sure")
    }

    return true
  })
}

function formatMoneyInput(value: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return "0.00"
  return parsed.toFixed(2)
}

function calculatePaymentPreview(totalPrice: string, depositPercent: string) {
  const total = Number(totalPrice)
  const depositPct = Number(depositPercent)

  if (!Number.isFinite(total) || !Number.isFinite(depositPct)) {
    return { depositAmount: "0.00", balanceAmount: "0.00" }
  }

  const safeTotal = Math.max(0, total)
  const safeDepositPct = Math.min(100, Math.max(0, depositPct))
  const depositAmount = safeTotal * (safeDepositPct / 100)
  const balanceAmount = safeTotal - depositAmount

  return {
    depositAmount: depositAmount.toFixed(2),
    balanceAmount: balanceAmount.toFixed(2),
  }
}

function createContentHash(draft: AgreementDraft) {
  const text = JSON.stringify(draft)
  let hash = 0

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }

  return `vhash_${hash.toString(16).padStart(8, "0")}`
}

function createVersionSnapshot(
  draft: AgreementDraft,
  version: number,
  source: VersionSnapshot["source"]
): VersionSnapshot {
  return {
    id: `version-${version}`,
    version,
    createdAtLabel: new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    contentHash: createContentHash(draft),
    source,
    draft: { ...draft },
  }
}

function FieldCard({
  label,
  hint,
  value,
  name,
  onChange,
  ambiguities,
  suffix,
}: {
  label: string
  hint: string
  value: string
  name: keyof AgreementDraft
  onChange: (field: keyof AgreementDraft, value: string) => void
  ambiguities: Ambiguity[]
  suffix?: string
}) {
  const hasFlags = ambiguities.length > 0

  return (
    <div className="grid gap-3">
      <div className={cn(fieldShellVariants({ highlighted: hasFlags }))}>
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
            <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">{hint}</p>
          </div>
          {hasFlags ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-amber-700 shadow-sm">
              {ambiguities.length} flag
            </span>
          ) : null}
        </div>
        <div className="relative">
          {name === "deliverables" ? (
            <textarea
              value={value}
              onChange={(event) => onChange(name, event.target.value)}
              className="min-h-28 w-full rounded-2xl border border-border bg-card px-3 py-3 text-[13px] font-semibold text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/20"
            />
          ) : (
            <>
              <input
                value={value}
                onChange={(event) => onChange(name, event.target.value)}
                className={cn(
                  "h-11 w-full rounded-2xl border border-border bg-card px-3 text-[13px] font-semibold text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/20",
                  suffix ? "pr-12" : ""
                )}
              />
              {suffix ? (
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12px] font-bold text-muted-foreground">
                  {suffix}
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>

      {ambiguities.map((ambiguity) => (
        <div key={ambiguity.id} className={cn(flagVariants({ severity: ambiguity.severity }))}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <span className={cn(flagLabelVariants({ severity: ambiguity.severity }))}>
                {ambiguity.severity === "blocker" ? "Blocker" : "Warning"}
              </span>
              <div>
                <p className="text-[12px] font-black">{ambiguity.title}</p>
                <p className="mt-1 text-[12px] font-medium leading-relaxed">{ambiguity.message}</p>
              </div>
            </div>
            {ambiguity.severity === "blocker" ? (
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-rose-500" />
            ) : (
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />
            )}
          </div>
          <div className="mt-3 rounded-2xl border border-white/70 bg-white/70 p-3">
            <p className="text-[10px] font-black tracking-[0.14em] uppercase opacity-70">Source Quote</p>
            <p className="mt-1 text-[12px] font-medium leading-relaxed">{ambiguity.quote}</p>
          </div>
          <div className="mt-3 rounded-2xl border border-white/70 bg-white/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.14em] uppercase opacity-70">Suggested Question</p>
                <p className="mt-1 text-[12px] font-medium leading-relaxed">{ambiguity.question}</p>
              </div>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(ambiguity.question)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white bg-white px-2.5 py-1 text-[11px] font-bold text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                <CopyIcon className="size-3.5" />
                Copy
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ExtractionReview({
  defaultCurrency,
  defaultDepositPct,
}: ExtractionReviewProps) {
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [dmText, setDmText] = React.useState("")
  const [draft, setDraft] = React.useState<AgreementDraft>(() =>
    createEmptyDraft(defaultCurrency, defaultDepositPct)
  )
  const [baseFlags, setBaseFlags] = React.useState<Ambiguity[]>([])
  const [errorMessage, setErrorMessage] = React.useState("")
  const [versions, setVersions] = React.useState<VersionSnapshot[]>([])
  const [activeVersionId, setActiveVersionId] = React.useState<string | null>(null)
  const [copiedLink, setCopiedLink] = React.useState(false)
  const [showCounteroffers, setShowCounteroffers] = React.useState(false)

  const flags = React.useMemo(() => computeFlags(draft, baseFlags), [baseFlags, draft])
  const blockerCount = flags.filter((flag) => flag.severity === "blocker").length
  const warningCount = flags.filter((flag) => flag.severity === "warning").length
  const paymentPreview = React.useMemo(
    () => calculatePaymentPreview(draft.totalPrice, draft.depositPercent),
    [draft.depositPercent, draft.totalPrice]
  )
  const activeVersion = React.useMemo(
    () => versions.find((version) => version.id === activeVersionId) ?? null,
    [activeVersionId, versions]
  )
  const clientLink = React.useMemo(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"

    if (!activeVersion) return `${origin}/a/demo-agreement`
    return `${origin}/a/demo-${activeVersion.version}-${activeVersion.contentHash}`
  }, [activeVersion])

  const fieldFlags = React.useMemo(() => {
    return {
      serviceType: flags.filter((flag) => flag.field === "serviceType"),
      deliverables: flags.filter((flag) => flag.field === "deliverables"),
      totalPrice: flags.filter((flag) => flag.field === "totalPrice"),
      currency: flags.filter((flag) => flag.field === "currency"),
      depositPercent: flags.filter((flag) => flag.field === "depositPercent"),
      deadline: flags.filter((flag) => flag.field === "deadline"),
      revisions: flags.filter((flag) => flag.field === "revisions"),
      usageRights: flags.filter((flag) => flag.field === "usageRights"),
    }
  }, [flags])

  const startExtraction = React.useCallback(
    (sourceText: string) => {
      if (!sourceText.trim()) {
        setPhase("error")
        setErrorMessage("Paste the client DM first, or switch to manual entry.")
        return
      }

      setPhase("loading")
      setErrorMessage("")

      window.setTimeout(() => {
        if (sourceText.toLowerCase().includes("error") || sourceText.toLowerCase().includes("fail")) {
          setPhase("error")
          setErrorMessage("The AI extraction failed. Retry the same DM or enter the agreement manually.")
          return
        }

        const nextDraft = createDemoDraft(defaultCurrency, defaultDepositPct)
        const nextBaseFlags = createDemoFlags()
        const initialVersion = createVersionSnapshot(nextDraft, 1, "extracted")

        setDraft(nextDraft)
        setBaseFlags(nextBaseFlags)
        setVersions([initialVersion])
        setActiveVersionId(initialVersion.id)
        setCopiedLink(false)
        setPhase("result")
      }, 1400)
    },
    [defaultCurrency, defaultDepositPct]
  )

  function handleFieldChange(field: keyof AgreementDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleManualMode() {
    const nextDraft = createEmptyDraft(defaultCurrency, defaultDepositPct)
    const initialVersion = createVersionSnapshot(nextDraft, 1, "manual")

    setDraft(nextDraft)
    setBaseFlags([])
    setVersions([initialVersion])
    setActiveVersionId(initialVersion.id)
    setCopiedLink(false)
    setPhase("manual")
    setErrorMessage("")
  }

  function handleRetry() {
    startExtraction(dmText)
  }

  function saveNewVersion() {
    const nextVersion = createVersionSnapshot(draft, versions.length + 1, "edited")

    setVersions((current) => [nextVersion, ...current])
    setActiveVersionId(nextVersion.id)
  }

  function loadVersion(versionId: string) {
    const version = versions.find((item) => item.id === versionId)
    if (!version) return

    setDraft({ ...version.draft })
    setActiveVersionId(version.id)
    setCopiedLink(false)
  }

  function handleApplyCounteroffer(option: CounterofferOption) {
    const nextDraft = { ...draft }

    option.changes.forEach((change) => {
      if (change.field === "Total Price") nextDraft.totalPrice = change.newValue
      if (change.field === "Revisions") nextDraft.revisions = change.newValue
      if (change.field === "Usage Rights") nextDraft.usageRights = change.newValue
    })

    setDraft(nextDraft)
    setShowCounteroffers(false)
    saveNewVersion()
  }

  async function copyClientLink() {
    await navigator.clipboard.writeText(clientLink)
    setCopiedLink(true)
    window.setTimeout(() => setCopiedLink(false), 1800)
  }

  return (
    <div className="grid gap-6">
      <Card className="rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]">
        <CardHeader className="p-6 pb-4 md:p-8 md:pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <MessageSquareQuoteIcon className="size-5" />
            </div>
            <div>
              <CardTitle className="text-[16px] font-black tracking-tight text-foreground uppercase">
                Paste Client DM
              </CardTitle>
              <p className="text-[12px] font-medium text-muted-foreground">
                Start with the raw chat. The review screen appears after extraction.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 pt-0 md:p-8 md:pt-0">
          <textarea
            value={dmText}
            onChange={(event) => setDmText(event.target.value)}
            placeholder="Paste the full commission DM here..."
            className="min-h-[340px] w-full rounded-[28px] border-2 border-dashed border-border bg-background px-5 py-4 text-[13px] font-medium leading-relaxed text-foreground outline-none transition-colors focus:border-primary/40"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => startExtraction(dmText)}
              className="h-11 rounded-2xl px-5 text-[13px] font-bold shadow-lg shadow-primary/20"
            >
              <SparklesIcon className="size-4" />
              Extract Agreement
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDmText(DEMO_DM)}
              className="h-11 rounded-2xl border-border bg-card px-5 text-[13px] font-bold"
            >
              <WandSparklesIcon className="size-4" />
              Use Demo DM
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleManualMode}
              className="h-11 rounded-2xl border-border bg-card px-5 text-[13px] font-bold"
            >
              <FilePenLineIcon className="size-4" />
              Manual Entry
            </Button>
          </div>

          <div className="rounded-[28px] border border-border bg-background p-4">
            <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">What this screen should do</p>
            <ul className="mt-3 grid gap-2 text-[12px] font-medium text-muted-foreground">
              <li>Paste a DM and move into a loading state.</li>
              <li>Show extracted agreement fields that the creator can edit.</li>
              <li>Flag blockers and warnings inline, with a quote and a copyable follow-up question.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]">
        <CardHeader className="p-6 pb-4 md:p-8 md:pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-[16px] font-black tracking-tight text-foreground uppercase">
                Extraction Review
              </CardTitle>
              <p className="text-[12px] font-medium text-muted-foreground">
                Review the AI output before it becomes the agreement draft.
              </p>
            </div>
            {(phase === "result" || phase === "manual") && (
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700">
                  {blockerCount} blocker
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700">
                  {warningCount} warning
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0 md:p-8 md:pt-0">
          {phase === "idle" ? (
            <EmptyState
              size="lg"
              icon={SparklesIcon}
              title="No extraction yet"
              description="Paste a client DM on the left, then run extraction to preview the agreement here."
            />
          ) : null}

          {phase === "loading" ? (
            <div className="grid gap-4">
              <div className="flex items-center gap-3 rounded-[28px] border border-border bg-background p-4">
                <LoaderCircleIcon className="size-5 animate-spin text-primary" />
                <div>
                  <p className="text-[12px] font-bold text-foreground">Extracting agreement...</p>
                  <p className="text-[12px] font-medium text-muted-foreground">
                    Pulling service, budget, deadline, deposit and ambiguity flags from the DM.
                  </p>
                </div>
              </div>
              <Skeleton className="h-24 rounded-[28px] bg-muted" />
              <Skeleton className="h-20 rounded-[28px] bg-muted" />
              <Skeleton className="h-20 rounded-[28px] bg-muted" />
              <Skeleton className="h-20 rounded-[28px] bg-muted" />
            </div>
          ) : null}

          {phase === "error" ? (
            <ErrorState
              title="Extraction failed"
              description={errorMessage}
              onRetry={handleRetry}
              retryLabel="Retry extraction"
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleManualMode}
                  className="mt-2 h-9 rounded-xl border-border bg-card px-4 text-[12px] font-bold"
                >
                  Enter manually instead
                </Button>
              }
            />
          ) : null}

          {(phase === "result" || phase === "manual") && (
            <div className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="grid gap-4 rounded-[28px] border border-border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                        Payment Preview
                      </p>
                      <p className="mt-1 text-[12px] font-medium text-muted-foreground">
                        Deposit and balance are recalculated live from total price and deposit percentage.
                      </p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-foreground shadow-sm">
                      {draft.currency || defaultCurrency}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl border border-border bg-card p-4">
                      <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                        Deposit
                      </p>
                      <p className="mt-2 text-[24px] font-black tracking-tight text-foreground">
                        {draft.currency || defaultCurrency} {paymentPreview.depositAmount}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-border bg-card p-4">
                      <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                        Balance
                      </p>
                      <p className="mt-2 text-[24px] font-black tracking-tight text-foreground">
                        {draft.currency || defaultCurrency} {paymentPreview.balanceAmount}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-2xl bg-amber-50 p-4 border border-amber-100">
                    <div className="flex items-center gap-3">
                      <SparklesIcon className="size-4 text-amber-600" />
                      <p className="text-[12px] font-bold text-amber-900">Budget mismatch detected</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCounteroffers(!showCounteroffers)}
                      className="h-8 rounded-xl px-3 text-[11px] font-black text-amber-700 hover:bg-amber-100 uppercase tracking-wider"
                    >
                      {showCounteroffers ? "Hide options" : "Explore counteroffers"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 rounded-[28px] border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                        Version History
                      </p>
                      <p className="mt-1 text-[12px] font-medium text-muted-foreground">
                        Save edits as a new immutable version, then reopen older ones anytime.
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-foreground shadow-sm">
                      {versions.length} version
                    </span>
                  </div>

                  <div className="grid gap-2">
                    {versions.map((version) => {
                      const isActive = version.id === activeVersionId

                      return (
                        <button
                          key={version.id}
                          type="button"
                          onClick={() => loadVersion(version.id)}
                          className={cn(
                            "rounded-3xl border p-3 text-left transition-colors",
                            isActive
                              ? "border-primary bg-blue-50/70"
                              : "border-border bg-card hover:bg-muted/60"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[12px] font-black text-foreground">
                                v{version.version}{" "}
                                <span className="text-[11px] font-bold text-muted-foreground">
                                  ({version.source})
                                </span>
                              </p>
                              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                                {version.createdAtLabel}
                              </p>
                            </div>
                            {isActive ? (
                              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-primary shadow-sm">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                            Hash: {version.contentHash}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {showCounteroffers && (
                <div className="rounded-[32px] border-2 border-white bg-slate-50/50 p-6 shadow-inner md:p-8">
                  <div className="mb-6">
                    <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                      Counteroffer Generator
                    </p>
                    <p className="mt-1 text-[13px] font-medium text-muted-foreground">
                      The AI suggests these options to bridge the gap between your rate card and the client's budget.
                    </p>
                  </div>
                  <CounterofferEditor
                    options={DEMO_COUNTEROFFERS}
                    onApply={handleApplyCounteroffer}
                    estimateRange="$150.00 - $220.00"
                    mismatchReason="The client's budget ($120) is below your base price for MV editing. Consider adjusting the scope or rate."
                  />
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <FieldCard
                  label="Service Type"
                  hint="What kind of commission is this?"
                  name="serviceType"
                  value={draft.serviceType}
                  onChange={handleFieldChange}
                  ambiguities={fieldFlags.serviceType}
                />
                <FieldCard
                  label="Total Price"
                  hint="Money math will use this as the base amount."
                  name="totalPrice"
                  value={draft.totalPrice}
                  onChange={handleFieldChange}
                  ambiguities={fieldFlags.totalPrice}
                />
                <FieldCard
                  label="Currency"
                  hint="Should match the creator's rate card and PayPal support."
                  name="currency"
                  value={draft.currency}
                  onChange={handleFieldChange}
                  ambiguities={fieldFlags.currency}
                />
                <FieldCard
                  label="Deposit"
                  hint="Default comes from Settings, but the creator can override it here."
                  name="depositPercent"
                  value={draft.depositPercent}
                  onChange={handleFieldChange}
                  ambiguities={fieldFlags.depositPercent}
                  suffix="%"
                />
                <FieldCard
                  label="Deadline"
                  hint="Use a fixed date the client can confirm."
                  name="deadline"
                  value={draft.deadline}
                  onChange={handleFieldChange}
                  ambiguities={fieldFlags.deadline}
                />
                <FieldCard
                  label="Revisions"
                  hint="How many revisions are included in the agreed scope?"
                  name="revisions"
                  value={draft.revisions}
                  onChange={handleFieldChange}
                  ambiguities={fieldFlags.revisions}
                />
              </div>

              <FieldCard
                label="Deliverables"
                hint="List the actual files or outputs the client should receive."
                name="deliverables"
                value={draft.deliverables}
                onChange={handleFieldChange}
                ambiguities={fieldFlags.deliverables}
              />

              <FieldCard
                label="Usage Rights"
                hint="State the allowed usage clearly. This must be resolved before sending to the client."
                name="usageRights"
                value={draft.usageRights}
                onChange={handleFieldChange}
                ambiguities={fieldFlags.usageRights}
              />

              <div className="grid gap-4 rounded-[28px] border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                      Review status
                    </p>
                    <p className="mt-1 text-[12px] font-medium text-muted-foreground">
                      {blockerCount > 0
                        ? "Blockers must be resolved before this agreement can be sent to the client."
                        : "No blockers left. The agreement is ready for the next step."}
                    </p>
                  </div>
                  {blockerCount > 0 ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700">
                      <AlertTriangleIcon className="size-3.5" />
                      Resolve blockers first
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2Icon className="size-3.5" />
                      Ready for next step
                    </span>
                  )}
                </div>

                <div className="rounded-3xl border border-border bg-card p-4">
                  <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                    Client Link
                  </p>
                  <p className="mt-2 break-all text-[12px] font-medium text-foreground">{clientLink}</p>
                  <p className="mt-1 text-[12px] font-medium text-muted-foreground">
                    The link is tied to the active agreement version hash.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={saveNewVersion}
                    className="h-10 rounded-xl px-4 text-[13px] font-bold shadow-lg shadow-primary/20"
                  >
                    Save New Version
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyClientLink}
                    className="h-10 rounded-xl border-border bg-card px-4 text-[13px] font-bold"
                  >
                    <CopyIcon className="size-4" />
                    {copiedLink ? "Copied" : "Copy Client Link"}
                  </Button>
                  <Button
                    type="button"
                    disabled={blockerCount > 0}
                    className="h-10 rounded-xl px-4 text-[13px] font-bold shadow-lg shadow-primary/20"
                  >
                    Send to Client
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => startExtraction(dmText)}
                    className="h-10 rounded-xl border-border bg-card px-4 text-[13px] font-bold"
                  >
                    <RefreshCwIcon className="size-4" />
                    Re-run extraction
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
