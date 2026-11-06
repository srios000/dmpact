/**
 * Negotiation eval. Runs the fixtures/dms agreements through mismatch detection
 * and the real Gemini counteroffer writer, then scores the result. Needs
 * GEMINI_API_KEY (reads .env).
 *
 *   pnpm eval:negotiate            all cases, plus a near-miss copy of each fair one
 *   pnpm eval:negotiate 014        only cases whose name contains "014"
 *   pnpm eval:negotiate -- --no-near-miss   fixtures only, fewer model calls
 *   pnpm eval:negotiate -- --out=evals/results/negotiate.json
 *
 * Exit code 1 if mismatch accuracy or amount accuracy is below 100%, or the
 * model wrote fewer than 90% of the mismatch cases (the rest used templates).
 */
import "dotenv/config";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createGeminiClient } from "../src/lib/ai/gemini";
import { generateCounteroffers } from "../src/lib/ai/negotiate/counteroffers";
import { detectMismatch } from "../src/lib/ai/negotiate/mismatch";
import { COUNTEROFFER_PROMPT_VERSION } from "../src/lib/ai/negotiate/prompt";
import type { Agreement } from "../src/lib/schema/agreement";
import {
  DEFAULT_MISMATCH_THRESHOLD_PCT,
  DEFAULT_RATE_CARD,
  type RateCardSettings,
} from "../src/lib/schema/rate-card";
import {
  evaluateNegotiationGates,
  lowerBudget,
  percentile,
  scoreNegotiationCase,
  summarizeNegotiation,
  type NegotiationCaseScore,
} from "./negotiate-score";

const FIXTURE_DIR = join(process.cwd(), "fixtures", "dms");

const settings: RateCardSettings = {
  rate_card: DEFAULT_RATE_CARD,
  mismatch_threshold_pct: DEFAULT_MISMATCH_THRESHOLD_PCT,
};

type EvalCase = {
  name: string;
  today: string;
  agreement: Agreement;
  expectMismatch: boolean;
};

const seconds = (ms: number | null) =>
  ms === null ? "n/a" : `${(ms / 1000).toFixed(1)} s`;

function loadCases(nearMiss: boolean): EvalCase[] {
  const cases: EvalCase[] = [];
  for (const file of readdirSync(FIXTURE_DIR).sort()) {
    if (!file.endsWith(".expected.json")) continue;
    const fixture = JSON.parse(
      readFileSync(join(FIXTURE_DIR, file), "utf8"),
    ) as { paste_date: string; expected: Agreement; expect_mismatch: boolean };
    const name = file.replace(".expected.json", "");
    // Fixtures list their flags in expected_ambiguity_codes instead, and their
    // extraction block only holds source_language for the eval.
    const agreement = {
      ...fixture.expected,
      ambiguities: [],
      extraction: undefined,
    };
    cases.push({
      name,
      today: fixture.paste_date,
      agreement,
      expectMismatch: fixture.expect_mismatch,
    });

    const check = detectMismatch(agreement, settings, fixture.paste_date);
    if (nearMiss && check.outcome === "fair") {
      cases.push({
        name: `${name}+near-miss`,
        today: fixture.paste_date,
        agreement: lowerBudget(agreement, check.estimate!.total),
        expectMismatch: true,
      });
    }
  }
  return cases;
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const outPath = args
    .find((arg) => arg.startsWith("--out="))
    ?.slice("--out=".length);
  const filter = args.find((arg) => !arg.startsWith("--"));
  const cases = loadCases(!args.includes("--no-near-miss")).filter(
    (c) => !filter || c.name.includes(filter),
  );

  if (cases.length === 0) {
    console.error(`No cases${filter ? ` matching "${filter}"` : ""}.`);
    process.exit(1);
  }

  const client = createGeminiClient();
  console.log(
    `Model: ${client.model} | prompt: ${COUNTEROFFER_PROMPT_VERSION} | cases: ${cases.length}\n`,
  );

  const scores: NegotiationCaseScore[] = [];
  const latencies: number[] = [];
  const report: Array<Record<string, unknown>> = [];

  for (const c of cases) {
    const startedAt = performance.now();
    const result = await generateCounteroffers({
      agreement: c.agreement,
      settings,
      today: c.today,
      client,
    });
    const latency =
      result.check.outcome === "mismatch"
        ? performance.now() - startedAt
        : null;
    if (latency !== null) latencies.push(latency);

    const score = scoreNegotiationCase({
      expectMismatch: c.expectMismatch,
      agreement: c.agreement,
      result,
    });
    scores.push(score);
    report.push({
      name: c.name,
      latencyMs: latency,
      outcome: result.check.outcome,
      ...score,
      messages: result.negotiation.options.map((o) => ({
        strategy: o.strategy,
        summary: o.summary,
        message_draft: o.message_draft,
      })),
    });

    const strategies = score.options.map((o) => o.strategy).join(", ");
    console.log(
      `${score.pass ? "PASS" : "FAIL"}  ${c.name} [${result.check.outcome}${latency === null ? "" : `, ${seconds(latency)}`}]${strategies ? ` ${strategies}` : ""}`,
    );
    if (!score.mismatchOk) {
      console.log(
        `      expected mismatch ${c.expectMismatch}, got ${score.detected}`,
      );
    }
    if (score.fallback) console.log("      model failed: template messages");
    for (const o of score.options) {
      if (o.unknownAmounts.length) {
        console.log(
          `      ${o.strategy}: amounts not in the option: ${o.unknownAmounts.join(", ")}`,
        );
      }
      if (o.missingAmount) {
        console.log(`      ${o.strategy}: doesn't mention ${o.missingAmount}`);
      }
    }
  }

  const summary = summarizeNegotiation(scores);
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  console.log(
    `\nPassed ${summary.passed}/${summary.cases} | mismatch accuracy ${pct(summary.mismatchAccuracy)} | amount accuracy ${pct(summary.amountAccuracy)} over ${summary.optionCount} options | model success ${pct(summary.modelSuccessRate)}`,
  );
  console.log(
    `Options: reduce_scope ${summary.strategies.reduce_scope}, adjust_price ${summary.strategies.adjust_price}, split_milestones ${summary.strategies.split_milestones}`,
  );
  console.log(
    `Latency over ${latencies.length} model cases | p50 ${seconds(percentile(latencies, 50))} | p95 ${seconds(percentile(latencies, 95))} (info)`,
  );

  const gates = evaluateNegotiationGates(summary);
  console.log(
    gates.pass
      ? "Targets met."
      : `Targets missed: ${gates.failures.join("; ")}.`,
  );

  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          model: client.model,
          promptVersion: COUNTEROFFER_PROMPT_VERSION,
          filter: filter ?? null,
          summary,
          gates,
          cases: report,
        },
        null,
        2,
      ),
    );
    console.log(`Report written to ${outPath}`);
  }
  process.exit(gates.pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
