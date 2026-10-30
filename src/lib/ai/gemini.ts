import { GoogleGenAI } from "@google/genai";
import agreementSchema from "../../../schema/agreement.schema.json";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

/** Everything the AI modules need from a model. Mockable in tests and evals. */
export type ModelRequest = {
  system: string;
  user: string;
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

/**
 * Gemini's structured output accepts only a subset of JSON Schema. Drop the
 * parts it does not take (meta keys and the if/then/else rule); zod validates
 * those rules after the call.
 */
export function toGeminiResponseSchema(
  schema: unknown = agreementSchema,
): unknown {
  const copy = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  delete copy.$schema;
  delete copy.$id;
  delete copy.allOf;
  return copy;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const THINKING_LEVELS = ["low", "medium", "high"] as const;

function getTimeoutMs(env: NodeJS.ProcessEnv): number {
  const parsed = Number(env.GEMINI_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

/** "minimal" is not supported on Gemini 3.8 Flash, so it is not accepted here. */
function getThinkingLevel(
  env: NodeJS.ProcessEnv,
): (typeof THINKING_LEVELS)[number] {
  const level = env.GEMINI_THINKING_LEVEL?.trim().toLowerCase();
  return THINKING_LEVELS.find((l) => l === level) ?? "low";
}

export function createGeminiClient(
  env: NodeJS.ProcessEnv = process.env,
): ModelClient {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const model = getGeminiModel(env);
  const ai = new GoogleGenAI({ apiKey });
  const responseJsonSchema = toGeminiResponseSchema();
  const timeoutMs = getTimeoutMs(env);
  const thinkingLevel = getThinkingLevel(env);

  return {
    model,
    async generateJson({ system, user }) {
      // Gemini 3.8 Flash ignores temperature/top_p/top_k and rejects
      // thinking_level "minimal", so only thinking level and the schema are set.
      // "low" keeps latency down; raise it with GEMINI_THINKING_LEVEL if accuracy needs it.
      const request = {
        model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema,
          thinkingConfig: { thinkingLevel },
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      } as unknown as Parameters<typeof ai.models.generateContent>[0];

      const response = await ai.models.generateContent(request);
      return response.text ?? "";
    },
  };
}
