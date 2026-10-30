
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
  "USAGE_RIGHTS_UNCLEAR",
  "MISSING_CLIENT_EMAIL",
  "OTHER",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];
export type AmbiguityCode = (typeof AMBIGUITY_CODES)[number];

export function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const d = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(d.getTime()) &&
    d.toISOString().startsWith(value);
}

export const moneySchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Invalid money string");

export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Invalid currency code");

const isoDateSchema = z
  .string()
  .refine(isRealIsoDate, "Must be a real YYYY-MM-DD date");

export const ambiguitySchema = z
  .object({
    code: z.enum(AMBIGUITY_CODES),
    severity: z.enum(["blocker", "warning"]),
    field: z
      .string()
      .regex(/^\/([^/]+(\/[^/]+)*)?$/, "Invalid JSON Pointer"),
    message: z.string().min(1),
    source_quote: z.string().nullable().optional(),
    suggested_question: z.string().nullable().optional(),
  })
  .strict();

export const deliverableSchema = z
  .object({
    id: z.string().regex(/^d\d+$/),
    description: z.string().min(1),
    quantity: z.number().int().min(1),
    format: z.string().nullable().optional(),
  })
  .strict();

export const depositSchema = z
  .object({
    type: z.enum(["percent", "fixed", "none"]),
    percent: z.number().min(0).max(100).nullable(),
    fixed_amount: moneySchema.nullable(),
    amount: moneySchema.nullable().optional(),
  })
  .strict()
  .superRefine((deposit, ctx) => {
    const needs = (
      key: "percent" | "fixed_amount",
      required: boolean
    ) => {
      if ((deposit[key] !== null) !== required) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: required
            ? `${key} is required when type is ${deposit.type}`
            : `${key} must be null when type is ${deposit.type}`,
        });
      }
    };

    needs("percent", deposit.type === "percent");
    needs("fixed_amount", deposit.type === "fixed");
  });

export const agreementSchema = z
  .object({
    schema_version: z.literal("1.0"),
    service_type: z.enum(SERVICE_TYPES),

    service_other: z.string().nullable(),

    title: z.string().min(1),

    deliverables: z.array(deliverableSchema).min(1),

    price: z
      .object({
        total: moneySchema.nullable(),
        currency: currencySchema.nullable(),
      })
      .strict(),

    deposit: depositSchema,

    balance_amount: moneySchema.nullable().optional(),

    deadline: z
      .object({
        date: isoDateSchema.nullable(),
        raw_text: z.string().nullable().optional(),
        is_relative: z.boolean(),
      })
      .strict(),

    revisions: z
      .object({
        included: z.number().int().min(0).nullable(),
        extra_fee: moneySchema.nullable().optional(),
      })
      .strict(),

    usage_rights: z
      .object({
        commercial: z.boolean().nullable().optional(),
        credit_required: z.boolean().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
      .strict()
      .optional(),

    parties: z
      .object({
        client: z
          .object({
            display_name: z.string().nullable().optional(),
            handle: z.string().nullable().optional(),
            email: z.string().email().nullable().optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),

    notes: z.string().nullable().optional(),

    ambiguities: z.array(ambiguitySchema),

    extraction: z
      .object({
        model: z.string().optional(),
        prompt_version: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
        source_language: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const other = value.service_other?.trim() ?? "";

    if (value.service_type === "other" && other === "") {
      ctx.addIssue({
        code: "custom",
        path: ["service_other"],
        message: 'Required when service_type is "other"',
      });
    }

    if (
      value.service_type !== "other" &&
      value.service_other !== null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["service_other"],
        message: 'Must be null unless service_type is "other"',
      });
    }
  });

export type Agreement = z.infer<typeof agreementSchema>;
export type Ambiguity = z.infer<typeof ambiguitySchema>;

export function formatIssues(
  error: {
    issues: ReadonlyArray<{
      path: PropertyKey[];
      message: string;
    }>;
  }
): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join("/");
    return `/${path}: ${issue.message}`;
  });
}
