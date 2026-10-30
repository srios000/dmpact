import type { ModelClient } from "@/lib/ai/gemini";
import {
  agreementSchema,
  formatIssues,
  type Agreement,
} from "@/lib/schema/agreement";
import { runPostChecks } from "./post-checks";
import {
  buildExtractSystemPrompt,
  buildExtractUserMessage,
  EXTRACT_PROMPT_VERSION,
  type ExtractInput,
} from "./prompt";

export const MAX_DM_CHARS = 20_000;

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

/** Models sometimes wrap JSON in fences even when told not to. */
function parseJson(
  raw: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

type Validated =
  { ok: true; agreement: Agreement } | { ok: false; errors: string[] };

function validate(raw: string): Validated {
  const parsed = parseJson(raw);
  if (!parsed.ok)
    return { ok: false, errors: [`Output is not valid JSON: ${parsed.error}`] };

  const candidate = parsed.value;
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    return { ok: false, errors: ["Output must be a single JSON object"] };
  }

  // Server-computed fields are ignored, so drop them before validation.
  const record = candidate as Record<string, unknown>;
  delete record.balance_amount;
  const deposit = record.deposit;
  if (
    deposit !== null &&
    typeof deposit === "object" &&
    !Array.isArray(deposit)
  ) {
    delete (deposit as Record<string, unknown>).amount;
  }

  const result = agreementSchema.safeParse(record);
  if (!result.success) return { ok: false, errors: formatIssues(result.error) };
  return { ok: true, agreement: result.data };
}

function buildRepairMessage(
  userMessage: string,
  previous: string,
  errors: string[],
): string {
  return [
    userMessage,
    "",
    "Your previous output was rejected by validation.",
    "Errors:",
    ...errors.slice(0, 20).map((e) => `- ${e}`),
    "Return one corrected JSON object only. Keep every value that was correct.",
    "",
    "Previous output:",
    previous.slice(0, 8_000),
  ].join("\n");
}

/**
 * DM text -> validated agreement.
 * Flow: prompt -> model -> zod validate -> one repair retry -> post-checks
 * (flags + server-computed money) -> final validate.
 */
export async function extractAgreement(
  input: ExtractInput,
  client: ModelClient,
): Promise<ExtractResult> {
  if (input.dmText.length > MAX_DM_CHARS) {
    throw new ExtractionError(
      "INPUT_INVALID",
      `The chat is too long (${input.dmText.length} characters, limit ${MAX_DM_CHARS}).`,
    );
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
  const system = buildExtractSystemPrompt();

  async function call(user: string): Promise<string> {
    try {
      return await client.generateJson({ system, user });
    } catch (error) {
      throw new ExtractionError(
        "MODEL_CALL_FAILED",
        error instanceof Error ? error.message : "Model call failed",
      );
    }
  }

  const first = await call(userMessage);
  let validated = validate(first);
  let attempts: 1 | 2 = 1;

  if (!validated.ok) {
    attempts = 2;
    const second = await call(
      buildRepairMessage(userMessage, first, validated.errors),
    );
    validated = validate(second);
  }
  if (!validated.ok) {
    throw new ExtractionError(
      "INVALID_OUTPUT",
      "The model did not return a valid agreement after one retry.",
      validated.errors,
    );
  }

  const checked = runPostChecks({
    agreement: validated.agreement,
    dmText: input.dmText,
    pasteDate: input.pasteDate,
  });
  checked.extraction = {
    ...checked.extraction,
    model: client.model,
    prompt_version: EXTRACT_PROMPT_VERSION,
  };

  const final = agreementSchema.safeParse(checked);
  if (!final.success) {
    throw new ExtractionError(
      "INVALID_OUTPUT",
      "The agreement failed validation after post-checks.",
      formatIssues(final.error),
    );
  }
  return { agreement: final.data, attempts };
}
