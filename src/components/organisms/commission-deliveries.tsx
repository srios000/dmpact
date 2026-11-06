import * as React from "react";
import { cva } from "class-variance-authority";
import { FileBoxIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type CommissionDelivery = {
  id: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  isFinal: boolean;
  loggedAt: string;
};

const kindVariants = cva(
  "inline-flex h-5 items-center rounded-full border px-2 text-xs whitespace-nowrap",
  {
    variants: {
      kind: {
        final:
          "border-status-fully-paid/30 bg-status-fully-paid/10 text-foreground",
        preview: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      kind: "preview",
    },
  },
);

const stampFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

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

export interface CommissionDeliveriesProps extends React.HTMLAttributes<HTMLElement> {
  deliveries: CommissionDelivery[];
}

function CommissionDeliveries({
  className,
  deliveries,
  ...props
}: CommissionDeliveriesProps) {
  return (
    <section
      className={cn("space-y-4 rounded-xl border bg-card p-5", className)}
      {...props}
    >
      <header className="space-y-1">
        <h2 className="font-medium text-foreground">Deliveries</h2>
        <p className="text-sm text-muted-foreground">
          Append-only evidence: each file with its SHA-256 fingerprint and
          timestamp.
        </p>
      </header>
      {deliveries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No deliveries logged yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {deliveries.map((delivery) => (
            <li
              key={delivery.id}
              className="flex items-start gap-3 rounded-lg border bg-background p-4"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground">
                <FileBoxIcon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {delivery.filename}
                  </p>
                  <span
                    className={kindVariants({
                      kind: delivery.isFinal ? "final" : "preview",
                    })}
                  >
                    {delivery.isFinal ? "Final" : "Preview"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatSize(delivery.sizeBytes)} · {delivery.mimeType} ·{" "}
                  {stampFormatter.format(new Date(delivery.loggedAt))}
                </p>
                <p className="font-mono text-xs break-all text-muted-foreground">
                  SHA-256 {delivery.sha256}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export { CommissionDeliveries };
