import Link from "next/link"
import { ArrowLeftIcon, CalendarIcon, CreditCardIcon, WalletIcon } from "lucide-react"
import { notFound } from "next/navigation"
import { PageShell } from "@/components/templates/page-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { CommissionTimeline } from "@/components/organisms/commission-timeline"
import { CommissionActions } from "@/components/organisms/commission-actions"
import { CommissionInvoices } from "@/components/organisms/commission-invoices"
import { CommissionDeliveries } from "@/components/organisms/commission-deliveries"
import { getCommissionDetailById } from "@/app/queue/queue-data"
import { cn } from "@/lib/utils"

export default async function QueueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const commission = getCommissionDetailById(id)

  if (!commission) {
    notFound()
  }

  const depositInvoice = commission.invoices.find((invoice) => invoice.kind === "deposit")
  const balanceInvoice = commission.invoices.find((invoice) => invoice.kind === "balance")

  const summary = [
    {
      label: "Total",
      value: `${commission.currency} ${commission.total}`,
      hint: commission.service,
      icon: WalletIcon,
    },
    {
      label: "Deadline",
      value: commission.deadline,
      hint:
        commission.daysLeft < 0
          ? `${Math.abs(commission.daysLeft)} days overdue`
          : `${commission.daysLeft} days left`,
      icon: CalendarIcon,
    },
    {
      label: "Deposit",
      value: `${commission.currency} ${depositInvoice?.amount ?? "0.00"}`,
      hint: "50% deposit",
      icon: CreditCardIcon,
    },
    {
      label: "Balance",
      value: `${commission.currency} ${balanceInvoice?.amount ?? "0.00"}`,
      hint: "50% balance",
      icon: CreditCardIcon,
    },
  ]

  return (
    <PageShell
      title={commission.client}
      description={`${commission.service} · commission ${commission.id}`}
      actions={
        <Link
          href="/queue"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-9 gap-2 rounded-xl border-border bg-card px-4 text-[12px] font-bold"
          )}
        >
          <ArrowLeftIcon className="size-4" />
          Back to queue
        </Link>
      }
    >
      <Card className="rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 p-6 pb-4 md:p-8 md:pb-4">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
              <WalletIcon className="size-6" />
            </div>
            <div>
              <CardTitle className="text-[22px] font-black tracking-tight text-foreground">
                {commission.service}
              </CardTitle>
              <p className="mt-1 text-[13px] font-medium text-muted-foreground">
                Commission {commission.id}
              </p>
            </div>
          </div>
          <StatusBadge state={commission.state} />
        </CardHeader>
        <CardContent className="grid gap-4 p-6 pt-0 sm:grid-cols-2 md:p-8 md:pt-0 xl:grid-cols-4">
          {summary.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-4 rounded-[28px] border border-border bg-background p-5"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <item.icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                  {item.label}
                </p>
                <p className="mt-1.5 truncate text-[20px] font-black tracking-tight text-foreground">
                  {item.value}
                </p>
                <p className="mt-0.5 truncate text-[12px] font-medium text-muted-foreground">
                  {item.hint}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid items-start gap-8 lg:grid-cols-12">
        <div className="grid gap-8 lg:col-span-7">
          <CommissionTimeline events={commission.events} />
          <CommissionDeliveries deliveries={commission.deliveries} />
        </div>

        <div className="grid gap-8 lg:col-span-5">
          <CommissionActions commission={commission} />
          <CommissionInvoices invoices={commission.invoices} />
        </div>
      </div>
    </PageShell>
  )
}
