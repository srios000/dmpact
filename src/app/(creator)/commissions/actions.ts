"use server";

import type { ActionResult } from "@/lib/repositories/action-result";
import type { TransitionResult } from "@/lib/state-machine/transition";
import { transitionCommission } from "./[id]/actions";

export async function startWork(
  commissionId: string,
): Promise<ActionResult<TransitionResult>> {
  return transitionCommission({ commissionId, to: "in_progress" });
}
