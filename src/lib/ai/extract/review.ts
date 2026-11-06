import type { Agreement, Ambiguity } from "@/lib/schema/agreement";
import { DEFAULT_DEPOSIT_PERCENT, runPostChecks } from "./post-checks";

function valueAt(agreement: Agreement, pointer: string): unknown {
  return pointer
    .slice(1)
    .split("/")
    .map((key) => key.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce<unknown>(
      (node, key) =>
        node !== null && typeof node === "object"
          ? (node as Record<string, unknown>)[key]
          : undefined,
      agreement,
    );
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function keepUnresolvedFlags(
  original: Agreement,
  edited: Agreement,
): Ambiguity[] {
  return original.ambiguities.filter(
    (flag) =>
      flag.field === "/" ||
      sameValue(valueAt(original, flag.field), valueAt(edited, flag.field)),
  );
}

export type ReviewInput = {
  original: Agreement;
  edited: Agreement;
  dmText: string;
  pasteDate: string;
};

export function reviewAgreement({
  original,
  edited,
  dmText,
  pasteDate,
}: ReviewInput): Agreement {
  const next = structuredClone(edited);
  if (next.deadline.date !== original.deadline.date) {
    next.deadline.raw_text = next.deadline.date;
    next.deadline.is_relative = false;
  }
  next.ambiguities = keepUnresolvedFlags(original, edited);
  return runPostChecks({ agreement: next, dmText, pasteDate });
}

export function blankAgreement(pasteDate: string): Agreement {
  return runPostChecks({
    agreement: {
      schema_version: "1.0",
      service_type: "illustration",
      service_other: null,
      title: "",
      deliverables: [{ id: "d1", description: "", quantity: 1 }],
      price: { total: null, currency: "USD" },
      deposit: {
        type: "percent",
        percent: DEFAULT_DEPOSIT_PERCENT,
        fixed_amount: null,
      },
      deadline: { date: null, raw_text: null, is_relative: false },
      revisions: { included: null },
      ambiguities: [],
    },
    dmText: "",
    pasteDate,
  });
}
