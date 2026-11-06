"use server";

import { updateTag } from "next/cache";
import { headers } from "next/headers";
import * as agreements from "@/lib/repositories/agreement-repository";
import { requestDeliveryDownload } from "@/lib/repositories/delivery-repository";
import {
  invalidInput,
  toActionFailure,
  type ActionResult,
} from "@/lib/repositories/action-result";
import {
  confirmAgreementSchema,
  requestChangesSchema,
} from "@/lib/schema/commission-forms";
import { deliveryDownloadSchema } from "@/lib/schema/delivery";
import type { CommissionState } from "@/lib/state-machine/rules";

function refresh(commissionId: string) {
  updateTag("commissions");
  updateTag(`commission-${commissionId}`);
}

export async function confirmAgreement(
  token: string,
  versionHash: string,
): Promise<ActionResult<{ state: CommissionState }>> {
  const parsed = confirmAgreementSchema.safeParse({ token, versionHash });
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const { commissionId, state } = await agreements.confirmAgreement(
      parsed.data,
    );
    refresh(commissionId);
    return { ok: true, data: { state } };
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function requestChanges(
  token: string,
  message: string,
): Promise<ActionResult<{ version: number }>> {
  const parsed = requestChangesSchema.safeParse({ token, message });
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const { commissionId, version } = await agreements.requestChanges(
      parsed.data,
    );
    refresh(commissionId);
    return { ok: true, data: { version } };
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function downloadDelivery(
  token: string,
  deliveryId: string,
): Promise<ActionResult<{ url: string; filename: string; expiresAt: string }>> {
  const parsed = deliveryDownloadSchema.safeParse({ token, deliveryId });
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const { commissionId, ...data } = await requestDeliveryDownload({
      ...parsed.data,
      userAgent: (await headers()).get("user-agent"),
    });
    updateTag(`commission-${commissionId}`);
    return { ok: true, data };
  } catch (error) {
    return toActionFailure(error);
  }
}
