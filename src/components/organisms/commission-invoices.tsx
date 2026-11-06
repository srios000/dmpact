import * as React from "react";
import { ExternalLinkIcon, ReceiptTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentBadge } from "@/components/ui/payment-badge";
import { cn } from "@/lib/utils";

export type InvoiceStatusValue = "draft" | "sent" | "paid" | "cancelled";

export type CommissionInvoice = {
  id: string;
  kind: "deposit" | "balance";
  status: InvoiceStatusValue;
  paypalInvoiceId: string | null;
  amount: string;
  currency: string;
  dueDate: string | null;
  payLink: string | null;
  paidAt: string | null;
  lastRemindedAt: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string | null): string | null {
  return value ? dateFormatter.format(new Date(value)) : null;
}

function isLate(invoice: CommissionInvoice, today: string): boolean {
  return (
    invoice.status === "sent" &&
    invoice.dueDate !== null &&
    invoice.dueDate < today
  );
}

function statusLabel(status: InvoiceStatusValue, late: boolean): string {
  if (late) return "Overdue";
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Awaiting payment";
    case "paid":
      return "Paid";
    case "cancelled":
      return "Cancelled";
  }
}

function statusTone(
  status: InvoiceStatusValue,
  late: boolean,
): "paid" | "waiting" | "late" | "idle" {
  if (late) return "late";
  if (status === "paid") return "paid";
  if (status === "sent") return "waiting";
  return "idle";
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm text-foreground">{value}</dd>
    </div>
  );
}

function InvoiceCard({
  invoice,
  today,
}: {
  invoice: CommissionInvoice;
  today: string;
}) {
  const late = isLate(invoice, today);
  const due = formatDate(invoice.dueDate);
  const paid = formatDate(invoice.paidAt);
  const reminded = formatDate(invoice.lastRemindedAt);

  return (
    <article className="flex flex-col justify-between gap-4 rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground">
            <ReceiptTextIcon className="size-4" />
          </span>
          <span className="text-sm font-medium text-foreground">
            {invoice.kind === "deposit" ? "Deposit" : "Balance"}
          </span>
        </div>
        <PaymentBadge tone={statusTone(invoice.status, late)}>
          {statusLabel(invoice.status, late)}
        </PaymentBadge>
      </div>

      <p className="text-xl font-semibold tracking-tight text-foreground tabular-nums">
        {invoice.currency} {invoice.amount}
      </p>

      <dl className="space-y-1.5">
        <Detail label="Due" value={due ?? "Not set"} />
        <Detail label="Paid" value={paid ?? "Not yet"} />
        <Detail label="PayPal invoice" value={invoice.paypalInvoiceId ?? "—"} />
        {reminded ? <Detail label="Last reminder" value={reminded} /> : null}
      </dl>

      {invoice.payLink && invoice.status !== "paid" ? (
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<a href={invoice.payLink} target="_blank" rel="noreferrer" />}
        >
          <ExternalLinkIcon data-icon="inline-start" />
          Open invoice
        </Button>
      ) : null}
    </article>
  );
}

export interface CommissionInvoicesProps extends React.HTMLAttributes<HTMLElement> {
  invoices: CommissionInvoice[];
  today: string;
}

function CommissionInvoices({
  className,
  invoices,
  today,
  ...props
}: CommissionInvoicesProps) {
  return (
    <section
      className={cn("space-y-4 rounded-xl border bg-card p-5", className)}
      {...props}
    >
      <header className="space-y-1">
        <h2 className="font-medium text-foreground">Invoices</h2>
        <p className="text-sm text-muted-foreground">
          Deposit and balance tracked through PayPal.
        </p>
      </header>
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No invoices yet. They appear once the agreement is agreed.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {invoices.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} today={today} />
          ))}
        </div>
      )}
    </section>
  );
}

export { CommissionInvoices };
