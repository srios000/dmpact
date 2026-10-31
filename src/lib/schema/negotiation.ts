import { z } from "zod";
import { agreementSchema, currencySchema, moneySchema } from "./agreement";

export const STRATEGIES = [
  "reduce_scope",
  "adjust_price",
  "split_milestones",
] as const;

export const counterofferSchema = z.strictObject({
  id: z.string().min(1),
  strategy: z.enum(STRATEGIES),
  summary: z.string().min(1),
  message_draft: z.string().min(1),
  proposed_agreement: agreementSchema,
});

export const negotiationSchema = z
  .strictObject({
    mismatch: z.strictObject({
      detected: z.boolean(),
      client_budget: moneySchema.nullable(),
      estimated_price: moneySchema.nullable(),
      currency: currencySchema.nullable(),
      reason: z.string().min(1),
    }),
    options: z.array(counterofferSchema).max(3),
  })
  .superRefine((negotiation, ctx) => {
    const strategies = negotiation.options.map((o) => o.strategy);
    if (new Set(strategies).size !== strategies.length) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Each strategy can appear only once",
      });
    }
    if (!negotiation.mismatch.detected && negotiation.options.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "No counteroffers when there is no mismatch",
      });
    }
  });

export type Counteroffer = z.infer<typeof counterofferSchema>;
export type Negotiation = z.infer<typeof negotiationSchema>;
export type Strategy = (typeof STRATEGIES)[number];
