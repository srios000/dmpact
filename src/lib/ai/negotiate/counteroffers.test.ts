import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ModelClient } from "@/lib/ai/gemini";
import { agreementSchema, type Agreement } from "@/lib/schema/agreement";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import { negotiationSchema } from "@/lib/schema/negotiation";
import {
  DEFAULT_MISMATCH_THRESHOLD_PCT,
  DEFAULT_RATE_CARD,
  type RateCardSettings,
} from "@/lib/schema/rate-card";
import { generateCounteroffers, splitDepositPct } from "./counteroffers";
import type { CounterofferDrafts } from "./prompt";

const today = "2026-11-05";

const settings: RateCardSettings = {
  rate_card: DEFAULT_RATE_CARD,
  mismatch_threshold_pct: DEFAULT_MISMATCH_THRESHOLD_PCT,
};

// Illustration with 5 revisions: 100.00 base + 3 × 15.00 = 145.00 USD.
function agreement(overrides: Partial<Agreement> = {}): Agreement {
  return {
    ...exampleAgreement,
    service_type: "illustration",
    deliverables: [
      { id: "d1", description: "Full-body illustration", quantity: 1 },
      { id: "d2", description: "Transparent PNG", quantity: 1 },
    ],
    price: { total: "100.00", currency: "USD" },
    revisions: { included: 5 },
    usage_rights: { commercial: false },
    deadline: { date: "2026-12-01", raw_text: null, is_relative: false },
    ...overrides,
  };
}

const drafts: CounterofferDrafts = {
  reduce_scope: {
    keep_deliverable_ids: ["d1"],
    service_type: "illustration",
    revisions_included: 2,
    summary: "Illustration only, 2 revisions, for 100.00 USD",
    message_draft:
      "Hi Ren! For 100.00 USD I can do the illustration with 2 revisions.",
  },
  adjust_price: {
    summary: "Keep everything for 145.00 USD",
    message_draft: "Hi Ren! The full scope comes to 145.00 USD.",
  },
  split_milestones: {
    summary: "145.00 USD in 2 payments",
    message_draft: "Hi Ren! Pay 72.50 USD now and 72.50 USD on delivery.",
  },
};

function modelReturning(...outputs: unknown[]): ModelClient {
  const queue = [...outputs];
  return {
    model: "test-model",
    generateJson: vi.fn(async () => {
      const next = queue.length > 1 ? queue.shift() : queue[0];
      if (next instanceof Error) throw next;
      const text = typeof next === "string" ? next : JSON.stringify(next);
      return { text, model: "test-model" };
    }),
  };
}

// Mix & master with 2 revisions: 150.00 USD. Mastering only: 60.00 USD.
function mixAndMaster(total: string): Agreement {
  return {
    ...exampleAgreement,
    price: { total, currency: "USD" },
    deadline: { date: "2026-12-01", raw_text: null, is_relative: false },
  };
}

function withReduce(
  overrides: Partial<NonNullable<CounterofferDrafts["reduce_scope"]>>,
): CounterofferDrafts {
  return { ...drafts, reduce_scope: { ...drafts.reduce_scope!, ...overrides } };
}

