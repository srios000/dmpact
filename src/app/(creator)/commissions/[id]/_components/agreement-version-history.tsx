"use client";

import * as React from "react";
import { CheckIcon, CircleIcon, HistoryIcon, LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { getCommission } from "@/lib/repositories/commission-repository";

type CommissionDetail = NonNullable<Awaited<ReturnType<typeof getCommission>>>;
type VersionItem = CommissionDetail["versions"][number];

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

function isConfirmedBy(version: VersionItem, party: "creator" | "client") {
  return version.confirmations.some(
    (c) => c.party === party && c.contentHash === version.contentHash,
  );
}

export interface AgreementVersionHistoryProps extends React.HTMLAttributes<HTMLDivElement> {
  versions: VersionItem[];
  selectedVersion: number;
  inForceVersion: number | null;
  onSelectVersion: (version: number) => void;
}

function AgreementVersionHistory({
  className,
  versions,
  selectedVersion,
  inForceVersion,
  onSelectVersion,
  ...props
}: AgreementVersionHistoryProps) {
  const ordered = React.useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions],
  );

  return (
    <div className={cn("flex flex-col", className)} {...props}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-slate-400">
          <HistoryIcon className="size-4" />
          <span className="text-[10px] font-black tracking-[0.2em] uppercase">
            Version history
          </span>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-slate-300">
          {versions.length}
        </span>
      </div>

      <div className="mt-4 max-h-[420px] overflow-y-auto pr-3">
        <ol className="flex flex-col gap-3">
          {ordered.map((version) => {
            const isSelected = version.version === selectedVersion;
            const inForce = version.version === inForceVersion;
            const creatorConfirmed = isConfirmedBy(version, "creator");
            const clientConfirmed = isConfirmedBy(version, "client");

            return (
              <li key={version.id}>
                <button
                  type="button"
                  onClick={() => onSelectVersion(version.version)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition-all",
                    isSelected
                      ? "border-[#FF3B8E]/40 bg-[#FF3B8E]/10 shadow-lg shadow-[#FF3B8E]/10"
                      : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-sm font-black",
                          isSelected ? "text-[#FF3B8E]" : "text-white",
                        )}
                      >
                        v{version.version}
                      </span>
                      {inForce ? (
                        <span className="flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-black tracking-wider text-emerald-400 uppercase">
                          <LockIcon className="size-2.5" />
                          In force
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      {version.createdBy}
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-1 text-sm font-bold text-white">
                    {version.agreement.title}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    {formatDate(version.createdAt)}
                  </p>

                  <div className="mt-3 flex items-center gap-3">
                    <span
                      className={cn(
                        "flex items-center gap-1 text-[10px] font-bold",
                        creatorConfirmed
                          ? "text-emerald-400"
                          : "text-slate-600",
                      )}
                    >
                      {creatorConfirmed ? (
                        <CheckIcon className="size-3" />
                      ) : (
                        <CircleIcon className="size-3" />
                      )}
                      Creator
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1 text-[10px] font-bold",
                        clientConfirmed ? "text-blue-400" : "text-slate-600",
                      )}
                    >
                      {clientConfirmed ? (
                        <CheckIcon className="size-3" />
                      ) : (
                        <CircleIcon className="size-3" />
                      )}
                      Client
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export { AgreementVersionHistory };
