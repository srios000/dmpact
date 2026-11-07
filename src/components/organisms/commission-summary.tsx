import * as React from "react";
import { cva } from "class-variance-authority";
import { DaysLeft } from "@/components/ui/days-left";
import { PaymentBadge } from "@/components/ui/payment-badge";
import {
  paymentLabel,
  paymentTone,
  type DeadlineTone,
} from "@/lib/queue/queue";
import { SERVICE_LABELS, type ServiceType } from "@/lib/schema/agreement";
import { cn } from "@/lib/utils";

export type SummaryPayment = {
  status:
    "not_required" | "not_created" | "draft" | "sent" | "paid" | "cancelled";
  amount: string | null;
  dueDate: string | null;
};

const valueVariants = cva(
  "text-2xl font-semibold tracking-tight tabular-nums",
  {
    variants: {
      tone: {
        default: "text-foreground",
        quiet: "text-muted-foreground",
      },
    },
    defaultVariants: {
      tone: "default",
    },
  },
);

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string | null): string | null {
  return value ? dateFormatter.format(new Date(`${value}T00:00:00Z`)) : null;
}

function money(currency: string | null, amount: string | null): string {
  if (!amount) return "Not set";
  return currency ? `${currency} ${amount}` : amount;
}

function isLate(payment: SummaryPayment, today: string): boolean {
  return (
    payment.status === "sent" &&
    payment.dueDate !== null &&
    payment.dueDate < today
  );
}

function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: React.ReactNode;
  tone?: "default" | "quiet";
}) {
  return (
    <div className="min-w-0 space-y-1 px-4 py-4 sm:px-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={valueVariants({ tone })}>{value}</dd>
      {detail ? (
        <dd className="text-sm text-muted-foreground">{detail}</dd>
      ) : null}
    </div>
  );
}

export interface CommissionSummaryProps extends React.HTMLAttributes<HTMLDListElement> {
  total: string | null;
  currency: string | null;
  serviceType: string;
  deadline: string | null;
  daysLeft: number | null;
  deadlineTone: DeadlineTone;
  deposit: SummaryPayment;
  balance: SummaryPayment;
  today: string;
}

function PaymentLine({
  payment,
  today,
}: {
  payment: SummaryPayment;
  today: string;
}) {
  const late = isLate(payment, today);
  return (
    <PaymentBadge tone={paymentTone(payment, late)}>
      {paymentLabel(payment, late)}
    </PaymentBadge>
  );
}

function CommissionSummary({
  className,
  total,
  currency,
  serviceType,
  deadline,
  daysLeft,
  deadlineTone,
  deposit,
  balance,
  today,
  ...props
}: CommissionSummaryProps) {
  const service =
    SERVICE_LABELS[serviceType as ServiceType] ?? serviceType ?? "Commission";

  return (
    <dl
      className={cn(
        "grid grid-cols-2 divide-border rounded-xl border bg-card sm:grid-cols-4 sm:divide-x",
        className,
      )}
      {...props}
    >
      <Stat
        label="Total"
        value={money(currency, total)}
        detail={service}
        tone={total ? "default" : "quiet"}
      />
      <Stat
        label="Deadline"
        value={formatDate(deadline) ?? "Not set"}
        detail={
          deadline ? (
            <DaysLeft days={daysLeft} tone={deadlineTone} />
          ) : undefined
        }
        tone={deadline ? "default" : "quiet"}
      />
      <Stat
        label="Deposit"
        value={money(currency, deposit.amount)}
        detail={<PaymentLine payment={deposit} today={today} />}
        tone={deposit.amount ? "default" : "quiet"}
      />
      <Stat
        label="Balance"
        value={money(currency, balance.amount)}
        detail={<PaymentLine payment={balance} today={today} />}
        tone={balance.amount ? "default" : "quiet"}
      />
    </dl>
  );
}

export { CommissionSummary };