describe("generateCounteroffers", () => {
  it("offers nothing and skips the model when the budget is fair", async () => {
    const client = modelReturning(drafts);
    const result = await generateCounteroffers({
      agreement: agreement({ price: { total: "145.00", currency: "USD" } }),
      settings,
      today,
      client,
    });
    expect(result.check.outcome).toBe("fair");
    expect(result.negotiation.options).toEqual([]);
    expect(client.generateJson).not.toHaveBeenCalled();
  });

  it("offers all three strategies with amounts from the rate card", async () => {
    const result = await generateCounteroffers({
      agreement: mixAndMaster("60.00"),
      settings,
      today,
      client: modelReturning(
        withReduce({
          keep_deliverable_ids: ["d2"],
          service_type: "mastering",
          revisions_included: 2,
        }),
      ),
    });

    expect(result.fallback).toBe(false);
    expect(negotiationSchema.safeParse(result.negotiation).success).toBe(true);
    const [reduce, adjust, split] = result.negotiation.options;

    expect(reduce.id).toBe("opt1");
    expect(reduce.strategy).toBe("reduce_scope");
    expect(reduce.proposed_agreement.service_type).toBe("mastering");
    expect(reduce.proposed_agreement.price.total).toBe("60.00");
    expect(reduce.proposed_agreement.deliverables.map((d) => d.id)).toEqual([
      "d2",
    ]);

    expect(adjust.strategy).toBe("adjust_price");
    expect(adjust.proposed_agreement.price.total).toBe("150.00");
    expect(adjust.proposed_agreement.deliverables).toHaveLength(2);
    expect(adjust.proposed_agreement.deposit.amount).toBe("75.00");

    expect(split.strategy).toBe("split_milestones");
    expect(split.proposed_agreement.price.total).toBe("150.00");
    expect(split.proposed_agreement.deposit).toEqual({
      type: "percent",
      percent: 40,
      fixed_amount: null,
      amount: "60.00",
    });
    expect(split.proposed_agreement.balance_amount).toBe("90.00");
  });

  it("skips split_milestones when the deposit would not change", async () => {
    const result = await generateCounteroffers({
      agreement: agreement(),
      settings,
      today,
      client: modelReturning(drafts),
    });
    // 100.00 of 145.00 is over 50%, so the split deposit equals the 50% deposit.
    expect(result.negotiation.options.map((o) => o.strategy)).toEqual([
      "reduce_scope",
      "adjust_price",
    ]);
  });

  it("recomputes the deposit and balance for the new price", async () => {
    const result = await generateCounteroffers({
      agreement: agreement(),
      settings,
      today,
      client: modelReturning(drafts),
    });
    const adjust = result.negotiation.options[1].proposed_agreement;
    expect(adjust.deposit.amount).toBe("72.50");
    expect(adjust.balance_amount).toBe("72.50");
  });

  it("drops a smaller scope the budget still doesn't cover", async () => {
    const result = await generateCounteroffers({
      agreement: agreement({ price: { total: "40.00", currency: "USD" } }),
      settings,
      today,
      client: modelReturning(drafts),
    });
    expect(result.negotiation.options.map((o) => o.strategy)).toEqual([
      "adjust_price",
      "split_milestones",
    ]);
    expect(result.negotiation.options[0].id).toBe("opt1");
  });

  it.each([
    ["an unknown deliverable", withReduce({ keep_deliverable_ids: ["d9"] })],
    ["a different service", withReduce({ service_type: "live2d_rigging" })],
  ])("drops a smaller scope with %s", async (_name, output) => {
    const result = await generateCounteroffers({
      agreement: agreement(),
      settings,
      today,
      client: modelReturning(output),
    });
    expect(result.negotiation.options.map((o) => o.strategy)).not.toContain(
      "reduce_scope",
    );
  });

  it("drops a smaller scope that adds revisions", async () => {
    // Mixing at 100.00 would fit the budget, but the message names 5 revisions.
    const result = await generateCounteroffers({
      agreement: mixAndMaster("100.00"),
      settings,
      today,
      client: modelReturning(
        withReduce({ service_type: "mixing", revisions_included: 5 }),
      ),
    });
    expect(result.negotiation.options.map((o) => o.strategy)).not.toContain(
      "reduce_scope",
    );
  });

  it("lets mix and master drop to mixing only", async () => {
    const result = await generateCounteroffers({
      agreement: mixAndMaster("100.00"),
      settings,
      today,
      client: modelReturning(
        withReduce({ service_type: "mixing", revisions_included: 2 }),
      ),
    });
    const reduce = result.negotiation.options[0];
    expect(reduce.strategy).toBe("reduce_scope");
    expect(reduce.proposed_agreement.service_type).toBe("mixing");
    expect(reduce.proposed_agreement.price.total).toBe("100.00");
  });

  it("rejects a price from the model and falls back to templates", async () => {
    const withPrice = {
      ...drafts,
      adjust_price: { ...drafts.adjust_price, price: "1.00" },
    };
    const client = modelReturning(withPrice);
    const result = await generateCounteroffers({
      agreement: agreement(),
      settings,
      today,
      client,
    });
    expect(client.generateJson).toHaveBeenCalledTimes(2);
    expect(result.fallback).toBe(true);
    expect(result.negotiation.options[0].proposed_agreement.price.total).toBe(
      "145.00",
    );
  });

  it("uses template messages when the model call fails", async () => {
    const result = await generateCounteroffers({
      agreement: agreement({ price: { total: "40.00", currency: "USD" } }),
      settings,
      today,
      client: modelReturning(new Error("quota exceeded")),
    });
    expect(result.fallback).toBe(true);
    expect(result.negotiation.options.map((o) => o.strategy)).toEqual([
      "adjust_price",
      "split_milestones",
    ]);
    expect(result.negotiation.options[1].message_draft).toBe(
      "Hi Ren! The full scope comes to 145.00 USD on my rates. To make it easier, you can pay 39.15 USD now and the remaining 105.85 USD on delivery.",
    );
  });

  it("uses template messages without a model client", async () => {
    const result = await generateCounteroffers({
      agreement: agreement({ price: { total: "40.00", currency: "USD" } }),
      settings,
      today,
      client: null,
    });
    expect(result.fallback).toBe(true);
    expect(result.negotiation.options).toHaveLength(2);
  });
});

