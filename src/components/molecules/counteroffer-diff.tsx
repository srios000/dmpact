"use client";

import * as React from "react";
import { ArrowRightIcon } from "lucide-react";
import { SERVICE_LABELS, type Agreement } from "@/lib/schema/agreement";
import { cn } from "@/lib/utils";

export type AgreementChange = {
  label: string;
  before: string;
  after: string;
};

function money(
  amount: string | null | undefined,
  currency: string | null | undefined,
): string {
  if (!amount) return "—";
  return currency ? `${amount} ${currency}` : amount;
}

function serviceText(agreement: Agreement): string {
  if (agreement.service_type === "other") {
    return `Other — ${agreement.service_other ?? ""}`;
  }
  return SERVICE_LABELS[agreement.service_type];
}

function deliverablesText(agreement: Agreement): string {
  return agreement.deliverables.map((d) => d.description).join(", ");
}

function depositText(agreement: Agreement): string {
  const { deposit } = agreement;
  if (deposit.type === "none") return "No deposit";
  if (deposit.type === "percent") {
    const pct = deposit.percent ?? 0;
    return deposit.amount
      ? `${pct}% (${money(deposit.amount, agreement.price.currency)})`
      : `${pct}%`;
  }
  return deposit.fixed_amount
    ? money(deposit.fixed_amount, agreement.price.currency)
    : "—";
}

function revisionsText(agreement: Agreement): string {
  return agreement.revisions.included === null
    ? "Not stated"
    : `${agreement.revisions.included}`;
}

function yesNo(value: boolean | null | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Not stated";
}

function push(
  changes: AgreementChange[],
  label: string,
  before: string,
  after: string,
) {
  if (before !== after) changes.push({ label, before, after });
}

export function diffAgreement(
  current: Agreement,
  proposed: Agreement,
): AgreementChange[] {
  const changes: AgreementChange[] = [];
  push(changes, "Service", serviceText(current), serviceText(proposed));
  push(
    changes,
    "Deliverables",
    deliverablesText(current),
    deliverablesText(proposed),
  );
  push(
    changes,
    "Price",
    money(current.price.total, current.price.currency),
    money(proposed.price.total, proposed.price.currency),
  );
  push(changes, "Deposit", depositText(current), depositText(proposed));
  push(
    changes,
    "Balance",
    money(current.balance_amount, current.price.currency),
    money(proposed.balance_amount, proposed.price.currency),
  );
  push(changes, "Revisions", revisionsText(current), revisionsText(proposed));
  push(
    changes,
    "Commercial use",
    yesNo(current.usage_rights?.commercial),
    yesNo(proposed.usage_rights?.commercial),
  );
  push(
    changes,
    "Credit required",
    yesNo(current.usage_rights?.credit_required),
    yesNo(proposed.usage_rights?.credit_required),
  );
  return changes;
}

export interface CounterofferDiffProps {
  current: Agreement;
  proposed: Agreement;
  className?: string;
}

function CounterofferDiff({
  current,
  proposed,
  className,
}: CounterofferDiffProps) {
  const changes = diffAgreement(current, proposed);

  if (changes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No agreement changes.</p>
    );
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {changes.map((change) => (
        <li key={change.label} className="space-y-0.5 text-sm">
          <p className="text-xs font-medium text-muted-foreground">
            {change.label}
          </p>
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground line-through">
              {change.before}
            </span>
            <ArrowRightIcon
              className="size-3.5 text-muted-foreground"
              aria-hidden
            />
            <span className="font-medium text-foreground">{change.after}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

export { CounterofferDiff };
