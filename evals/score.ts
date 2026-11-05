/**
 * Pure scoring for the extraction eval. A fixture's `expected` object is a
 * partial agreement: only the leaf values it lists are checked. Free-text
 * fields are skipped because wording varies between runs.
 */

export type EvalFixture = {
  paste_date: string;
  expected: Record<string, unknown>;
  expected_ambiguity_codes: string[];
};

export type ActualAmbiguity = { code: string; severity: string };

export type FieldMismatch = {
  path: string;
  expected: unknown;
  actual: unknown;
};

export type CaseScore = {
  fieldsTotal: number;
  fieldsMatched: number;
  /** Only the PRD key fields: price, deposit, deadline, revisions. */
  keyFieldsTotal: number;
  keyFieldsMatched: number;
  /** Flag codes the fixture did not list (any severity). Informational. */
  extraCodes: string[];
  mismatches: FieldMismatch[];
  missingCodes: string[];
  unexpectedBlockers: string[];
  expectedCodes: number;
  pass: boolean;
};

export const SKIPPED_KEYS = new Set([
  "title",
  "service_other",
  "notes",
  "description",
  "format",
  "raw_text",
  "message",
]);

/**
 * PRD section 5 measures accuracy on price, currency, deadline, revisions and
 * deposit. Currency lives under price, so these four top-level keys cover all five.
 */
export const KEY_FIELD_ROOTS = new Set([
  "price",
  "deposit",
  "deadline",
  "revisions",
]);

export function flattenExpected(
  value: unknown,
  path: string[] = [],
): Array<{ path: string[]; value: unknown }> {
  if (path.some((segment) => SKIPPED_KEYS.has(segment))) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, i) =>
      flattenExpected(item, [...path, String(i)]),
    );
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(
      ([key, item]) => flattenExpected(item, [...path, key]),
    );
  }
  return [{ path, value }];
}

function getAt(root: unknown, path: string[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

const NUMERIC = /^\d+(\.\d+)?$/;

export function valuesMatch(expected: unknown, actual: unknown): boolean {
  if (expected === null && actual === undefined) return true;
  if (
    typeof expected === "string" &&
    typeof actual === "string" &&
    NUMERIC.test(expected) &&
    NUMERIC.test(actual)
  ) {
    return Number(expected) === Number(actual);
  }
  return expected === actual;
}

export function scoreCase(
  fixture: EvalFixture,
  actual: { ambiguities: ActualAmbiguity[] } & Record<string, unknown>,
): CaseScore {
  const leaves = flattenExpected(fixture.expected);
  const mismatches: FieldMismatch[] = [];
  for (const leaf of leaves) {
    const got = getAt(actual, leaf.path);
    if (!valuesMatch(leaf.value, got)) {
      mismatches.push({
        path: "/" + leaf.path.join("/"),
        expected: leaf.value,
        actual: got,
      });
    }
  }

  const keyLeaves = leaves.filter((leaf) => KEY_FIELD_ROOTS.has(leaf.path[0]));
  const keyMismatches = mismatches.filter((m) =>
    KEY_FIELD_ROOTS.has(m.path.split("/")[1]),
  );

  const actualCodes = new Set(actual.ambiguities.map((a) => a.code));
  const expectedCodes = new Set(fixture.expected_ambiguity_codes);
  const missingCodes = [...expectedCodes].filter(
    (code) => !actualCodes.has(code),
  );
  const unexpectedBlockers = actual.ambiguities
    .filter((a) => a.severity === "blocker" && !expectedCodes.has(a.code))
    .map((a) => a.code);

  const extraCodes = [...actualCodes].filter(
    (code) => !expectedCodes.has(code),
  );

  return {
    fieldsTotal: leaves.length,
    fieldsMatched: leaves.length - mismatches.length,
    keyFieldsTotal: keyLeaves.length,
    keyFieldsMatched: keyLeaves.length - keyMismatches.length,
    extraCodes,
    mismatches,
    missingCodes,
    unexpectedBlockers,
    expectedCodes: expectedCodes.size,
    pass:
      mismatches.length === 0 &&
      missingCodes.length === 0 &&
      unexpectedBlockers.length === 0,
  };
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

export type Summary = {
  cases: number;
  passed: number;
  passRate: number;
  /** All listed leaf values. */
  fieldAccuracy: number;
  /** PRD metric: price, currency, deadline, revisions, deposit. */
  keyFieldAccuracy: number;
  ambiguityRecall: number;
  /** Informational: share of returned flag codes the fixtures listed. */
  ambiguityPrecision: number;
};

export function summarize(scores: CaseScore[]): Summary {
  const passed = scores.filter((s) => s.pass).length;
  const total = scores.reduce((sum, s) => sum + s.fieldsTotal, 0);
  const matched = scores.reduce((sum, s) => sum + s.fieldsMatched, 0);
  const keyTotal = scores.reduce((sum, s) => sum + s.keyFieldsTotal, 0);
  const keyMatched = scores.reduce((sum, s) => sum + s.keyFieldsMatched, 0);
  const codes = scores.reduce((sum, s) => sum + s.expectedCodes, 0);
  const missed = scores.reduce((sum, s) => sum + s.missingCodes.length, 0);
  const extra = scores.reduce((sum, s) => sum + s.extraCodes.length, 0);
  const returned = scores.reduce(
    (sum, s) =>
      sum + s.extraCodes.length + (s.expectedCodes - s.missingCodes.length),
    0,
  );
  return {
    cases: scores.length,
    passed,
    passRate: scores.length === 0 ? 0 : passed / scores.length,
    fieldAccuracy: total === 0 ? 0 : matched / total,
    keyFieldAccuracy: keyTotal === 0 ? 0 : keyMatched / keyTotal,
    ambiguityRecall: codes === 0 ? 1 : (codes - missed) / codes,
    ambiguityPrecision: returned === 0 ? 1 : (returned - extra) / returned,
  };
}

export const MIN_KEY_FIELD_ACCURACY = 0.9;
export const MIN_AMBIGUITY_RECALL = 0.85;
export const MAX_P95_MS = 10_000;

/** PRD section 5 targets and NFR-1. Returns every target that was missed. */
export function evaluateGates(
  summary: Summary,
  p95Ms: number | null,
): { pass: boolean; failures: string[] } {
  const failures: string[] = [];
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  if (summary.keyFieldAccuracy < MIN_KEY_FIELD_ACCURACY) {
    failures.push(
      `key-field accuracy ${pct(summary.keyFieldAccuracy)} < ${pct(MIN_KEY_FIELD_ACCURACY)}`,
    );
  }
  if (summary.ambiguityRecall < MIN_AMBIGUITY_RECALL) {
    failures.push(
      `ambiguity recall ${pct(summary.ambiguityRecall)} < ${pct(MIN_AMBIGUITY_RECALL)}`,
    );
  }
  if (p95Ms === null) {
    failures.push("no completed calls, so p95 latency is unknown");
  } else if (p95Ms >= MAX_P95_MS) {
    failures.push(`p95 latency ${(p95Ms / 1000).toFixed(1)} s >= 10 s`);
  }
  return { pass: failures.length === 0, failures };
}
