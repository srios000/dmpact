import { z } from "zod";
import { DEFAULT_DEPOSIT_PERCENT } from "@/lib/ai/extract/post-checks";
import { agreementSchema } from "./agreement";

export const MAX_DM_CHARS = 10_000;
export const MAX_CHANGE_REQUEST_CHARS = 2_000;

export const commissionIdSchema = z.uuid();
export const versionHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Version hash is a SHA-256 hex string");
export const CLIENT_TOKEN_BYTES = 16;
export const clientTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{22}$/, "Client token is 128 bits in base64url");

export const newAgreementSchema = z.preprocess((value) => {
  if (value === null || typeof value !== "object") return value;
  return "deposit" in value
    ? value
    : {
        ...value,
        deposit: {
          type: "percent",
          percent: DEFAULT_DEPOSIT_PERCENT,
          fixed_amount: null,
        },
      };
}, agreementSchema);

export const extractAgreementSchema = z.strictObject({
  dmText: z.string().trim().min(1).max(MAX_DM_CHARS),
  commissionId: commissionIdSchema.optional(),
});

export const createCommissionSchema = z.strictObject({
  sourceDm: z.string().max(MAX_DM_CHARS),
  agreement: newAgreementSchema,
});

export const saveAgreementVersionSchema = z.strictObject({
  commissionId: commissionIdSchema,
  agreement: agreementSchema,
  followUpDm: z.string().trim().min(1).max(MAX_DM_CHARS).optional(),
});

export const sendToClientSchema = z.strictObject({
  commissionId: commissionIdSchema,
  versionHash: versionHashSchema,
});

export const transitionCommissionSchema = z.strictObject({
  commissionId: commissionIdSchema,
  to: z.enum(["in_progress", "delivered", "cancelled"]),
  reason: z.string().trim().min(1).max(500).optional(),
});

export const retryDepositInvoiceSchema = z.strictObject({
  commissionId: commissionIdSchema,
});

export const confirmAgreementSchema = z.strictObject({
  token: clientTokenSchema,
  versionHash: versionHashSchema,
});

export const requestChangesSchema = z.strictObject({
  token: clientTokenSchema,
  message: z.string().trim().min(1).max(MAX_CHANGE_REQUEST_CHARS),
});

export type ExtractAgreementInput = z.input<typeof extractAgreementSchema>;
export type CreateCommissionInput = z.input<typeof createCommissionSchema>;
export type SaveAgreementVersionInput = z.input<
  typeof saveAgreementVersionSchema
>;
export type SendToClientInput = z.input<typeof sendToClientSchema>;
export type TransitionCommissionInput = z.input<
  typeof transitionCommissionSchema
>;
export type RetryDepositInvoiceInput = z.input<
  typeof retryDepositInvoiceSchema
>;
