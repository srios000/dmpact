"use server";

import { updateTag } from "next/cache";
import { todayInZone } from "@/lib/ai/extract";
import { createGeminiClient } from "@/lib/ai/gemini";
import {
  generateCounteroffers,
  type CounterofferResult,
} from "@/lib/ai/negotiate/counteroffers";
import { env } from "@/lib/env";
import * as agreements from "@/lib/repositories/agreement-repository";
import * as commissions from "@/lib/repositories/commission-repository";
import * as deliveries from "@/lib/repositories/delivery-repository";
import * as disputes from "@/lib/repositories/dispute-repository";
import * as overdue from "@/lib/repositories/overdue-repository";
import { getRateCard } from "@/lib/repositories/rate-card-repository";
import { notFound } from "@/lib/repositories/shared";
import {
  invalidInput,
  toActionFailure,
  type ActionResult,
} from "@/lib/repositories/action-result";
import { RepositoryError } from "@/lib/repositories/errors";
import {
  retryBalanceInvoiceSchema,
  retryDepositInvoiceSchema,
  listDisputesSchema,
  runReminderSchema,
  sendDisputeEvidenceSchema,
  saveAgreementVersionSchema,
  sendToClientSchema,
  suggestCounteroffersSchema,
  transitionCommissionSchema,
  type RetryBalanceInvoiceInput,
  type RetryDepositInvoiceInput,
  type ListDisputesInput,
  type RunReminderInput,
  type SendDisputeEvidenceInput,
  type SaveAgreementVersionInput,
  type SendToClientInput,
  type SuggestCounteroffersInput,
  type TransitionCommissionInput,
} from "@/lib/schema/commission-forms";
import {
  createDeliveryUploadSchema,
  recordDeliverySchema,
  type CreateDeliveryUploadInput,
  type RecordDeliveryInput,
} from "@/lib/schema/delivery";
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
      today: todayInZone(),
      // createGeminiClient reads the key and model from the environment.
      client: env.GEMINI_API_KEY ? createGeminiClient() : null,
    });
    return { ok: true, data };
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function retryDepositInvoice(
  input: RetryDepositInvoiceInput,
): Promise<
  ActionResult<Awaited<ReturnType<typeof commissions.retryDepositInvoice>>>
> {
  const parsed = retryDepositInvoiceSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const data = await commissions.retryDepositInvoice(
      parsed.data.commissionId,
    );
    refresh(parsed.data.commissionId);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "invoice_failed") {
      refresh(parsed.data.commissionId);
    }
    return toActionFailure(error);
  }
}

export async function retryBalanceInvoice(
  input: RetryBalanceInvoiceInput,
): Promise<
  ActionResult<Awaited<ReturnType<typeof commissions.retryBalanceInvoice>>>
> {
  const parsed = retryBalanceInvoiceSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const data = await commissions.retryBalanceInvoice(
      parsed.data.commissionId,
    );
    refresh(parsed.data.commissionId);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "invoice_failed") {
      refresh(parsed.data.commissionId);
    }
    return toActionFailure(error);
  }
}

/**
 * "Run reminder" (demo trigger for #18): reminds this commission's overdue
 * invoices now, with the same once-a-day limit as the daily job, and returns
 * the newest nudge to copy.
 */
export async function runReminder(
  input: RunReminderInput,
): Promise<ActionResult<{ reminded: number; nudge: overdue.Nudge | null }>> {
  const parsed = runReminderSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const { outcomes, nudge } = await overdue.runCommissionReminder(
      parsed.data.commissionId,
      // createGeminiClient reads the key and model from the environment.
      { model: env.GEMINI_API_KEY ? createGeminiClient() : null },
    );
    const reminded = outcomes.filter((o) => o.status === "reminded").length;
    if (reminded > 0) refresh(parsed.data.commissionId);
    return { ok: true, data: { reminded, nudge } };
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function createDeliveryUpload(
  input: CreateDeliveryUploadInput,
): Promise<
  ActionResult<Awaited<ReturnType<typeof deliveries.createDeliveryUpload>>>
> {
  const parsed = createDeliveryUploadSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    return {
      ok: true,
      data: await deliveries.createDeliveryUpload(parsed.data),
    };
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function recordDelivery(
  input: RecordDeliveryInput,
): Promise<
  ActionResult<Awaited<ReturnType<typeof deliveries.recordDelivery>>>
> {
  const parsed = recordDeliverySchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const data = await deliveries.recordDelivery(parsed.data);
    refresh(parsed.data.commissionId);
    return { ok: true, data };
  } catch (error) {
    return toActionFailure(error);
  }
}

/** PayPal disputes on this commission's paid invoices (stretch #21). */
export async function listDisputes(
  input: ListDisputesInput,
): Promise<ActionResult<disputes.CommissionDispute[]>> {
  const parsed = listDisputesSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    return {
      ok: true,
      data: await disputes.listCommissionDisputes(parsed.data.commissionId),
    };
  } catch (error) {
    return toActionFailure(error);
  }
}

/** Uploads the evidence pack PDF to a PayPal dispute on this commission. */
export async function sendDisputeEvidence(
  input: SendDisputeEvidenceInput,
): Promise<ActionResult<disputes.CommissionDispute>> {
  const parsed = sendDisputeEvidenceSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const dispute = await disputes.sendDisputeEvidence(
      parsed.data.commissionId,
      parsed.data.disputeId,
    );
    refresh(parsed.data.commissionId);
    return { ok: true, data: dispute };
  } catch (error) {
    return toActionFailure(error);
  }
}
