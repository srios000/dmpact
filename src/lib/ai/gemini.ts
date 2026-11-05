import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

/** Everything the AI modules need from a model. Mockable in tests and evals. */
export type ModelRequest = {
  system: string;
  user: string;
  responseSchema: unknown;
};

export type ModelClient = {
  model: string;
  /** Returns the raw JSON text produced by the model. */
  generateJson(request: ModelRequest): Promise<string>;
};

export function getGeminiModel(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.GEMINI_MODEL?.trim();
  return configured ? configured : DEFAULT_GEMINI_MODEL;
}

/** zod schema -> response schema for Gemini, without the meta key. */
export function toGeminiResponseSchema(
  schema: z.ZodType,
): Record<string, unknown> {
  const jsonSchema: Record<string, unknown> = z.toJSONSchema(schema, {
    target: "draft-2020-12",
  });
  delete jsonSchema.$schema;
  return jsonSchema;
}

export class ModelCallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelCallError";
  }
}

export class StructuredOutputError extends Error {
  constructor(
    readonly errors: string[],
    /** The last JSON object the model returned, for partial recovery. */
    readonly candidate: Record<string, unknown> | null,
  ) {
    super("The model did not return valid output after one retry.");
    this.name = "StructuredOutputError";
  }
}

export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map(
    (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

export type StructuredPrompt = {
  system: string;
  user: string;
};

export type StructuredOptions = {
  client: ModelClient;
  promptVersion: string;
  /** Defaults to the JSON Schema generated from the zod schema. */
  responseSchema?: unknown;
  /** Sets fields the app owns on the parsed object before validation. */
  prepare?: (value: Record<string, unknown>) => void;
};

export type StructuredResult<T> = {
  data: T;
  /** 1 = valid on the first try, 2 = needed the repair retry. */
  attempts: 1 | 2;
};

/**
 * Prompt + zod schema -> validated object, with one repair retry that sends the
 * validation errors back to the model.
 */
export async function generateStructured<S extends z.ZodType>(
  prompt: StructuredPrompt,
  schema: S,
  options: StructuredOptions,
): Promise<StructuredResult<z.output<S>>> {
  const { client, promptVersion, prepare } = options;
  const responseSchema =
    options.responseSchema ?? toGeminiResponseSchema(schema);

  const log = (ok: boolean, attempts: 1 | 2) =>
    console.info("ai.generate", {
      model: client.model,
      prompt_version: promptVersion,
      attempts,
      ok,
    });

  async function call(user: string): Promise<string> {
    try {
      return await client.generateJson({
        system: prompt.system,
        user,
        responseSchema,
      });
    } catch (error) {
      throw new ModelCallError(
        error instanceof Error ? error.message : "Model call failed",
      );
    }
  }

  let candidate: Record<string, unknown> | null = null;

  function validate(
    raw: string,
  ): { ok: true; data: z.output<S> } | { ok: false; errors: string[] } {
    const parsed = parseJson(raw);
    if (!parsed.ok) {
      return {
        ok: false,
        errors: [`Output is not valid JSON: ${parsed.error}`],
      };
    }
    if (!isRecord(parsed.value)) {
      return { ok: false, errors: ["Output must be a single JSON object"] };
    }
    candidate = parsed.value;
    prepare?.(candidate);
    const result = schema.safeParse(candidate);
    return result.success
      ? { ok: true, data: result.data }
      : { ok: false, errors: formatIssues(result.error) };
  }

  const first = await call(prompt.user);
  const firstResult = validate(first);
  if (firstResult.ok) {
    log(true, 1);
    return { data: firstResult.data, attempts: 1 };
  }

  const second = await call(
    buildRepairMessage(prompt.user, first, firstResult.errors),
  );
  const secondResult = validate(second);
  if (secondResult.ok) {
    log(true, 2);
    return { data: secondResult.data, attempts: 2 };
  }

  log(false, 2);
  throw new StructuredOutputError(secondResult.errors, candidate);
}

const DEFAULT_TIMEOUT_MS = 120_000;
const THINKING_LEVELS = ["low", "medium", "high"] as const;

function getTimeoutMs(env: NodeJS.ProcessEnv): number {
  const parsed = Number(env.GEMINI_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

/**
 * "minimal" is not supported on Gemini 3.8 Flash, so it is not accepted here.
 * "none" sends no thinking config, for models that reject it, such as Gemma.
 */
export function getThinkingLevel(
  env: NodeJS.ProcessEnv,
): (typeof THINKING_LEVELS)[number] | null {
  const level = env.GEMINI_THINKING_LEVEL?.trim().toLowerCase();
  if (level === "none") return null;
  return THINKING_LEVELS.find((l) => l === level) ?? "low";
}

export function createGeminiClient(
  env: NodeJS.ProcessEnv = process.env,
): ModelClient {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const model = getGeminiModel(env);
  const ai = new GoogleGenAI({ apiKey });
  const timeoutMs = getTimeoutMs(env);
  const thinkingLevel = getThinkingLevel(env);

  return {
    model,
    async generateJson({ system, user, responseSchema }) {
      // Gemini 3.8 Flash ignores temperature/top_p/top_k and rejects
      // thinking_level "minimal", so only thinking level and the schema are set.
      // "low" keeps latency down; raise it with GEMINI_THINKING_LEVEL if accuracy needs it.
      const request = {
        model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: responseSchema,
          ...(thinkingLevel && { thinkingConfig: { thinkingLevel } }),
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      } as unknown as Parameters<typeof ai.models.generateContent>[0];

      const response = await ai.models.generateContent(request);
      return response.text ?? "";
    },
  };
}
