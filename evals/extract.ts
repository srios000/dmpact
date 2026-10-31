/**
 * Extraction eval. Runs every fixtures/dms/*.expected.json through the real
 * Gemini model and scores it. Needs GEMINI_API_KEY (reads .env).
 *
 *   pnpm eval:extract            all cases
 *   pnpm eval:extract 003        only fixtures whose name contains "003"
 *
 * Exit code 1 if field accuracy is below 90% or ambiguity recall is below 85%
 * (PRD section 5).
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createGeminiClient } from "../src/lib/ai/gemini";
import { ExtractionError, extractAgreement } from "../src/lib/ai/extract";
import {
  scoreCase,
  summarize,
  type CaseScore,
  type EvalFixture,
} from "./score";

const FIXTURE_DIR = join(process.cwd(), "fixtures", "dms");
const MIN_FIELD_ACCURACY = 0.9;
const MIN_AMBIGUITY_RECALL = 0.85;

async function main() {
  const filter = process.argv[2];
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
  console.log(`Model: ${client.model} | cases: ${names.length}\n`);

  const scores: CaseScore[] = [];
  for (const name of names) {
    const dmText = readFileSync(join(FIXTURE_DIR, `${name}.txt`), "utf8");
    const fixture = JSON.parse(
      readFileSync(join(FIXTURE_DIR, `${name}.expected.json`), "utf8"),
    ) as EvalFixture;

    let score: CaseScore;
    let note = "";
    try {
      const { agreement, attempts, fallback } = await extractAgreement(
        { dmText, pasteDate: fixture.paste_date },
        client,
      );
      score = scoreCase(fixture, agreement);
      if (attempts === 2) note = " (needed repair retry)";
      if (fallback) note = " (fell back to a draft)";
    } catch (error) {
      const detail =
        error instanceof ExtractionError
          ? `${error.code}: ${error.message} ${error.details.join("; ")}`
          : String(error);
      score = {
        fieldsTotal: 1,
        fieldsMatched: 0,
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
    console.log(`${score.pass ? "PASS" : "FAIL"}  ${name}${note}`);
    for (const m of score.mismatches) {
      console.log(
        `      ${m.path}: expected ${JSON.stringify(m.expected)}, got ${JSON.stringify(m.actual)}`,
      );
    }
    if (score.missingCodes.length)
      console.log(`      missing flags: ${score.missingCodes.join(", ")}`);
    if (score.unexpectedBlockers.length)
      console.log(
        `      unexpected blockers: ${score.unexpectedBlockers.join(", ")}`,
      );
  }

  const summary = summarize(scores);
  console.log(
    `\nPassed ${summary.passed}/${summary.cases} (${(summary.passRate * 100).toFixed(0)}%) | field accuracy ${(summary.fieldAccuracy * 100).toFixed(0)}% | ambiguity recall ${(summary.ambiguityRecall * 100).toFixed(0)}%`,
  );
  process.exit(
    summary.fieldAccuracy >= MIN_FIELD_ACCURACY &&
      summary.ambiguityRecall >= MIN_AMBIGUITY_RECALL
      ? 0
      : 1,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
