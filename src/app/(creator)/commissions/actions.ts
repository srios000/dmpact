"use server";

import type { ActionResult } from "@/lib/repositories/action-result";
import type { TransitionResult } from "@/lib/state-machine/transition";
import {
  retryBalanceInvoice,
  retryDepositInvoice,
  transitionCommission,
} from "./[id]/actions";

export async function startWork(
  commissionId: string,
): Promise<ActionResult<TransitionResult>> {
  return transitionCommission({ commissionId, to: "in_progress" });
}

export async function retryDeposit(
  commissionId: string,
): Promise<ActionResult<unknown>> {
  return retryDepositInvoice({ commissionId });
}

export async function retryBalance(
  commissionId: string,
): Promise<ActionResult<unknown>> {
  return retryBalanceInvoice({ commissionId });
}
