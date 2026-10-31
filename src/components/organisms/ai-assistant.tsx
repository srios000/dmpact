"use client"

import * as React from "react"
import { ImageIcon, MessageSquareQuoteIcon, SparklesIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/molecules/empty-state"
import { ErrorState } from "@/components/molecules/error-state"
import { cn } from "@/lib/utils"

type Status = "idle" | "loading" | "error"
type Tab = "input" | "preview"

const TABS: { id: Tab; label: string }[] = [
  { id: "input", label: "Chat Input" },
  { id: "preview", label: "Agreement Preview" },
]

export function AiAssistant() {
  const [tab, setTab] = React.useState<Tab>("input")
  const [draft, setDraft] = React.useState("")
  const [status, setStatus] = React.useState<Status>("idle")
  const [error, setError] = React.useState<{ title: string; description: string } | null>(null)

  function runExtraction() {
    if (draft.trim().length === 0) {
      setTab("input")
      setStatus("error")
      setError({
        title: "Nothing to extract",
        description: "Paste the client's DM or upload a screenshot before generating an agreement.",
      })
      return
    }

    setStatus("loading")
    setError(null)

    // TODO(#36): replace with the Gemini extraction server action.
    window.setTimeout(() => {
      setStatus("error")
      setError({
        title: "Couldn't reach the AI service",
        description: "The extraction request failed. Check your connection and try again.",
      })
    }, 1400)
  }

  function reset() {
    setStatus("idle")
    setError(null)
  }

  return (
    <Card className="overflow-hidden rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)] transition-all duration-300 hover:-translate-y-1">
      <CardHeader className="p-6 pb-2">
        <CardTitle className="text-[15px] font-black tracking-tight text-foreground uppercase">
          AI Agreement Assistant
        </CardTitle>
        <p className="mt-1 text-[12px] leading-relaxed font-medium text-muted-foreground">
          Summarize commission chat and generate agreement details.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 p-6 pt-2">
        <div className="flex border-b border-border">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "px-4 py-3 text-[12px] font-bold transition-colors",
                tab === item.id
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {status === "error" && error ? (
          <ErrorState
            tone="error"
            size="sm"
            title={error.title}
            description={error.description}
            onRetry={error.title === "Nothing to extract" ? reset : runExtraction}
            retryLabel={error.title === "Nothing to extract" ? "Got it" : "Try again"}
            className="min-h-[180px]"
          />
        ) : status === "loading" ? (
          <div className="min-h-[180px] space-y-3 rounded-2xl border-2 border-dashed border-border bg-muted/40 p-6">
            <Skeleton className="h-4 w-1/2 rounded-full bg-muted" />
            <Skeleton className="h-3 w-full rounded-full bg-muted" />
            <Skeleton className="h-3 w-4/5 rounded-full bg-muted" />
            <Skeleton className="h-3 w-2/3 rounded-full bg-muted" />
            <Skeleton className="h-9 w-32 rounded-xl bg-muted" />
          </div>
        ) : tab === "input" ? (
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Paste the client's DM here..."
            className="min-h-[180px] w-full resize-none rounded-2xl border-2 border-dashed border-border bg-muted/40 p-5 text-[13px] leading-relaxed font-medium text-foreground transition-colors outline-none placeholder:text-muted-foreground focus:border-primary/40"
          />
        ) : (
          <EmptyState
            size="default"
            className="min-h-[180px] w-full"
            icon={MessageSquareQuoteIcon}
            title="No agreement draft yet"
            description="Paste a DM or upload a screenshot, then generate a draft to review it here."
          />
        )}

        <div className="grid gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full gap-2 rounded-xl border-border bg-card text-[13px] font-bold text-foreground shadow-sm hover:bg-muted"
          >
            <ImageIcon className="size-4 text-muted-foreground" /> Upload Chat Screenshot
          </Button>
          <Button
            type="button"
            onClick={runExtraction}
            disabled={status === "loading"}
            className="h-12 w-full gap-2 rounded-xl bg-primary text-[13px] font-bold text-primary-foreground shadow-lg hover:bg-primary/90"
          >
            <SparklesIcon className="size-4" />
            {status === "loading" ? "Generating..." : "Generate Agreement"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
