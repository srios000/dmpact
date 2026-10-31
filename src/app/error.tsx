"use client"

import * as React from "react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-[32px] border-2 border-white bg-card p-10 text-center shadow-[0_15px_50px_rgba(0,0,0,0.1)]">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-white bg-destructive/10 text-destructive shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
          <span className="text-2xl font-black">!</span>
        </div>
        <h1 className="mt-4 text-[15px] font-black tracking-tight text-foreground uppercase">
          Something went wrong
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-[12px] leading-relaxed font-medium text-muted-foreground">
          We hit an unexpected error while loading this page. You can try again, or head back to your
          dashboard.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className={cn(buttonVariants({ variant: "default" }), "h-9 rounded-xl px-4 text-[12px] font-bold")}
          >
            Try again
          </button>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-9 rounded-xl border-border bg-card px-4 text-[12px] font-bold"
            )}
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
