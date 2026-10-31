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
  mismatches: FieldMismatch[];
  missingCodes: string[];
  unexpectedBlockers: string[];
  expectedCodes: number;
  pass: boolean;
};

export const SKIPPED_KEYS = new Set([
  "title",
  "notes",
  "description",
  "format",
  "raw_text",
  "message",
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

  const actualCodes = new Set(actual.ambiguities.map((a) => a.code));
  const expectedCodes = new Set(fixture.expected_ambiguity_codes);
  const missingCodes = [...expectedCodes].filter(
    (code) => !actualCodes.has(code),
  );
  const unexpectedBlockers = actual.ambiguities
    .filter((a) => a.severity === "blocker" && !expectedCodes.has(a.code))
    .map((a) => a.code);

  return {
    fieldsTotal: leaves.length,
    fieldsMatched: leaves.length - mismatches.length,
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

export type Summary = {
  cases: number;
  passed: number;
  passRate: number;
  fieldAccuracy: number;
  ambiguityRecall: number;
};

export function summarize(scores: CaseScore[]): Summary {
  const passed = scores.filter((s) => s.pass).length;
  const total = scores.reduce((sum, s) => sum + s.fieldsTotal, 0);
  const matched = scores.reduce((sum, s) => sum + s.fieldsMatched, 0);
  const codes = scores.reduce((sum, s) => sum + s.expectedCodes, 0);
  const missed = scores.reduce((sum, s) => sum + s.missingCodes.length, 0);
  return {
    cases: scores.length,
    passed,
    passRate: scores.length === 0 ? 0 : passed / scores.length,
    fieldAccuracy: total === 0 ? 0 : matched / total,
    ambiguityRecall: codes === 0 ? 1 : (codes - missed) / codes,
  };
}
