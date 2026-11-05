import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { negotiationSchema } from "@/lib/schema/negotiation";
import {
  createGeminiClient,
  DEFAULT_GEMINI_FALLBACK_MODEL,
  DEFAULT_GEMINI_MODEL,
  generateStructured,
  getGeminiFallbackModel,
  getGeminiModel,
  getThinkingLevel,
  ModelCallError,
  StructuredOutputError,
  toGeminiResponseSchema,
  withFallback,
  type ModelAnswer,
  type ModelClient,
  type ModelRequest,
} from "./gemini";

const generateContent = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

function mockClient(
  responses: Array<string | Error | ModelAnswer>,
  model = "gemini-test",
): ModelClient & { calls: ModelRequest[] } {
  const calls: ModelRequest[] = [];
  return {
    model,
    calls,
    async generateJson(request) {
      calls.push(request);
      const next = responses.shift();
      if (next === undefined) throw new Error("no more responses");
      if (next instanceof Error) throw next;
      return typeof next === "string" ? { text: next, model } : next;
    },
  };
}

const schema = z.strictObject({ price: z.number() });
const prompt = { system: "sys", user: "usr" };
const options = (client: ModelClient) => ({
  client,
  promptVersion: "test-v1",
});

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("generateStructured", () => {
  it("returns validated data on the first try", async () => {
    const client = mockClient(['{"price":10}']);
    const result = await generateStructured(prompt, schema, options(client));
    expect(result).toEqual({
      data: { price: 10 },
      attempts: 1,
      model: "gemini-test",
    });
    expect(client.calls[0].system).toBe("sys");
    expect(client.calls[0].user).toBe("usr");
  });

  it("generates the response schema from the zod schema", async () => {
    const client = mockClient(['{"price":10}']);
    await generateStructured(prompt, schema, options(client));
    expect(client.calls[0].responseSchema).toEqual(
      toGeminiResponseSchema(schema),
    );
  });

  it("uses a given response schema", async () => {
    const client = mockClient(['{"price":10}']);
    await generateStructured(prompt, schema, {
      ...options(client),
      responseSchema: { custom: true },
    });
    expect(client.calls[0].responseSchema).toEqual({ custom: true });
  });

  it("accepts JSON wrapped in code fences", async () => {
    const client = mockClient(['```json\n{"price":10}\n```']);
    const { attempts } = await generateStructured(
      prompt,
      schema,
      options(client),
    );
    expect(attempts).toBe(1);
  });

  it("retries once with the validation errors", async () => {
    const client = mockClient(['{"price":"ten"}', '{"price":10}']);
    const result = await generateStructured(prompt, schema, options(client));
    expect(result.attempts).toBe(2);
    expect(client.calls[1].user).toContain("usr");
    expect(client.calls[1].user).toContain("rejected by validation");
    expect(client.calls[1].user).toContain("price:");
    expect(client.calls[1].user).toContain('{"price":"ten"}');
  });

  it("applies prepare before validating", async () => {
    const client = mockClient(['{"price":10,"amount":"model"}']);
    const { attempts } = await generateStructured(prompt, schema, {
      ...options(client),
      prepare: (value) => {
        delete value.amount;
      },
    });
    expect(attempts).toBe(1);
  });

  it("passes the answering model to prepare and the result", async () => {
    const client = mockClient([{ text: '{"price":10}', model: "backup" }]);
    const prepare = vi.fn();
    const result = await generateStructured(prompt, schema, {
      ...options(client),
      prepare,
    });
    expect(prepare).toHaveBeenCalledWith({ price: 10 }, "backup");
    expect(result.model).toBe("backup");
  });

  it("returns the model of the repair answer", async () => {
    const client = mockClient([
      '{"price":"ten"}',
      { text: '{"price":10}', model: "backup" },
    ]);
    const result = await generateStructured(prompt, schema, options(client));
    expect(result).toMatchObject({ attempts: 2, model: "backup" });
  });

  it("throws the errors and last object after a second bad answer", async () => {
    const client = mockClient(['{"price":"a"}', '{"price":"b"}']);
    const error = await generateStructured(
      prompt,
      schema,
      options(client),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StructuredOutputError);
    expect((error as StructuredOutputError).candidate).toEqual({ price: "b" });
    expect((error as StructuredOutputError).errors[0]).toContain("price:");
    expect((error as StructuredOutputError).model).toBe("gemini-test");
    expect(client.calls).toHaveLength(2);
  });

  it("keeps the first object and its model when the retry is not JSON", async () => {
    const client = mockClient([
      '{"price":"a"}',
      { text: "not json", model: "backup" },
    ]);
    const error = await generateStructured(
      prompt,
      schema,
      options(client),
    ).catch((e: unknown) => e);
    expect((error as StructuredOutputError).candidate).toEqual({ price: "a" });
    expect((error as StructuredOutputError).model).toBe("gemini-test");
  });

  it("rejects output that is not an object", async () => {
    const client = mockClient(["[1]", "[2]"]);
    await expect(
      generateStructured(prompt, schema, options(client)),
    ).rejects.toMatchObject({
      errors: ["Output must be a single JSON object"],
      candidate: null,
    });
  });

  it("wraps model failures without retrying", async () => {
    const client = mockClient([new Error("503")]);
    await expect(
      generateStructured(prompt, schema, options(client)),
    ).rejects.toBeInstanceOf(ModelCallError);
    expect(client.calls).toHaveLength(1);
  });

  it("logs the answering model and prompt version without the prompt text", async () => {
    const client = mockClient([{ text: '{"price":10}', model: "backup" }]);
    await generateStructured(prompt, schema, options(client));
    expect(console.info).toHaveBeenCalledWith("ai.generate", {
      model: "backup",
      prompt_version: "test-v1",
      attempts: 1,
      ok: true,
    });
  });
});

