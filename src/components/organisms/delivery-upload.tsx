"use client"

import * as React from "react"
import {
  CheckCircle2Icon,
  CloudUploadIcon,
  FileIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface DeliveryUploadProps extends React.HTMLAttributes<HTMLDivElement> {
  onSuccess: (data: { fileName: string; hash: string; timestamp: string }) => void
  onCancel: () => void
}

type UploadState = "idle" | "dragging" | "uploading" | "success" | "error"

function DeliveryUpload({ className, onSuccess, onCancel, ...props }: DeliveryUploadProps) {
  const [state, setState] = React.useState<UploadState>("idle")
  const [progress, setProgress] = React.useState(0)
  const [file, setFile] = React.useState<File | null>(null)
  const [isFinal, setIsFinal] = React.useState(true)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (state === "idle") setState("dragging")
  }

  const handleDragLeave = () => {
    if (state === "dragging") setState("idle")
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
      setState("idle")
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
    }
  }

  const startUpload = () => {
    if (!file) return

    setState("uploading")
    setProgress(0)

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            setState("success")
            const now = new Date()
            const timestamp = now.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
            const fakeHash = "sha256_" + Math.random().toString(36).substring(2, 10)
            onSuccess({ fileName: file.name, hash: fakeHash, timestamp })
          }, 800)
          return 100
        }
        return prev + 10
      })
    }, 200)
  }

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm", className)} {...props}>
      <Card className="w-full max-w-lg rounded-[32px] border-2 border-white bg-card shadow-[0_25px_80px_rgba(0,0,0,0.2)]">
        <CardHeader className="flex flex-row items-center justify-between p-6 pb-2 md:p-8 md:pb-2">
          <div>
            <CardTitle className="text-[16px] font-black tracking-tight text-foreground uppercase">
              Upload Delivery
            </CardTitle>
            <p className="mt-1 text-[12px] font-medium text-muted-foreground">
              Send the final files to your client.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} className="rounded-xl">
            <XIcon className="size-5" />
          </Button>
        </CardHeader>

        <CardContent className="p-6 md:p-8">
          <div className="space-y-6">
            {!file && state !== "uploading" && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "relative flex min-h-60 flex-col items-center justify-center rounded-[28px] border-2 border-dashed transition-all",
                  state === "dragging"
                    ? "border-primary bg-blue-50/50 scale-[0.99]"
                    : "border-border bg-background hover:bg-muted/30"
                )}
              >
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <CloudUploadIcon className="size-7" />
                </div>
                <div className="mt-4 text-center">
                  <p className="text-[14px] font-black text-foreground">Click or drag file to upload</p>
                  <p className="mt-1 text-[12px] font-medium text-muted-foreground">
                    Support ZIP, MP4, PNG, JPG (Max 500MB)
                  </p>
                </div>
              </div>
            )}

            {file && state !== "uploading" && state !== "success" && (
              <div className="rounded-[28px] border border-border bg-background p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <FileIcon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-black text-foreground">{file.name}</p>
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFile(null)}
                    className="rounded-lg text-rose-500 hover:bg-rose-50"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-2">
                    <button
                      onClick={() => setIsFinal(true)}
                      className={cn(
                        "flex-1 rounded-xl py-2 text-[11px] font-black uppercase tracking-wider transition-all",
                        isFinal ? "bg-white text-primary shadow-sm" : "text-muted-foreground"
                      )}
                    >
                      Final Delivery
                    </button>
                    <button
                      onClick={() => setIsFinal(false)}
                      className={cn(
                        "flex-1 rounded-xl py-2 text-[11px] font-black uppercase tracking-wider transition-all",
                        !isFinal ? "bg-white text-primary shadow-sm" : "text-muted-foreground"
                      )}
                    >
                      Preview / Draft
                    </button>
                  </div>

                  <Button
                    onClick={startUpload}
                    className="h-11 w-full rounded-2xl px-6 text-[13px] font-bold shadow-lg shadow-primary/20"
                  >
                    Confirm & Send Delivery
                  </Button>
                </div>
              </div>
            )}

            {state === "uploading" && (
              <div className="rounded-[28px] border border-border bg-background p-8 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative flex size-16 items-center justify-center">
                    <LoaderCircleIcon className="size-10 animate-spin text-primary" />
                    <span className="absolute text-[11px] font-black text-primary">{progress}%</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[14px] font-black text-foreground">Uploading files...</p>
                    <p className="text-[12px] font-medium text-muted-foreground">
                      Calculating SHA-256 fingerprint for the delivery log.
                    </p>
                  </div>
                  <div className="h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {state === "success" && (
              <div className="rounded-[28px] border border-emerald-100 bg-emerald-50/50 p-8 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex size-16 items-center justify-center rounded-[2.5rem] bg-emerald-100 text-emerald-600">
                    <CheckCircle2Icon className="size-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[16px] font-black text-emerald-900">Delivery Successful!</p>
                    <p className="text-[13px] font-medium leading-relaxed text-emerald-800/70">
                      The client has been notified and the payment balance invoice has been sent.
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-emerald-700 shadow-sm">
                    <ShieldCheckIcon className="size-3.5" />
                    Fingerprint Logged
                  </div>
                  <Button
                    onClick={onCancel}
                    className="mt-4 h-11 w-full rounded-2xl bg-emerald-600 px-6 text-[13px] font-bold text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200"
                  >
                    Back to Details
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export { DeliveryUpload }
