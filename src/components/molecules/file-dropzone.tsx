"use client";

import * as React from "react";
import { cva } from "class-variance-authority";
import { FileBoxIcon, UploadIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatSize } from "@/lib/utils";

const zoneVariants = cva(
  "flex min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors focus-within:ring-2 focus-within:ring-ring",
  {
    variants: {
      dragging: {
        true: "border-primary bg-primary/5",
        false: "border-border bg-muted/30 hover:border-input hover:bg-muted/50",
      },
      disabled: {
        true: "pointer-events-none opacity-50",
        false: "",
      },
    },
    defaultVariants: {
      dragging: false,
      disabled: false,
    },
  },
);

export interface FileDropzoneProps {
  file: File | null;
  onSelect: (file: File) => void;
  onClear: () => void;
  accept?: string;
  disabled?: boolean;
  className?: string;
}

function FileDropzone({
  file,
  onSelect,
  onClear,
  accept,
  disabled,
  className,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  function handleFiles(files: FileList | null) {
    const next = files?.[0];
    if (next) onSelect(next);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {file ? (
        <div className="flex items-center gap-3 rounded-xl border bg-background p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground">
            <FileBoxIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatSize(file.size)} · {file.type || "unknown type"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${file.name}`}
            onClick={onClear}
          >
            <XIcon />
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          className={zoneVariants({ dragging, disabled })}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(event) => {
            if (!disabled && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!disabled) handleFiles(event.dataTransfer.files);
          }}
        >
          <UploadIcon className="size-6 text-muted-foreground" />
          <p className="text-sm text-foreground">
            Drag a file here or <span className="text-primary">browse</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Image, video, audio, PSD, PDF or ZIP, up to 25 MB
          </p>
        </div>
      )}
    </div>
  );
}

export { FileDropzone };