describe("toGeminiResponseSchema", () => {
  it("drops the meta key and works for the negotiation schema", () => {
    const result = toGeminiResponseSchema(negotiationSchema);
    expect(result.$schema).toBeUndefined();
    expect(result.type).toBe("object");
  });
});

describe("getGeminiModel", () => {
  it("reads GEMINI_MODEL and falls back to the default", () => {
    expect(getGeminiModel({ GEMINI_MODEL: " custom " } as never)).toBe(
      "custom",
    );
    expect(getGeminiModel({ GEMINI_MODEL: " " } as never)).toBe(
      DEFAULT_GEMINI_MODEL,
    );
    expect(getGeminiModel({} as never)).toBe(DEFAULT_GEMINI_MODEL);
  });
});

describe("getGeminiFallbackModel", () => {
  it("reads GEMINI_FALLBACK_MODEL and falls back to the default", () => {
    expect(
      getGeminiFallbackModel({ GEMINI_FALLBACK_MODEL: " custom " } as never),
    ).toBe("custom");
    expect(getGeminiFallbackModel({ GEMINI_FALLBACK_MODEL: "" } as never)).toBe(
      DEFAULT_GEMINI_FALLBACK_MODEL,
    );
    expect(getGeminiFallbackModel({} as never)).toBe(
      DEFAULT_GEMINI_FALLBACK_MODEL,
    );
  });
});

const request = () => ({ system: "sys", user: "usr", responseSchema: {} });

describe("withFallback", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("uses the primary model when its call succeeds", async () => {
    const primary = mockClient(["{}"], "main");
    const fallback = mockClient(["{}"], "backup");
    const client = withFallback(primary, fallback);
    expect(client.model).toBe("main");
    await expect(client.generateJson(request())).resolves.toEqual({
      text: "{}",
      model: "main",
    });
    expect(fallback.calls).toHaveLength(0);
  });

  it("sends the same request to the fallback when the primary call fails", async () => {
    const primary = mockClient([new Error("429")], "main");
    const fallback = mockClient(["{}"], "backup");
    const answer = await withFallback(primary, fallback).generateJson(
      request(),
    );
    expect(answer).toEqual({ text: "{}", model: "backup" });
    expect(fallback.calls).toEqual([request()]);
    expect(console.warn).toHaveBeenCalledWith("ai.fallback", {
      from: "main",
      to: "backup",
      error: "429",
    });
  });

  it("throws the fallback error when both calls fail", async () => {
    const primary = mockClient([new Error("429")], "main");
    const fallback = mockClient([new Error("503")], "backup");
    await expect(
      withFallback(primary, fallback).generateJson(request()),
    ).rejects.toThrow("503");
  });
});

describe("getThinkingLevel", () => {
  it("defaults to low, accepts known levels, and turns off with none", () => {
    expect(getThinkingLevel({} as never)).toBe("low");
    expect(
      getThinkingLevel({ GEMINI_THINKING_LEVEL: " Medium " } as never),
    ).toBe("medium");
    expect(
      getThinkingLevel({ GEMINI_THINKING_LEVEL: "minimal" } as never),
    ).toBe("low");
    expect(
      getThinkingLevel({ GEMINI_THINKING_LEVEL: "none" } as never),
    ).toBeNull();
  });
});

describe("createGeminiClient", () => {
  beforeEach(() => generateContent.mockReset());

  it("requires an API key", () => {
    expect(() => createGeminiClient({} as never)).toThrow("GEMINI_API_KEY");
  });

  it("sends the model, prompt, and response schema", async () => {
    generateContent.mockResolvedValue({ text: '{"price":10}' });
    const client = createGeminiClient({
      GEMINI_API_KEY: "test",
      GEMINI_MODEL: "custom",
    } as never);

    const answer = await client.generateJson({
      system: "sys",
      user: "usr",
      responseSchema: { type: "object" },
    });

    expect(answer).toEqual({ text: '{"price":10}', model: "custom" });
    expect(client.model).toBe("custom");
    const request = generateContent.mock.calls[0][0];
    expect(request.model).toBe("custom");
    expect(request.contents).toBe("usr");
    expect(request.config.systemInstruction).toBe("sys");
    expect(request.config.responseJsonSchema).toEqual({ type: "object" });
    expect(request.config.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it("retries a failed call on the fallback model", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    generateContent
      .mockRejectedValueOnce(new Error("429"))
      .mockResolvedValueOnce({ text: "{}" });
    const client = createGeminiClient({ GEMINI_API_KEY: "test" } as never);

    const answer = await client.generateJson(request());

    expect(client.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(answer).toEqual({
      text: "{}",
      model: DEFAULT_GEMINI_FALLBACK_MODEL,
    });
    expect(generateContent.mock.calls.map(([r]) => r.model)).toEqual([
      DEFAULT_GEMINI_MODEL,
      DEFAULT_GEMINI_FALLBACK_MODEL,
    ]);
  });

  it("does not retry when the fallback is the main model", async () => {
    generateContent.mockRejectedValueOnce(new Error("429"));
    const client = createGeminiClient({
      GEMINI_API_KEY: "test",
      GEMINI_MODEL: "same",
      GEMINI_FALLBACK_MODEL: "same",
    } as never);

    await expect(client.generateJson(request())).rejects.toThrow("429");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
