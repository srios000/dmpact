import { z } from "zod";
import { agreementSchema } from "./agreement";
import { negotiationSchema } from "./negotiation";

export const jsonSchemas = {
  "agreement.schema.json": () =>
    z.toJSONSchema(agreementSchema, { target: "draft-2020-12" }),
  "negotiation.schema.json": () =>
    z.toJSONSchema(negotiationSchema, { target: "draft-2020-12" }),
};

export function renderJsonSchema(name: keyof typeof jsonSchemas): string {
  return `${JSON.stringify(jsonSchemas[name](), null, 2)}\n`;
}
