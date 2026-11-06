import * as React from "react";
import { DownloadIcon, LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CommissionState } from "@/lib/state-machine/rules";
import { cn } from "@/lib/utils";

export type ClientDownload = {
  id: string;
  filename: string;
  sizeBytes: number;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

export interface CommissionClientDownloadsProps extends React.HTMLAttributes<HTMLElement> {
  state: CommissionState;
  clientToken: string | null;
  downloads: ClientDownload[];
}

function CommissionClientDownloads({
  className,
  state,
  clientToken,
  downloads,
  ...props
}: CommissionClientDownloadsProps) {
  const unlocked = state === "fully_paid";

  return (
    <section
      className={cn("space-y-4 rounded-xl border bg-card p-5", className)}
      {...props}
    >
      <header className="space-y-1">
        <h2 className="font-medium text-foreground">Client downloads</h2>
        <p className="text-sm text-muted-foreground">
          The final files the client can download from their agreement link.
        </p>
      </header>

      {!clientToken ? (
        <p className="text-sm text-muted-foreground">
          Send the agreement to the client first. Their link appears here.
        </p>
      ) : !unlocked ? (
        <div className="flex items-start gap-2 rounded-lg border bg-background p-3">
          <LockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Unlocks once the balance is fully paid.
          </p>
        </div>
      ) : downloads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No final files logged yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {downloads.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-lg border bg-background p-3"
            >
              <DownloadIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  {file.filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(file.sizeBytes)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {clientToken ? (
        <Button
          size="lg"
          variant="outline"
          className="w-full"
          nativeButton={false}
          render={
            <a href={`/a/${clientToken}`} target="_blank" rel="noreferrer" />
          }
        >
          <DownloadIcon data-icon="inline-start" />
          Open client view
        </Button>
      ) : null}
    </section>
  );
}

export { CommissionClientDownloads };
