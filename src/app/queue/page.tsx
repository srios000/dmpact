import Link from "next/link"
import { Clock3Icon, CreditCardIcon, PlusIcon, WalletIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { PageShell } from "@/components/templates/page-shell"
import { CommissionQueueTable } from "@/components/organisms/commission-queue-table"
import { commissionRows, getQueueSummary } from "@/app/queue/queue-data"
import { cn } from "@/lib/utils"

export default function QueuePage() {
  const summary = getQueueSummary(commissionRows)

  return (
    <PageShell
      title="Commission Queue"
      description="Every commission at a glance, with payment progress and deadline pressure in one place."
      actions={
        <Link
          href="/new"
          className={cn(
            buttonVariants({ variant: "default" }),
            "h-9 gap-2 rounded-xl px-4 text-[12px] font-bold"
          )}
        >
          <PlusIcon className="size-4" /> New commission
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-3xl bg-blue-50 p-3 text-blue-700">
              <WalletIcon className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                Money Outstanding
              </p>
              <p className="mt-2 text-[28px] font-black tracking-tight text-foreground">
                USD {summary.outstanding}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-3xl bg-orange-50 p-3 text-orange-700">
              <CreditCardIcon className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                Deposits Pending
              </p>
              <p className="mt-2 text-[28px] font-black tracking-tight text-foreground">
                {summary.depositsPending}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-3xl bg-emerald-50 p-3 text-emerald-700">
              <Clock3Icon className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                Due This Week
              </p>
              <p className="mt-2 text-[28px] font-black tracking-tight text-foreground">
                {summary.dueThisWeek}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]">
        <CardHeader className="flex flex-row items-center justify-between p-6 pb-6 md:p-8 md:pb-6">
          <div className="flex items-center gap-3">
            <CardTitle className="text-[17px] font-black tracking-tight text-foreground uppercase">
              All Commissions
            </CardTitle>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
              {commissionRows.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <CommissionQueueTable
            rows={commissionRows}
            emptyAction={
              <Link
                href="/new"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "h-9 gap-2 rounded-xl px-4 text-[12px] font-bold"
                )}
              >
                <PlusIcon className="size-4" /> New commission
              </Link>
            }
          />
        </CardContent>
      </Card>
    </PageShell>
  )
}
