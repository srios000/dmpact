"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Clock3Icon,
  CopyIcon,
  CreditCardIcon,
  FileTextIcon,
  MailIcon,
  MessageSquareTextIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type PaymentStatus = "awaiting-confirmation" | "invoice-sent" | "deposit-paid"

type ClientAgreementPageProps = {
  token: string
}

const deliverables = [
  "1 lyric video edit in 1080p MP4",
  "1 thumbnail draft for YouTube upload",
  "2 revision rounds included",
]

function formatCurrency(value: string) {
  return Number(value).toFixed(2)
}

export function ClientAgreementPage({ token }: ClientAgreementPageProps) {
  const total = "120.00"
  const depositPercent = 50
  const depositAmount = (Number(total) * (depositPercent / 100)).toFixed(2)
  const balanceAmount = (Number(total) - Number(depositAmount)).toFixed(2)
  const [paymentStatus, setPaymentStatus] = React.useState<PaymentStatus>("awaiting-confirmation")
  const [paypalEmail, setPaypalEmail] = React.useState("")
  const [requestMessage, setRequestMessage] = React.useState("")
  const [isRequestOpen, setIsRequestOpen] = React.useState(false)
  const [requestSent, setRequestSent] = React.useState(false)
  const [copiedPayLink, setCopiedPayLink] = React.useState(false)

  const payLink = `https://www.paypal.com/invoice/p/demo-${token}`

  function handleConfirm() {
    if (!paypalEmail.trim()) return

    setPaymentStatus("invoice-sent")
    window.setTimeout(() => {
      setPaymentStatus("deposit-paid")
    }, 2200)
  }

  function handleRequestChanges() {
    if (!requestMessage.trim()) return

    setRequestSent(true)
    setIsRequestOpen(false)
  }

  async function copyPayLink() {
    await navigator.clipboard.writeText(payLink)
    setCopiedPayLink(true)
    window.setTimeout(() => setCopiedPayLink(false), 1600)
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1220px] flex-col gap-6 px-4 py-6 md:px-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <Card className="rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]">
          <CardHeader className="p-6 pb-4 md:p-8 md:pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">
                  <ShieldCheckIcon className="size-3.5" />
                  Client Agreement
                </div>
                <CardTitle className="text-[24px] font-black tracking-tight text-foreground">
                  MV Editing Agreement
                </CardTitle>
                <p className="max-w-2xl text-[13px] font-medium leading-relaxed text-muted-foreground">
                  Please review the deliverables, timeline, payment split, and usage rights before confirming.
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-background px-4 py-3 text-right">
                <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                  Agreement Token
                </p>
                <p className="mt-1 text-[12px] font-bold text-foreground">{token}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 p-6 pt-0 md:p-8 md:pt-0">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[28px] border border-border bg-background p-5">
                <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">Service</p>
                <p className="mt-2 text-[16px] font-black text-foreground">MV Editing</p>
                <p className="mt-1 text-[12px] font-medium leading-relaxed text-muted-foreground">
                  Vocal cover lyric video with a delivery-ready export.
                </p>
              </div>
              <div className="rounded-[28px] border border-border bg-background p-5">
                <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">Deadline</p>
                <p className="mt-2 text-[16px] font-black text-foreground">Nov 8, 2026</p>
                <p className="mt-1 text-[12px] font-medium leading-relaxed text-muted-foreground">
                  Final delivery after deposit confirmation and revision rounds.
                </p>
              </div>
              <div className="rounded-[28px] border border-border bg-background p-5">
                <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">Revisions</p>
                <p className="mt-2 text-[16px] font-black text-foreground">2 rounds included</p>
                <p className="mt-1 text-[12px] font-medium leading-relaxed text-muted-foreground">
                  Additional revisions follow the creator&apos;s rate card.
                </p>
              </div>
              <div className="rounded-[28px] border border-border bg-background p-5">
                <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">Usage Rights</p>
                <p className="mt-2 text-[16px] font-black text-foreground">Commercial / Monetized cover usage</p>
                <p className="mt-1 text-[12px] font-medium leading-relaxed text-muted-foreground">
                  Uploading to monetized YouTube and streaming platforms is included.
                </p>
              </div>
            </div>

            <div className="rounded-[28px] border border-border bg-background p-5">
              <div className="flex items-center gap-3">
                <FileTextIcon className="size-4 text-primary" />
                <p className="text-[12px] font-black tracking-[0.14em] text-foreground uppercase">Deliverables</p>
              </div>
              <div className="mt-4 grid gap-3">
                {deliverables.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-3xl border border-border bg-card px-4 py-3"
                  >
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <p className="text-[13px] font-medium leading-relaxed text-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-border bg-background p-5">
              <div className="flex items-center gap-3">
                <CreditCardIcon className="size-4 text-primary" />
                <p className="text-[12px] font-black tracking-[0.14em] text-foreground uppercase">Payment Summary</p>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-border bg-card p-4">
                  <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">Total</p>
                  <p className="mt-2 text-[24px] font-black tracking-tight text-foreground">USD {formatCurrency(total)}</p>
                </div>
                <div className="rounded-3xl border border-border bg-card p-4">
                  <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">Deposit</p>
                  <p className="mt-2 text-[24px] font-black tracking-tight text-foreground">
                    USD {depositAmount}
                  </p>
                  <p className="mt-1 text-[12px] font-medium text-muted-foreground">{depositPercent}% due on confirm</p>
                </div>
                <div className="rounded-3xl border border-border bg-card p-4">
                  <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">Balance</p>
                  <p className="mt-2 text-[24px] font-black tracking-tight text-foreground">
                    USD {balanceAmount}
                  </p>
                  <p className="mt-1 text-[12px] font-medium text-muted-foreground">Paid after final delivery</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:sticky xl:top-6 xl:self-start">
          <Card className="rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-[15px] font-black tracking-tight text-foreground uppercase">
                Action Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-6 pt-0">
              <div
                className={cn(
                  "rounded-[28px] border p-4",
                  paymentStatus === "awaiting-confirmation"
                    ? "border-amber-200 bg-amber-50/70"
                    : paymentStatus === "invoice-sent"
                      ? "border-blue-200 bg-blue-50/70"
                      : "border-emerald-200 bg-emerald-50/70"
                )}
              >
                <div className="flex items-start gap-3">
                  {paymentStatus === "awaiting-confirmation" ? (
                    <Clock3Icon className="mt-0.5 size-4 text-amber-600" />
                  ) : paymentStatus === "invoice-sent" ? (
                    <MailIcon className="mt-0.5 size-4 text-blue-600" />
                  ) : (
                    <CheckCircle2Icon className="mt-0.5 size-4 text-emerald-600" />
                  )}
                  <div className="space-y-1">
                    <p className="text-[12px] font-black text-foreground">
                      {paymentStatus === "awaiting-confirmation"
                        ? "Waiting for confirmation"
                        : paymentStatus === "invoice-sent"
                          ? "Deposit invoice sent"
                          : "Deposit paid"}
                    </p>
                    <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
                      {paymentStatus === "awaiting-confirmation"
                        ? "Confirm the agreement first. The PayPal deposit button will appear right after that."
                        : paymentStatus === "invoice-sent"
                          ? "The deposit pay link is now active. Status will update here without reloading."
                          : "Deposit received. The commission can move forward to the creator's work stage."}
                    </p>
                  </div>
                </div>
              </div>

              <label className="grid gap-2">
                <span className="text-[11px] font-black tracking-[0.14em] text-foreground uppercase">
                  Your PayPal Email
                </span>
                <Input
                  type="email"
                  value={paypalEmail}
                  onChange={(event) => setPaypalEmail(event.target.value)}
                  placeholder="client@example.com"
                  className="h-11 rounded-2xl border-border bg-background text-[13px] font-medium"
                />
                <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
                  Needed so the deposit invoice can be addressed correctly if it is missing from the DM.
                </p>
              </label>

              <div className="grid gap-3">
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!paypalEmail.trim() || paymentStatus !== "awaiting-confirmation"}
                  className="h-11 rounded-2xl px-5 text-[13px] font-bold shadow-lg shadow-primary/20"
                >
                  Confirm Agreement
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRequestOpen((current) => !current)}
                  className="h-11 rounded-2xl border-border bg-card px-5 text-[13px] font-bold"
                >
                  <MessageSquareTextIcon className="size-4" />
                  Request Changes
                </Button>
              </div>

              {isRequestOpen ? (
                <div className="grid gap-3 rounded-[28px] border border-border bg-background p-4">
                  <label className="grid gap-2">
                    <span className="text-[11px] font-black tracking-[0.14em] text-foreground uppercase">
                      Change Request
                    </span>
                    <textarea
                      value={requestMessage}
                      onChange={(event) => setRequestMessage(event.target.value)}
                      className="min-h-28 w-full rounded-2xl border border-border bg-card px-3 py-3 text-[13px] font-medium text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/20"
                      placeholder="Tell the creator what should be changed..."
                    />
                  </label>
                  <Button
                    type="button"
                    onClick={handleRequestChanges}
                    disabled={!requestMessage.trim()}
                    className="h-10 rounded-xl px-4 text-[13px] font-bold shadow-lg shadow-primary/20"
                  >
                    Send Request
                  </Button>
                </div>
              ) : null}

              {requestSent ? (
                <div className="rounded-[28px] border border-amber-200 bg-amber-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangleIcon className="mt-0.5 size-4 text-amber-600" />
                    <div className="space-y-1">
                      <p className="text-[12px] font-black text-foreground">Change request sent</p>
                      <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
                        The creator will need to prepare a new agreement version before you confirm again.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {paymentStatus !== "awaiting-confirmation" ? (
                <div className="grid gap-3 rounded-[28px] border border-border bg-background p-4">
                  <div className="rounded-3xl border border-border bg-card p-4">
                    <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                      Deposit Pay Link
                    </p>
                    <p className="mt-2 break-all text-[12px] font-medium text-foreground">{payLink}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <a
                      href={payLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-[13px] font-bold text-primary-foreground shadow-lg shadow-primary/20"
                    >
                      Pay Deposit with PayPal
                    </a>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={copyPayLink}
                      className="h-11 rounded-2xl border-border bg-card px-5 text-[13px] font-bold"
                    >
                      <CopyIcon className="size-4" />
                      {copiedPayLink ? "Copied" : "Copy Pay Link"}
                    </Button>
                  </div>
                </div>
              ) : null}

              <Link
                href="/new"
                className="text-center text-[12px] font-bold text-primary hover:underline"
              >
                Back to creator review
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
