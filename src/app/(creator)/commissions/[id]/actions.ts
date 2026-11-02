"use server";

import { updateTag } from "next/cache";
import * as agreements from "@/lib/repositories/agreement-repository";
import * as commissions from "@/lib/repositories/commission-repository";
import {
  invalidInput,
  toActionFailure,
  type ActionResult,
} from "@/lib/repositories/action-result";
import {
  saveAgreementVersionSchema,
  sendToClientSchema,
  transitionCommissionSchema,
  type SaveAgreementVersionInput,
  type SendToClientInput,
  type TransitionCommissionInput,
} from "@/lib/schema/commission-forms";
import type { TransitionResult } from "@/lib/state-machine/transition";

function refresh(commissionId: string) {
  updateTag("commissions");
  updateTag(`commission-${commissionId}`);
}

export async function saveAgreementVersion(
  input: SaveAgreementVersionInput,
): Promise<ActionResult<{ version: number; contentHash: string }>> {
  const parsed = saveAgreementVersionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const data = await agreements.saveAgreementVersion(parsed.data);
    refresh(parsed.data.commissionId);
    return { ok: true, data };
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function sendToClient(
  input: SendToClientInput,
): Promise<ActionResult<{ token: string }>> {
  const parsed = sendToClientSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const data = await commissions.sendToClient(parsed.data);
    refresh(parsed.data.commissionId);
    return { ok: true, data };
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function transitionCommission(
  input: TransitionCommissionInput,
): Promise<ActionResult<TransitionResult>> {
  const parsed = transitionCommissionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const data = await commissions.transitionCommission(parsed.data);
    refresh(parsed.data.commissionId);
    return { ok: true, data };
  } catch (error) {
    return toActionFailure(error);
  }
}
