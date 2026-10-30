"use client"

import * as React from "react"
import {
  BellIcon,
  DownloadIcon,
  PlayIcon,
  UploadIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DeliveryUpload } from "./delivery-upload"
import type { CommissionRow } from "@/app/queue/queue-data"
import { cn } from "@/lib/utils"

interface CommissionAction {
  key: string
  label: string
  icon: LucideIcon
  variant: "default" | "outline" | "destructive"
  disabled?: boolean
  hint?: string
}

function hasUnpaidDeposit(commission: CommissionRow) {
  return commission.depositStatus !== "paid"
}

function needsReminder(commission: CommissionRow) {
  return (
    commission.overdue ||
    hasUnpaidDeposit(commission) ||
    commission.balanceStatus === "pending" ||
    commission.balanceStatus === "overdue"
  )
}

function buildActions(commission: CommissionRow): CommissionAction[] {
  const actions: CommissionAction[] = []

  switch (commission.state) {
    case "in_progress":
      actions.push({ key: "deliver", label: "Upload delivery", icon: UploadIcon, variant: "default" })
      break
    case "delivered":
    case "completed":
    case "paid":
      actions.push({
        key: "evidence",
        label: "Download evidence pack",
        icon: DownloadIcon,
        variant: "default",
      })
      break
    default: {
      const blocked = hasUnpaidDeposit(commission)
      actions.push({
        key: "start",
        label: "Start work",
        icon: PlayIcon,
        variant: "default",
        disabled: blocked,
        hint: blocked ? "The deposit must be paid before work starts." : undefined,
      })
    }
  }

  if (needsReminder(commission)) {
    actions.push({ key: "remind", label: "Run reminder", icon: BellIcon, variant: "outline" })
  }

  if (
    commission.state === "draft" ||
    commission.state === "negotiation" ||
    commission.state === "agreed"
  ) {
    actions.push({ key: "cancel", label: "Cancel commission", icon: XIcon, variant: "destructive" })
  }

  return actions
}

export interface CommissionActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  commission: CommissionRow
}

function CommissionActions({ className, commission, ...props }: CommissionActionsProps) {
  const [showUpload, setShowUpload] = React.useState(false)
  const actions = buildActions(commission)
  const stateLabel = commission.state.replace("_", " ")

  function handleActionClick(key: string) {
    if (key === "deliver") {
      setShowUpload(true)
      return
    }

    if (key === "start") {
      alert("Starting commission work... (Mock state transition to In Progress)")
      return
    }

    if (key === "remind") {
      alert("Sending reminder to client via email and DM...")
      return
    }

    if (key === "cancel") {
      confirm("Are you sure you want to cancel this commission?")
    }
  }

  return (
    <>
      <Card
        className={cn(
          "rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]",
          className
        )}
        {...props}
      >
        <CardHeader className="p-6 pb-2 md:p-8 md:pb-2">
          <CardTitle className="text-[15px] font-black tracking-tight text-foreground uppercase">
            Next Actions
          </CardTitle>
          <p className="text-[12px] font-medium text-muted-foreground">
            Available while the commission is {stateLabel}.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 p-6 pt-4 md:p-8 md:pt-4">
          {actions.map((action) => (
            <div
              key={action.key}
              className={cn(
                "grid gap-1.5",
                (action.hint || action.variant === "destructive") && "col-span-2"
              )}
            >
              <Button
                variant={action.variant}
                disabled={action.disabled}
                onClick={() => handleActionClick(action.key)}
                className="h-11 w-full justify-center gap-3 rounded-2xl px-4 text-[13px] font-bold md:justify-start"
              >
                <action.icon className="size-4" />
                {action.label}
              </Button>
              {action.disabled && action.hint ? (
                <p className="px-1 text-[11px] font-medium text-muted-foreground">{action.hint}</p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {showUpload && (
        <DeliveryUpload
          onCancel={() => setShowUpload(false)}
          onSuccess={(data) => {
            console.log("Uploaded:", data)
            // In a real app, we'd trigger a state refresh or mutation here
          }}
        />
      )}
    </>
  )
}

export { CommissionActions }
