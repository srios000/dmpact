"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { FileDropzone } from "@/components/molecules/file-dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DELIVERY_MIME_TYPES,
  MAX_DELIVERY_BYTES,
  type CreateDeliveryUploadInput,
  type RecordDeliveryInput,
} from "@/lib/schema/delivery";
import type { ActionResult } from "@/lib/repositories/action-result";
import { cn } from "@/lib/utils";

type CreateUploadResult = {
  uploadId: string;
  url: string;
  method: string;
  headers: { "Content-Type": string };
  expiresAt: string;
};

type RecordedDelivery = {
  id: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  isFinal: boolean;
  loggedAt: string;
};

type CreateUploadAction = (
  input: CreateDeliveryUploadInput,
) => Promise<ActionResult<CreateUploadResult>>;

type RecordDeliveryAction = (
  input: RecordDeliveryInput,
) => Promise<ActionResult<{ delivery: RecordedDelivery }>>;

type Phase = "idle" | "uploading" | "recording" | "done";

const stampFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function putFile(
  url: string,
  contentType: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("The upload failed. Try again."));
    };
    xhr.onerror = () => reject(new Error("The upload failed. Try again."));
    xhr.send(file);
  });
}

export interface CommissionDeliveryUploadProps extends React.HTMLAttributes<HTMLElement> {
  commissionId: string;
  createDeliveryUpload: CreateUploadAction;
  recordDelivery: RecordDeliveryAction;
}

function CommissionDeliveryUpload({
  className,
  commissionId,
  createDeliveryUpload,
  recordDelivery,
  ...props
}: CommissionDeliveryUploadProps) {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [kind, setKind] = React.useState<"preview" | "final">("final");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [delivery, setDelivery] = React.useState<RecordedDelivery | null>(null);

  const pending = phase === "uploading" || phase === "recording";

  function handleSelect(next: File) {
    setError(null);
    setDelivery(null);
    if (next.size > MAX_DELIVERY_BYTES) {
      setError("Files can be at most 25 MB.");
      return;
    }
    setFile(next);
  }

  async function handleSubmit() {
    if (!file) return;
    setError(null);
    setDelivery(null);
    setPhase("uploading");
    setProgress(0);

    const created = await createDeliveryUpload({
      commissionId,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (!created.ok) {
      setError(created.error.message);
      setPhase("idle");
      return;
    }

    try {
      await putFile(
        created.data.url,
        created.data.headers["Content-Type"],
        file,
        setProgress,
      );
    } catch (putError) {
      setError(putError instanceof Error ? putError.message : "Upload failed.");
      setPhase("idle");
      return;
    }

    setProgress(100);
    setPhase("recording");
    const recorded = await recordDelivery({
      commissionId,
      uploadId: created.data.uploadId,
      filename: file.name,
      isFinal: kind === "final",
    });
    if (!recorded.ok) {
      setError(recorded.error.message);
      setPhase("idle");
      return;
    }

    setDelivery(recorded.data.delivery);
    setPhase("done");
    setFile(null);
    router.refresh();
  }

  return (
    <section
      className={cn("space-y-4 rounded-xl border bg-card p-5", className)}
      {...props}
    >
      <header className="space-y-1">
        <h2 className="font-medium text-foreground">Upload delivery</h2>
        <p className="text-sm text-muted-foreground">
          Send a preview or the final file. Each upload adds a new, append-only
          record with its fingerprint.
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <FileDropzone
        file={file}
        onSelect={handleSelect}
        onClear={() => {
          setFile(null);
          setDelivery(null);
        }}
        accept={DELIVERY_MIME_TYPES.join(",")}
        disabled={pending}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Type</span>
          <div
            role="group"
            aria-label="Delivery type"
            className="flex rounded-lg border p-0.5"
          >
            <Button
              type="button"
              size="sm"
              variant={kind === "preview" ? "default" : "outline"}
              disabled={pending}
              onClick={() => setKind("preview")}
            >
              Preview
            </Button>
            <Button
              type="button"
              size="sm"
              variant={kind === "final" ? "default" : "outline"}
              disabled={pending}
              onClick={() => setKind("final")}
            >
              Final
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Final files unlock for the client once the balance is paid. A new
          upload is a revision — existing files can&apos;t be replaced.
        </p>
      </div>

      {pending ? (
        <div className="space-y-2">
          <Progress
            value={progress}
            status={phase === "recording" ? "success" : "active"}
          />
          <p className="text-xs text-muted-foreground">
            {phase === "uploading" ? "Uploading…" : "Recording the delivery…"}
          </p>
        </div>
      ) : null}

      {delivery && phase === "done" ? (
        <div className="space-y-1 rounded-lg border border-status-fully-paid/30 bg-status-fully-paid/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <CheckIcon className="size-4 text-status-fully-paid" />
            Uploaded {delivery.filename}
          </p>
          <p className="font-mono text-xs break-all text-muted-foreground">
            SHA-256 {delivery.sha256}
          </p>
          <p className="text-xs text-muted-foreground">
            Logged at {stampFormatter.format(new Date(delivery.loggedAt))}
          </p>
        </div>
      ) : null}

      <Button
        type="button"
        size="lg"
        className="w-full justify-center"
        disabled={!file || pending}
        onClick={handleSubmit}
      >
        {pending ? "Uploading…" : "Upload delivery"}
      </Button>
    </section>
  );
}

export { CommissionDeliveryUpload };
