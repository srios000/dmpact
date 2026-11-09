"use server";

import { updateTag } from "next/cache";
import {
  ExtractionError,
  extractAgreement as runExtraction,
  todayInZone,
  type ExtractResult,
} from "@/lib/ai/extract";
import { createGeminiClient } from "@/lib/ai/gemini";
import * as commissions from "@/lib/repositories/commission-repository";
import {
  invalidInput,
  toActionFailure,
  type ActionResult,
} from "@/lib/repositories/action-result";
import { requireCreator } from "@/lib/repositories/shared";
import {
  createCommissionSchema,
  extractAgreementSchema,
  type CreateCommissionInput,
  type ExtractAgreementInput,
} from "@/lib/schema/commission-forms";

export async function extractAgreement(
  input: ExtractAgreementInput,
): Promise<ActionResult<ExtractResult>> {
  const parsed = extractAgreementSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    await requireCreator();
    const original = parsed.data.commissionId
      ? await commissions.getCommission(parsed.data.commissionId)
      : null;
    const data = await runExtraction(
      {
        dmText: parsed.data.dmText,
        pasteDate: todayInZone(),
        originalDm: original?.sourceDm,
        earlierFollowUps: original?.followUpDms.map((f) => f.message),
        currentAgreement: original?.versions.at(-1)?.agreement,
      },
      createGeminiClient(),
    );
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ExtractionError) {
      console.error("ai.extract_failed", {
        code: error.code,
        message: error.message,
      });
      return {
        ok: false,
        error: {
          code: "extraction_failed",
          message:
            "Extraction failed. Try again or fill in the agreement by hand.",
        },
      };
    }
    return toActionFailure(error);
  }
}

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
