import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { jsonSchemas, renderJsonSchema } from "./json-schema";

describe("committed JSON Schema files", () => {
  it.each(Object.keys(jsonSchemas) as (keyof typeof jsonSchemas)[])(
    "schema/%s matches the zod schema (run pnpm schema:generate)",
    (name) => {
      const committed = readFileSync(join("schema", name), "utf-8").replace(
        /\r\n/g,
        "\n",
      );
      expect(committed).toBe(renderJsonSchema(name));
    },
  );
});
