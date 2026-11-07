import { z } from "zod";

export const SERVICE_TYPES = [
  "mixing",
  "mastering",
  "mix_and_master",
  "illustration",
  "live2d_rigging",
  "mv_editing",
  "thumbnail",
  "other",
] as const;

export const SERVICE_LABELS: Record<(typeof SERVICE_TYPES)[number], string> = {
  mixing: "Mixing",
  mastering: "Mastering",
  mix_and_master: "Mix and master",
  illustration: "Illustration",
  live2d_rigging: "Live2D rigging",
  mv_editing: "MV editing",
  thumbnail: "Thumbnail",
  other: "Other",
};

export const AMBIGUITY_CODES = [
  "MISSING_PRICE",
  "AMBIGUOUS_CURRENCY",
  "UNSUPPORTED_CURRENCY",
  "CONFLICTING_VALUES",
  "SCOPE_UNCLEAR",
  "MISSING_DEADLINE",
  "RELATIVE_DEADLINE",
  "PAST_DEADLINE",
  "MISSING_REVISIONS",
  "VAGUE_REVISIONS",
  "MISSING_DEPOSIT_TERMS",
  "DEPOSIT_EXCEEDS_TOTAL",
  "MISSING_USAGE_RIGHTS",
  "USAGE_RIGHTS_UNCLEAR",
  "MISSING_CLIENT_EMAIL",
  "OTHER",
] as const;

export const SEVERITIES = ["blocker", "warning"] as const;

export const AMBIGUITY_SEVERITY: Record<AmbiguityCode, Severity> = {
  MISSING_PRICE: "blocker",
  AMBIGUOUS_CURRENCY: "blocker",
  UNSUPPORTED_CURRENCY: "blocker",
  CONFLICTING_VALUES: "blocker",
  SCOPE_UNCLEAR: "blocker",
  MISSING_DEADLINE: "blocker",
  RELATIVE_DEADLINE: "warning",
  PAST_DEADLINE: "blocker",
  MISSING_REVISIONS: "warning",
  VAGUE_REVISIONS: "warning",
  MISSING_DEPOSIT_TERMS: "warning",
  DEPOSIT_EXCEEDS_TOTAL: "blocker",
  MISSING_USAGE_RIGHTS: "blocker",
  USAGE_RIGHTS_UNCLEAR: "warning",
  MISSING_CLIENT_EMAIL: "warning",
  OTHER: "warning",
};

export const moneySchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Money is a decimal string like 150.00");

export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Currency is an ISO 4217 code like USD");

export const ambiguitySchema = z
  .strictObject({
    code: z.enum(AMBIGUITY_CODES),
    severity: z.enum(SEVERITIES),
    field: z
      .string()
      .regex(
        /^\/([^/]+(\/[^/]+)*)?$/,
        "Field is a JSON Pointer like /deadline/date",
      ),
    message: z.string().min(1),
    source_quote: z.string().nullable().optional(),
    suggested_question: z.string().nullable().optional(),
  })
  .superRefine((ambiguity, ctx) => {
    const expected = AMBIGUITY_SEVERITY[ambiguity.code];
    if (ambiguity.severity !== expected) {
      ctx.addIssue({
        code: "custom",
        path: ["severity"],
        message: `${ambiguity.code} is always a ${expected}`,
      });
    }
  });

export const deliverableSchema = z.strictObject({
  id: z.string().regex(/^d\d+$/),
  description: z.string().min(1),
  quantity: z.int().min(1),
  format: z.string().nullable().optional(),
});

export const depositSchema = z
  .strictObject({
    type: z.enum(["percent", "fixed", "none"]),
    percent: z.number().min(0).max(100).nullable(),
    fixed_amount: moneySchema.nullable(),
    amount: moneySchema.nullable().optional(),
  })
  .superRefine((deposit, ctx) => {
    const needs = (key: "percent" | "fixed_amount", set: boolean) => {
      if ((deposit[key] !== null) !== set) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: set
            ? `${key} is required when type is ${deposit.type}`
            : `${key} must be null when type is ${deposit.type}`,
        });
      }
    };
    needs("percent", deposit.type === "percent");
    needs("fixed_amount", deposit.type === "fixed");
  });

export const agreementSchema = z
  .strictObject({
    schema_version: z.literal("1.0"),
    service_type: z.enum(SERVICE_TYPES),
    service_other: z.string().min(1).nullable(),
    title: z.string().min(1),
    deliverables: z.array(deliverableSchema).min(1),
    price: z.strictObject({
      total: moneySchema.nullable(),
      currency: currencySchema.nullable(),
    }),
    deposit: depositSchema,
    balance_amount: moneySchema.nullable().optional(),
    deadline: z.strictObject({
      date: z.iso.date().nullable(),
      raw_text: z.string().nullable().optional(),
      is_relative: z.boolean(),
    }),
    revisions: z.strictObject({
      included: z.int().min(0).nullable(),
      extra_fee: moneySchema.nullable().optional(),
    }),
    usage_rights: z
      .strictObject({
        commercial: z.boolean().nullable().optional(),
        credit_required: z.boolean().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
      .optional(),
    parties: z
      .strictObject({
        client: z
          .strictObject({
            display_name: z.string().nullable().optional(),
            handle: z.string().nullable().optional(),
            email: z.email().nullable().optional(),
          })
          .optional(),
      })
      .optional(),
    notes: z.string().nullable().optional(),
    ambiguities: z.array(ambiguitySchema),
    extraction: z
      .strictObject({
        model: z.string(),
        prompt_version: z.string(),
        confidence: z.number().min(0).max(1),
        source_language: z.string(),
      })
      .optional(),
  })
  .superRefine((agreement, ctx) => {
    const isOther = agreement.service_type === "other";
    if (isOther !== (agreement.service_other !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["service_other"],
        message: isOther
          ? "service_other is required when service_type is other"
          : "service_other must be null unless service_type is other",
      });
    }
  });

export type Agreement = z.infer<typeof agreementSchema>;
export type Ambiguity = z.infer<typeof ambiguitySchema>;
export type ServiceType = (typeof SERVICE_TYPES)[number];
export type AmbiguityCode = (typeof AMBIGUITY_CODES)[number];
export type Severity = (typeof SEVERITIES)[number];
