"use server";

import { updateTag } from "next/cache";
import * as commissions from "@/lib/repositories/commission-repository";
import {
  invalidInput,
  toActionFailure,
  type ActionResult,
} from "@/lib/repositories/action-result";
import {
  createCommissionSchema,
  type CreateCommissionInput,
} from "@/lib/schema/commission-forms";

export async function createCommission(
  input: CreateCommissionInput,
): Promise<ActionResult<{ id: string; version: number; contentHash: string }>> {
  const parsed = createCommissionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const data = await commissions.createCommission(parsed.data);
    updateTag("commissions");
    return { ok: true, data };
  } catch (error) {
    return toActionFailure(error);
  }
}
