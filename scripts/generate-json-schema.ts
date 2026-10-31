import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { jsonSchemas, renderJsonSchema } from "../src/lib/schema/json-schema";

for (const name of Object.keys(jsonSchemas) as (keyof typeof jsonSchemas)[]) {
  writeFileSync(join("schema", name), renderJsonSchema(name));
  console.log(`wrote schema/${name}`);
}
