import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { CommissionQueue } from "@/components/organisms/commission-queue";
import { Button } from "@/components/ui/button";
import { todayInZone } from "@/lib/ai/extract";
import { listCommissions } from "@/lib/repositories/commission-repository";
import { retryDeposit, startWork } from "./actions";

export const instant = false;

export const metadata: Metadata = {
  title: "Queue | DMpact",
};

export default async function CommissionsPage() {
  const rows = await listCommissions();

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Queue
          </h1>
          <p className="text-muted-foreground">
            Every commission, what&apos;s owed and what&apos;s due.
          </p>
        </div>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/commissions/new" />}
        >
          <PlusIcon data-icon="inline-start" />
          New commission
        </Button>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="font-medium text-foreground">No commissions yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a client&apos;s DM to create your first one.
          </p>
        </div>
      ) : (
        <CommissionQueue
          rows={rows}
          today={todayInZone()}
          startWork={startWork}
          retryDeposit={retryDeposit}
        />
      )}
    </div>
  );
}
