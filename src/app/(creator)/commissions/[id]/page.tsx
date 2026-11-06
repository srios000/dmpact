import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { CommissionActions } from "@/components/organisms/commission-actions";
import { CommissionClientDownloads } from "@/components/organisms/commission-client-downloads";
import { CommissionDeliveries } from "@/components/organisms/commission-deliveries";
import { CommissionInvoices } from "@/components/organisms/commission-invoices";
import { CommissionLiveRefresh } from "@/components/organisms/commission-live-refresh";
import { CommissionMessages } from "@/components/organisms/commission-messages";
import { CommissionSummary } from "@/components/organisms/commission-summary";
import { CommissionTimeline } from "@/components/organisms/commission-timeline";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { todayInZone } from "@/lib/ai/extract";
import { daysLeft, deadlineTone } from "@/lib/queue/queue";
import { getCommission } from "@/lib/repositories/commission-repository";
import {
  agreementEditMode,
  type AgreementEditMode,
} from "@/lib/state-machine/agreement-edits";
import type { CommissionState } from "@/lib/state-machine/rules";
import { AgreementEditor } from "./_components/agreement-editor";
import { runReminder, transitionCommission } from "./actions";

export const instant = false;
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Commission | DMpact",
  robots: { index: false, follow: false },
};

function describe(state: CommissionState, mode: AgreementEditMode): string {
  if (mode === "deadline") {
    return "The client approved this agreement. Only the deadline can change now, until you deliver.";
  }
  if (mode === "locked") {
    return "This agreement can't change any more.";
  }
  return state === "draft"
    ? "Change anything, save it as a new version, then send it to the client."
    : "Sent to the client. They see the latest version you save, and you can change anything until they approve.";
}

export default async function CommissionDetailPage({
  params,
}: PageProps<"/commissions/[id]">) {
  const { id } = await params;
  const commission = await getCommission(id);
  if (!commission) notFound();

  const today = todayInZone();
  const mode = agreementEditMode(commission.state);
  const title =
    commission.versions[commission.versions.length - 1]?.agreement.title ||
    "Untitled commission";
  const downloads = commission.deliveries
    .filter((delivery) => delivery.isFinal)
    .map((delivery) => ({
      id: delivery.id,
      filename: delivery.filename,
      sizeBytes: delivery.sizeBytes,
    }));

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 md:px-12 md:py-10">
      <CommissionLiveRefresh
        commissionId={commission.id}
        status={{
          state: commission.state,
          updatedAt: commission.updatedAt,
          deposit: { status: commission.deposit.status },
          balance: { status: commission.balance.status },
        }}
      />
      <div className="space-y-4">
        <Button
          size="sm"
          variant="ghost"
          className="-ml-2"
          nativeButton={false}
          render={<Link href="/commissions" />}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Back to queue
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <StatusBadge state={commission.state} />
        </div>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          {describe(commission.state, mode)}
        </p>
      </div>

      <CommissionSummary
        total={commission.total}
        currency={commission.currency}
        serviceType={commission.serviceType}
        deadline={commission.deadline}
        daysLeft={daysLeft(commission, today)}
        deadlineTone={deadlineTone(commission, today)}
        deposit={commission.deposit}
        balance={commission.balance}
        today={today}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <CommissionTimeline events={commission.events} />
          <CommissionInvoices invoices={commission.invoices} today={today} />
          <CommissionDeliveries deliveries={commission.deliveries} />
          <CommissionMessages
            sourceDm={commission.sourceDm}
            followUpDms={commission.followUpDms}
            changeRequests={commission.changeRequests}
          />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20">
          <CommissionActions
            commissionId={commission.id}
            state={commission.state}
            deposit={commission.deposit}
            balance={commission.balance}
            transition={transitionCommission}
            runReminder={runReminder}
          />
          <CommissionClientDownloads
            state={commission.state}
            clientToken={commission.clientToken}
            downloads={downloads}
          />
        </aside>
      </div>

      <section aria-labelledby="agreement-heading" className="space-y-4">
        <div className="space-y-1">
          <h2
            id="agreement-heading"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            Agreement
          </h2>
          <p className="text-sm text-muted-foreground">
            Edit the agreement, save new versions and send it to the client.
          </p>
        </div>
        <AgreementEditor commission={commission} mode={mode} today={today} />
      </section>
    </div>
  );
}
