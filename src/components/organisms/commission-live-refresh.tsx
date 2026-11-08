"use client";

import * as React from "react";
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
  const invoiceOut =
    status.deposit.status === "sent" || status.balance.status === "sent";

  const checkStatus =
    React.useCallback(async (): Promise<LiveStatus | null> => {
      if (document.visibilityState !== "visible") return null;
      if (invoiceOut) {
        await fetch(`/api/commissions/${commissionId}/refresh-payment`, {
          method: "POST",
        }).catch(() => null);
      }
      const response = await fetch(`/api/commissions/${commissionId}/status`, {
        cache: "no-store",
      });
      return response.ok ? ((await response.json()) as LiveStatus) : null;
    }, [commissionId, invoiceOut]);

  usePolling<LiveStatus | null>({
    enabled: !FINISHED.includes(status.state),
    intervalMs: POLL_MS,
    poll: checkStatus,
    onData: (next) => {
      if (next && keyOf(next) !== shown) router.refresh();
    },
  });

  React.useEffect(() => {
    if (FINISHED.includes(status.state)) return;
    function onVisible() {
      if (document.visibilityState === "visible") {
        void checkStatus().then((next) => {
          if (next && keyOf(next) !== shown) router.refresh();
        });
      }
    }
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status.state, checkStatus, shown, router]);

  return null;
}
