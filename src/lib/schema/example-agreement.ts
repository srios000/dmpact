import type { Agreement } from "./agreement";

export const exampleAgreement: Agreement = {
  schema_version: "1.0",
  service_type: "mix_and_master",
  service_other: null,
  title: "Original song mix & master — 'Starfall'",
  deliverables: [
    {
      id: "d1",
      description: "Full mix (lead vocal, 2 harmonies, instrumental)",
      quantity: 1,
      format: "WAV 48kHz/24bit",
    },
    {
      id: "d2",
      description: "Master for streaming",
      quantity: 1,
      format: "WAV + MP3 320",
    },
  ],
  price: { total: "150.00", currency: "USD" },
  deposit: { type: "percent", percent: 50, fixed_amount: null, amount: "75.00" },
  balance_amount: "75.00",
  deadline: {
    date: "2026-11-20",
    raw_text: "before my debut on the 20th",
    is_relative: true,
  },
  revisions: { included: 2, extra_fee: "15.00" },
  usage_rights: { commercial: true, credit_required: true, notes: null },
  parties: { client: { display_name: "Ren", handle: "@ren_ch", email: null } },
  notes: null,
  ambiguities: [
    {
      code: "RELATIVE_DEADLINE",
      severity: "warning",
      field: "/deadline/date",
      message: '"The 20th" assumed to be Nov 20, 2026.',
      source_quote: "before my debut on the 20th",
      suggested_question: "Is your debut on Nov 20?",
    },
  ],
  extraction: {
    model: "gemini",
    prompt_version: "extract-v1",
    confidence: 0.86,
    source_language: "en",
  },
};
