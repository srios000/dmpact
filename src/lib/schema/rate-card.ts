import { z } from "zod";
import {
  currencySchema,
  moneySchema,
  type ServiceType,
} from "./agreement";

export const DEFAULT_MISMATCH_THRESHOLD_PCT = 20;

// The mismatch gap divides by the estimate, so a base price can't be zero.
const basePriceSchema = moneySchema.regex(
  /[1-9]/,
  "Base price must be above zero",
);

// `other` has no rate card price: the mismatch check skips it.
const servicesShape = {
  mixing: basePriceSchema,
  mastering: basePriceSchema,
  mix_and_master: basePriceSchema,
  illustration: basePriceSchema,
  live2d_rigging: basePriceSchema,
  mv_editing: basePriceSchema,
  thumbnail: basePriceSchema,
} satisfies Record<Exclude<ServiceType, "other">, typeof basePriceSchema>;

export const rateCardSchema = z.strictObject({
  currency: currencySchema,
  services: z.strictObject(servicesShape),
  extras: z.strictObject({
    extra_revision: moneySchema,
    commercial_usage: moneySchema,
    rush_48h: moneySchema,
    source_file: moneySchema,
  }),
  included_revisions: z.int().min(0),
});

export type RateCard = z.infer<typeof rateCardSchema>;

// Base prices are the low end of each service, so a fair budget isn't flagged.
export const DEFAULT_RATE_CARD: RateCard = {
  currency: "USD",
  services: {
    mixing: "100.00",
    mastering: "60.00",
    mix_and_master: "150.00",
    illustration: "100.00",
    live2d_rigging: "350.00",
    mv_editing: "220.00",
    thumbnail: "50.00",
  },
  extras: {
    extra_revision: "15.00",
    commercial_usage: "40.00",
    rush_48h: "60.00",
    source_file: "25.00",
  },
  included_revisions: 2,
};
