/**
 * Extraction eval. Runs every fixtures/dms/*.expected.json through the real
 * Gemini model and scores it. Needs GEMINI_API_KEY (reads .env).
 *
 *   pnpm eval:extract            all cases
 *   pnpm eval:extract 003        only fixtures whose name contains "003"
 *
 *   pnpm eval:extract -- --out=evals/results/run.json   also write a JSON report
 *
 * Exit code 1 if key-field accuracy (price, currency, deadline, revisions,
 * deposit) is below 90%, ambiguity recall is below 85% (PRD section 5), or p95
 * latency is not under 10 s (NFR-1). Failed calls are left out of the latency
 * numbers and count as missed fields and flags.
 */
import "dotenv/config";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createGeminiClient } from "../src/lib/ai/gemini";
import { ExtractionError, extractAgreement } from "../src/lib/ai/extract";
import { EXTRACT_PROMPT_VERSION } from "../src/lib/ai/extract/prompt";
import {
  evaluateGates,
  flattenExpected,
  KEY_FIELD_ROOTS,
  percentile,
  scoreCase,
  summarize,
  type CaseScore,
  type EvalFixture,
} from "./score";

const FIXTURE_DIR = join(process.cwd(), "fixtures", "dms");

const seconds = (ms: number | null) =>
  ms === null ? "n/a" : `${(ms / 1000).toFixed(1)} s`;

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const outPath = args
    .find((arg) => arg.startsWith("--out="))
    ?.slice("--out=".length);
  const filter = args.find((arg) => !arg.startsWith("--"));
  const names = readdirSync(FIXTURE_DIR)
    .filter((file) => file.endsWith(".expected.json"))
    .map((file) => file.replace(".expected.json", ""))
    .filter((name) => !filter || name.includes(filter))
    .sort();

  if (names.length === 0) {
    console.error(
      `No fixtures found in ${FIXTURE_DIR}${filter ? ` matching "${filter}"` : ""}.`,
    );
    process.exit(1);
  }

  const client = createGeminiClient();
  console.log(
    `Model: ${client.model} | prompt: ${EXTRACT_PROMPT_VERSION} | cases: ${names.length}\n`,
  );

  const report: Array<Record<string, unknown>> = [];

  const scores: CaseScore[] = [];
  const latencies: number[] = [];
  for (const name of names) {
    const dmText = readFileSync(join(FIXTURE_DIR, `${name}.txt`), "utf8");
    const fixture = JSON.parse(
      readFileSync(join(FIXTURE_DIR, `${name}.expected.json`), "utf8"),
    ) as EvalFixture;

    let score: CaseScore;
    let note = "";
    let latency: number | null = null;
    let model: string | null = null;
    const startedAt = performance.now();
    try {
      const { agreement, attempts, fallback } = await extractAgreement(
        { dmText, pasteDate: fixture.paste_date },
        client,
      );
      latency = performance.now() - startedAt;
      latencies.push(latency);
      model = agreement.extraction?.model ?? null;
      score = scoreCase(fixture, agreement);
      if (attempts === 2) note = " (needed repair retry)";
      if (fallback) note = " (fell back to a draft)";
      if (model !== client.model) note += ` (answered by ${model})`;
    } catch (error) {
      const detail =
        error instanceof ExtractionError
          ? `${error.code}: ${error.message} ${error.details.join("; ")}`
          : String(error);
      const keyLeaves = flattenExpected(fixture.expected).filter((leaf) =>
        KEY_FIELD_ROOTS.has(leaf.path[0]),
      );
      score = {
        fieldsTotal: 1,
        fieldsMatched: 0,
        keyFieldsTotal: keyLeaves.length,
        keyFieldsMatched: 0,
        extraCodes: [],
        mismatches: [
          { path: "/", expected: "valid agreement", actual: detail },
        ],
        missingCodes: fixture.expected_ambiguity_codes,
        unexpectedBlockers: [],
        expectedCodes: fixture.expected_ambiguity_codes.length,
        pass: false,
      };
    }

    scores.push(score);
    report.push({
      name,
      model,
      latencyMs: latency,
      note: note.trim(),
      ...score,
    });
    console.log(
      `${score.pass ? "PASS" : "FAIL"}  ${name} [${seconds(latency)}]${note}`,
    );
    for (const m of score.mismatches) {
      console.log(
        `      ${m.path}: expected ${JSON.stringify(m.expected)}, got ${JSON.stringify(m.actual)}`,
      );
    }
    if (score.missingCodes.length)
      console.log(`      missing flags: ${score.missingCodes.join(", ")}`);
    if (score.extraCodes.length)
      console.log(`      extra flags (info): ${score.extraCodes.join(", ")}`);
    if (score.unexpectedBlockers.length)
      console.log(
        `      unexpected blockers: ${score.unexpectedBlockers.join(", ")}`,
      );
  }

  const summary = summarize(scores);
  const p95 = percentile(latencies, 95);
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  console.log(
    `\nPassed ${summary.passed}/${summary.cases} (${pct(summary.passRate)}) | key-field accuracy ${pct(summary.keyFieldAccuracy)} | all-field accuracy ${pct(summary.fieldAccuracy)} | ambiguity recall ${pct(summary.ambiguityRecall)} | flag precision ${pct(summary.ambiguityPrecision)} (info)`,
  );
  console.log(
    `Latency over ${latencies.length} completed calls | p50 ${seconds(percentile(latencies, 50))} | p95 ${seconds(p95)} | max ${seconds(percentile(latencies, 100))}`,
  );

  const gates = evaluateGates(summary, p95);
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
          promptVersion: EXTRACT_PROMPT_VERSION,
          filter: filter ?? null,
          summary,
          latencyMs: {
            p50: percentile(latencies, 50),
            p95,
            max: percentile(latencies, 100),
          },
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
