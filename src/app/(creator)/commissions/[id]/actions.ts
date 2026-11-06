"use server";

import { updateTag } from "next/cache";
import { createGeminiClient } from "@/lib/ai/gemini";
import {
  generateCounteroffers,
  type CounterofferResult,
} from "@/lib/ai/negotiate/counteroffers";
import { env } from "@/lib/env";
import * as agreements from "@/lib/repositories/agreement-repository";
import * as commissions from "@/lib/repositories/commission-repository";
import { getRateCard } from "@/lib/repositories/rate-card-repository";
import { notFound } from "@/lib/repositories/shared";
import {
  invalidInput,
  toActionFailure,
  type ActionResult,
} from "@/lib/repositories/action-result";
import {
  saveAgreementVersionSchema,
  sendToClientSchema,
  suggestCounteroffersSchema,
  transitionCommissionSchema,
  type SaveAgreementVersionInput,
  type SendToClientInput,
  type SuggestCounteroffersInput,
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

/** Today's date (YYYY-MM-DD) in WIB, for the rush fee. */
function todayInJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date(),
  );
}

/** Proposals only: nothing is saved until the creator applies an option. */
export async function suggestCounteroffers(
  input: SuggestCounteroffersInput,
): Promise<ActionResult<CounterofferResult>> {
  const parsed = suggestCounteroffersSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const commission = await commissions.getCommission(
      parsed.data.commissionId,
    );
    if (!commission) throw notFound();

    const latest = commission.versions[commission.versions.length - 1];
    const data = await generateCounteroffers({
      agreement: latest.agreement,
      settings: await getRateCard(),
      today: todayInJakarta(),
      // createGeminiClient reads the key and model from the environment.
      client: env.GEMINI_API_KEY ? createGeminiClient() : null,
    });
    return { ok: true, data };
  } catch (error) {
    return toActionFailure(error);
  }
}