describe("generateCounteroffers for a client writing Indonesian", () => {
  const indonesian = agreement({
    price: { total: "40.00", currency: "USD" },
    extraction: {
      model: "test",
      prompt_version: "test",
      confidence: 1,
      source_language: "id",
    },
  });

  it("asks the model for English", async () => {
    const client = modelReturning(drafts);
    await generateCounteroffers({
      agreement: indonesian,
      settings,
      today,
      client,
    });
    const [prompt] = vi.mocked(client.generateJson).mock.calls[0];
    expect(prompt.system).toContain("Always write in English");
  });

  it("falls back to English templates", async () => {
    const result = await generateCounteroffers({
      agreement: indonesian,
      settings,
      today,
      client: null,
    });
    expect(result.negotiation.options[0].message_draft).toBe(
      "Hi Ren! Thanks for the details. Based on my rates, the full scope comes to 145.00 USD. If that works for you, I can get started.",
    );
  });
});

describe("splitDepositPct", () => {
  it("is the share of the price the budget covers", () => {
    expect(splitDepositPct("30.00", "100.00", "USD")).toBe(30);
  });

  it("stays between 10% and 50%", () => {
    expect(splitDepositPct("5.00", "100.00", "USD")).toBe(10);
    expect(splitDepositPct("90.00", "100.00", "USD")).toBe(50);
  });
});

describe("generateCounteroffers on the lowball test DMs", () => {
  const dir = join(process.cwd(), "fixtures/dms");
  const cases = readdirSync(dir)
    .filter((file) => file.endsWith(".expected.json"))
    .map((file) => ({
      file,
      ...(JSON.parse(readFileSync(join(dir, file), "utf8")) as {
        paste_date: string;
        expected: Agreement;
        expect_mismatch: boolean;
      }),
    }))
    .filter((c) => c.expect_mismatch);

  it("has lowball cases", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)("$file", async ({ paste_date, expected }) => {
    // Fixtures list their flags in expected_ambiguity_codes instead, and their
    // extraction block only holds source_language for the eval.
    const result = await generateCounteroffers({
      agreement: { ...expected, ambiguities: [], extraction: undefined },
      settings,
      today: paste_date,
      client: null,
    });
    const { options } = result.negotiation;
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(agreementSchema.safeParse(option.proposed_agreement).success).toBe(
        true,
      );
      expect(option.proposed_agreement.price.total).toBe(
        result.check.mismatch.estimated_price,
      );
    }
  });
});
