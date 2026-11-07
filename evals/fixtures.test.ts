/**
 * Offline checks on fixtures/dms (F15). No model call and no API key needed.
 * They catch a broken or self-contradicting fixture before a paid eval run
 * wastes quota on it: the expected values must obey the same PRD rules the
 * extraction enforces (FR-1.5, FR-1.6, FR-6.8).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeAmounts } from "@/lib/money/decimal";
import { AMBIGUITY_CODES, AMBIGUITY_SEVERITY } from "@/lib/schema/agreement";
import { scoreCase, type EvalFixture } from "./score";

const DIR = join(process.cwd(), "fixtures", "dms");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_LANGUAGES = ["en", "id", "ja", "mixed"];

type Fixture = EvalFixture & { expect_mismatch?: boolean };
type Expected = {
  price?: { total?: string | null; currency?: string | null };
  deposit?: {
    type?: "percent" | "fixed" | "none";
    percent?: number | null;
    fixed_amount?: string | null;
    amount?: string | null;
  };
  deadline?: { date?: string | null; is_relative?: boolean };
  service_type?: string;
  service_other?: string | null;
  extraction?: { source_language?: string };
};

const files = readdirSync(DIR);
const names = files
  .filter((f) => f.endsWith(".expected.json"))
  .map((f) => f.replace(".expected.json", ""))
  .sort();

const load = (name: string) =>
  JSON.parse(
    readFileSync(join(DIR, `${name}.expected.json`), "utf8"),
  ) as Fixture;

describe("fixtures/dms", () => {
  it("has the 21-case coverage target", () => {
    expect(names.length).toBeGreaterThanOrEqual(21);
  });

  it("pairs every DM text with an expected file and back", () => {
    const texts = files
      .filter((f) => f.endsWith(".txt"))
      .map((f) => f.replace(".txt", ""))
      .sort();
    expect(texts).toEqual(names);
  });

  it("uses non-empty DM text", () => {
    for (const name of names) {
      const text = readFileSync(join(DIR, `${name}.txt`), "utf8");
      expect(text.trim().length > 0).toBe(true);
    }
  });

  for (const name of names) {
    it(`${name}: is well-formed`, () => {
      const fixture = load(name);
      expect(ISO_DATE.test(fixture.paste_date)).toBe(true);
      expect(typeof fixture.expected).toBe("object");
      for (const code of fixture.expected_ambiguity_codes) {
        expect(AMBIGUITY_CODES as readonly string[]).toContain(code);
      }
      expect(new Set(fixture.expected_ambiguity_codes).size).toBe(
        fixture.expected_ambiguity_codes.length,
      );
      const { extraction } = fixture.expected as Expected;
      expect(SOURCE_LANGUAGES).toContain(extraction?.source_language);
    });

    it(`${name}: expected values follow the PRD rules`, () => {
      const fixture = load(name);
      const expected = fixture.expected as Expected;
      const codes = new Set(fixture.expected_ambiguity_codes);

      // FR-1.5: a relative deadline is flagged, and only then.
      if (expected.deadline?.is_relative !== undefined) {
        expect(codes.has("RELATIVE_DEADLINE")).toBe(
          expected.deadline.is_relative && expected.deadline.date != null,
        );
      }
      // A date before the paste date is a PAST_DEADLINE blocker.
      const date = expected.deadline?.date;
      if (date) {
        expect(codes.has("PAST_DEADLINE")).toBe(date < fixture.paste_date);
      }
      // A null deadline means MISSING_DEADLINE (FR-1.9), a set one does not.
      // An unresolved conflict also leaves the field null (CONFLICTING_VALUES).
      if (expected.deadline && "date" in expected.deadline) {
        if (expected.deadline.date === null) {
          expect(
            codes.has("MISSING_DEADLINE") || codes.has("CONFLICTING_VALUES"),
          ).toBe(true);
        } else {
          expect(codes.has("MISSING_DEADLINE")).toBe(false);
        }
      }
      // FR-1.6: IDR is flagged as unsupported.
      if (expected.price?.currency) {
        expect(codes.has("UNSUPPORTED_CURRENCY")).toBe(
          expected.price.currency === "IDR",
        );
      }
      // A null price is flagged (missing or conflicting).
      if (expected.price && "total" in expected.price) {
        if (expected.price.total === null) {
          expect(
            codes.has("MISSING_PRICE") || codes.has("CONFLICTING_VALUES"),
          ).toBe(true);
        } else {
          expect(codes.has("MISSING_PRICE")).toBe(false);
        }
      }
      // service_other only goes with service_type "other".
      if (expected.service_type) {
        const other = expected.service_other ?? null;
        if (expected.service_type === "other") {
          expect(typeof other === "string" && other.length > 0).toBe(true);
        } else {
          expect(other).toBeNull();
        }
      }
    });

    it(`${name}: deposit and balance arithmetic is consistent (FR-6.8)`, () => {
      const { price, deposit } = load(name).expected as Expected;
      if (!price?.total || !deposit?.type || deposit.amount == null) return;
      const amounts = computeAmounts(price.total, price.currency ?? null, {
        type: deposit.type,
        percent: deposit.percent ?? null,
        fixed_amount: deposit.fixed_amount ?? null,
      });
      expect(amounts).not.toBeNull();
      expect(Number(amounts?.deposit)).toBe(Number(deposit.amount));
    });

    it(`${name}: a perfect answer scores as a pass`, () => {
      const fixture = load(name);
      const perfect = {
        ...(fixture.expected as Record<string, unknown>),
        ambiguities: fixture.expected_ambiguity_codes.map((code) => ({
          code,
          severity: AMBIGUITY_SEVERITY[code as keyof typeof AMBIGUITY_SEVERITY],
        })),
      };
      const score = scoreCase(fixture, perfect);
      expect(score.mismatches).toEqual([]);
      expect(score.pass).toBe(true);
    });
  }
});
