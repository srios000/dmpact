import type { Agreement } from "@/lib/schema/agreement";

export function baseAgreement(overrides: Partial<Agreement> = {}): Agreement {
  return {
    schema_version: "1.0",
    service_type: "mix_and_master",
    service_other: null,
    title: "Original song mix & master",
    deliverables: [
      { id: "d1", description: "Full mix", quantity: 1, format: "WAV" },
    ],
    price: { total: "150.00", currency: "USD" },
    deposit: { type: "percent", percent: 50, fixed_amount: null },
    deadline: {
      date: "2026-11-20",
      raw_text: "Nov 20 2026",
      is_relative: false,
    },
    revisions: { included: 2, extra_fee: null },
    usage_rights: { commercial: true, credit_required: true, notes: null },
    parties: {
      client: { display_name: "Ren", handle: null, email: "ren@example.com" },
    },
    notes: null,
    ambiguities: [],
    extraction: {
      model: "",
      prompt_version: "",
      confidence: 0.9,
      source_language: "en",
    },
    ...overrides,
  };
}
