import {
  formatIssues,
  generateStructured,
  isRecord,
  ModelCallError,
  StructuredOutputError,
  toGeminiResponseSchema,
  type ModelClient,
} from "@/lib/ai/gemini";
import {
  AMBIGUITY_SEVERITY,
  agreementSchema,
  type Agreement,
  type Ambiguity,
} from "@/lib/schema/agreement";
import { runPostChecks } from "./post-checks";
import {
  buildExtractSystemPrompt,
  buildExtractUserMessage,
  EXTRACT_PROMPT_VERSION,
  type ExtractInput,
} from "./prompt";

export const MAX_DM_CHARS = 10_000;

export type ExtractionErrorCode =
  "INPUT_INVALID" | "MODEL_CALL_FAILED" | "INVALID_OUTPUT";

export class ExtractionError extends Error {
  constructor(
    readonly code: ExtractionErrorCode,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

export type ExtractResult = {
  agreement: Agreement;
  /** 1 = valid on the first try, 2 = needed the repair retry. */
  attempts: 1 | 2;
  /** True when the model never produced a valid agreement (FR-1.3). */
  fallback: boolean;
};

/** Today's date (YYYY-MM-DD) in the creator's time zone. Default: WIB. */
export function todayInZone(
  timeZone = "Asia/Jakarta",
  now = new Date(),
): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Replace what the app owns, so the model can't fail validation on it. */
function applyServerFields(record: Record<string, unknown>, model: string) {
  delete record.balance_amount;
  if (isRecord(record.deposit)) delete record.deposit.amount;

  if (Array.isArray(record.ambiguities)) {
    for (const flag of record.ambiguities) {
      if (isRecord(flag) && typeof flag.code === "string") {
        const severity = (AMBIGUITY_SEVERITY as Record<string, string>)[
          flag.code
        ];
        if (severity) flag.severity = severity;
      }
    }
  }

  if (record.extraction === undefined || isRecord(record.extraction)) {
    record.extraction = {
      ...record.extraction,
      model,
      prompt_version: EXTRACT_PROMPT_VERSION,
    };
  }
}

/** Asks for the two fields extraction depends on, which the schema leaves optional. */
function agreementResponseSchema(): Record<string, unknown> {
  const schema = toGeminiResponseSchema(agreementSchema) as Record<
    string,
    unknown
  > & {
    required: string[];
    properties: { deadline: { required: string[] } };
  };
  schema.required.push("extraction");
  schema.properties.deadline.required.push("raw_text");
  return schema;
}

const NOT_SPECIFIED = "Not specified";

/**
 * Keeps every top-level field that passes validation and leaves the rest empty,
 * so post-checks flag them. The creator finishes the draft by hand (FR-1.3).
 */
function buildFallbackDraft(
  candidate: Record<string, unknown>,
  model: string,
): Agreement {
  const draft: Record<string, unknown> = {
    schema_version: "1.0",
    service_type: "other",
    service_other: NOT_SPECIFIED,
    title: "Untitled commission",
    deliverables: [{ id: "d1", description: NOT_SPECIFIED, quantity: 1 }],
    price: { total: null, currency: null },
    deposit: { type: "none", percent: null, fixed_amount: null },
    deadline: { date: null, raw_text: null, is_relative: false },
    revisions: { included: null, extra_fee: null },
    ambiguities: [],
    extraction: {
      model,
      prompt_version: EXTRACT_PROMPT_VERSION,
      confidence: 0,
      source_language: "unknown",
    },
  };

  const kept = new Set<string>();
  for (const [key, schema] of Object.entries(agreementSchema.shape)) {
    const result = schema.safeParse(candidate[key]);
    if (result.success && result.data !== undefined) {
      draft[key] = result.data;
      kept.add(key);
    }
  }

  draft.service_other =
    draft.service_type === "other"
      ? (draft.service_other ?? NOT_SPECIFIED)
      : null;

  const flags = draft.ambiguities as Ambiguity[];
  const addFlag = (code: Ambiguity["code"], field: string, message: string) => {
    if (flags.some((a) => a.code === code)) return;
    flags.push({
      code,
      severity: AMBIGUITY_SEVERITY[code],
      field,
      message,
      source_quote: null,
      suggested_question: null,
    });
  };
  if (!kept.has("deliverables")) {
    addFlag(
      "SCOPE_UNCLEAR",
      "/deliverables",
      "The deliverables are not known.",
    );
  }
  if (!kept.has("deposit")) {
    addFlag("MISSING_DEPOSIT_TERMS", "/deposit", "No deposit was found.");
  }
  flags.push({
    code: "OTHER",
    severity: "warning",
    field: "/extraction",
    message:
      "The AI couldn't finish reading this chat. Check every field against the DM.",
    source_quote: null,
    suggested_question: null,
  });

  return agreementSchema.parse(draft);
}

/**
 * DM text -> validated agreement.
 * Flow: prompt -> model -> zod validate -> one repair retry -> fallback draft
 * if still invalid -> post-checks (flags + server-computed money) -> final
 * validate.
 */
export async function extractAgreement(
  input: ExtractInput,
  client: ModelClient,
): Promise<ExtractResult> {
  for (const text of [input.dmText, input.originalDm ?? ""]) {
    if (text.length > MAX_DM_CHARS) {
      throw new ExtractionError(
        "INPUT_INVALID",
        `The chat is too long (${text.length} characters, limit ${MAX_DM_CHARS}).`,
      );
    }
  }

  let userMessage: string;
  try {
    userMessage = buildExtractUserMessage(input);
  } catch (error) {
    throw new ExtractionError(
      "INPUT_INVALID",
      error instanceof Error ? error.message : "Invalid input",
    );
  }

  let agreement: Agreement;
  let attempts: 1 | 2;
  let fallback = false;
  try {
    const result = await generateStructured(
      { system: buildExtractSystemPrompt(), user: userMessage },
      agreementSchema,
      {
        client,
        promptVersion: EXTRACT_PROMPT_VERSION,
        responseSchema: agreementResponseSchema(),
        prepare: (value) => applyServerFields(value, client.model),
      },
    );
    agreement = result.data;
    attempts = result.attempts;
  } catch (error) {
    if (error instanceof ModelCallError) {
      throw new ExtractionError("MODEL_CALL_FAILED", error.message);
    }
    if (!(error instanceof StructuredOutputError)) throw error;
    agreement = buildFallbackDraft(error.candidate ?? {}, client.model);
    attempts = 2;
    fallback = true;
  }

  const checked = runPostChecks({
    agreement,
    dmText: input.dmText,
    pasteDate: input.pasteDate,
  });

  const final = agreementSchema.safeParse(checked);
  if (!final.success) {
    throw new ExtractionError(
      "INVALID_OUTPUT",
      "The agreement failed validation after post-checks.",
      formatIssues(final.error),
    );
  }
  return { agreement: final.data, attempts, fallback };
}
