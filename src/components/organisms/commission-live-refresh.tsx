"use client";

import { useRouter } from "next/navigation";
import { usePolling } from "@/hooks/use-polling";
import type { PaymentStatus } from "@/lib/repositories/shared";
import type { CommissionState } from "@/lib/state-machine/rules";

type LiveStatus = {
  state: CommissionState;
  updatedAt: string;
  deposit: Pick<PaymentStatus, "status">;
  balance: Pick<PaymentStatus, "status">;
};

const FINISHED: CommissionState[] = ["fully_paid", "cancelled"];
const POLL_MS = 10_000;

function keyOf(status: LiveStatus) {
  return [
    status.state,
    status.updatedAt,
    status.deposit.status,
    status.balance.status,
  ].join("|");
}

export function CommissionLiveRefresh({
  commissionId,
  status,
}: {
  commissionId: string;
  status: LiveStatus;
}) {
  const router = useRouter();
  const shown = keyOf(status);

  usePolling<LiveStatus | null>({
    enabled: !FINISHED.includes(status.state),
    intervalMs: POLL_MS,
    poll: async () => {
      if (document.visibilityState !== "visible") return null;
      const response = await fetch(`/api/commissions/${commissionId}/status`, {
        cache: "no-store",
      });
      return response.ok ? ((await response.json()) as LiveStatus) : null;
    },
    onData: (next) => {
      if (next && keyOf(next) !== shown) router.refresh();
    },
  });

  return null;
}
