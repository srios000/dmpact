# Agreement JSON Schema — v1 (DRAFT, needs sign-off)

> **This is the contract between all roles.** Backend stores it, AI extraction writes it, negotiation AI proposes new versions of it, the frontend renders it, and PayPal invoices are computed from it.
> **Status:** draft, not reviewed yet. Rio (Tech Lead) writes it and the others sign off. **Locks Sun Nov 1, 2026.** The change process after the lock hasn't been decided.

The source of truth in code will be a zod schema at `src/lib/schema/agreement.ts`. The machine-readable draft is [`schema/agreement.schema.json`](../schema/agreement.schema.json). This page explains the fields.

---

## 1. Design rules

1. **Money is a decimal string** in major units, matching PayPal: `"150.00"`. Never floats. JPY has no decimals (`"15000"`).
2. **Currency is ISO 4217** and must be one PayPal supports. IDR is **not** supported and must be flagged.
3. **Dates are ISO 8601** (`"2026-11-20"`). Time zone is the creator's unless stated.
4. **Unknown ≠ missing.** If the DM doesn't say, the value is `null` **and** an ambiguity is added. Don't guess silently.
5. **Money math happens in code.** `deposit.amount` and `balance_amount` are computed server-side from `price.total` + `deposit`. The AI's values for them are ignored.
6. **Agreements are immutable versions.** An edit creates `version + 1`. Confirmations bind to a version's `content_hash` (SHA-256 of the canonical JSON).
7. **`service_type: other` has no rate card price.** The mismatch check is skipped and the creator sets the price.

## 2. Fields

| Field | Type | Req | Notes |
|---|---|---|---|
| `schema_version` | `"1.0"` | ✓ | Bump on breaking change |
| `service_type` | enum | ✓ | `mixing` · `mastering` · `mix_and_master` · `illustration` · `live2d_rigging` · `mv_editing` · `thumbnail` · `other` |
| `service_other` | string \| null | ✓ | What the service is when `service_type` is `other` (e.g. "emote pack"), else `null` |
| `title` | string | ✓ | Short human title, e.g. "Original song mix — 'Starfall'" |
| `deliverables[]` | array | ✓ | ≥ 1 item |
| `deliverables[].id` | string | ✓ | `d1`, `d2`… stable across versions (used to diff versions) |
| `deliverables[].description` | string | ✓ | "Full mix (vocals + instrumental)" |
| `deliverables[].quantity` | integer ≥ 1 | ✓ | |
| `deliverables[].format` | string \| null | | "WAV 48kHz/24bit", "PNG 4K", "MP4 1080p" |
| `price.total` | money string \| null | ✓ | `null` → `MISSING_PRICE` blocker |
| `price.currency` | ISO 4217 \| null | ✓ | `null` → `AMBIGUOUS_CURRENCY` |
| `deposit.type` | `percent` \| `fixed` \| `none` | ✓ | |
| `deposit.percent` | number 0–100 \| null | ✓ | Set when `type = percent` (e.g. `50`), else `null` |
| `deposit.fixed_amount` | money string \| null | ✓ | Set when `type = fixed` (e.g. `"40.00"`), else `null` |
| `deposit.amount` | money string \| null | | **Computed by server** |
| `balance_amount` | money string \| null | | **Computed by server** = total − deposit |
| `deadline.date` | ISO date \| null | ✓ | |
| `deadline.raw_text` | string \| null | | Exact DM phrase, e.g. "before my debut on the 20th" |
| `deadline.is_relative` | boolean | ✓ | `true` → `RELATIVE_DEADLINE` warning |
| `revisions.included` | integer \| null | ✓ | `null` → `MISSING_REVISIONS` |
| `revisions.extra_fee` | money string \| null | | Price per extra revision |
| `usage_rights.commercial` | boolean \| null | | Monetized YouTube = commercial |
| `usage_rights.credit_required` | boolean \| null | | |
| `usage_rights.notes` | string \| null | | |
| `parties.client.display_name` | string \| null | | |
| `parties.client.handle` | string \| null | | "@ren_ch" |
| `parties.client.email` | string \| null | | Needed to send PayPal invoice. Asked on the client page if null |
| `notes` | string \| null | | Anything else relevant |
| `ambiguities[]` | array | ✓ | May be empty. See §3 |
| `extraction` | object | | Metadata, filled by extractor only |
| `extraction.model` | string | | e.g. the Gemini model ID |
| `extraction.prompt_version` | string | | e.g. `extract-v3` |
| `extraction.confidence` | number 0–1 | | Overall self-reported confidence |
| `extraction.source_language` | string | | `en`, `id`, `ja`, `mixed` |

**Stored outside the JSON (DB columns, not AI-writable):** `commission_id`, `version`, `content_hash`, `created_by`, `created_at`, `creator_confirmed_at`, `client_confirmed_at`, original DM text.

## 3. Ambiguity flags

```json
{
  "code": "RELATIVE_DEADLINE",
  "severity": "warning",
  "field": "/deadline/date",
  "message": "The deadline is relative (\"next Friday\"). I assumed 2026-11-06.",
  "source_quote": "can u finish by next friday?",
  "suggested_question": "Just to confirm, is the deadline Friday, Nov 6?"
}
```

| Field | Type | Notes |
|---|---|---|
| `code` | enum | See table below |
| `severity` | `blocker` \| `warning` | Blockers prevent sending to client |
| `field` | JSON Pointer | Path into the agreement. `/` = whole agreement |
| `message` | string | Plain language, for the creator |
| `source_quote` | string \| null | Verbatim from the DM |
| `suggested_question` | string \| null | Ready to send to the client |

| Code | Default severity | When |
|---|---|---|
| `MISSING_PRICE` | blocker | No price stated |
| `AMBIGUOUS_CURRENCY` | blocker | "$" with no context, or "150k" |
| `UNSUPPORTED_CURRENCY` | blocker | Currency PayPal doesn't support (IDR) |
| `CONFLICTING_VALUES` | blocker | Two different prices/deadlines in the DM |
| `SCOPE_UNCLEAR` | blocker | Can't tell what's being delivered |
| `MISSING_DEADLINE` | warning | |
| `RELATIVE_DEADLINE` | warning | "next Friday", "before debut" |
| `PAST_DEADLINE` | blocker | Resolved date is before today |
| `MISSING_REVISIONS` | warning | |
| `VAGUE_REVISIONS` | warning | "a few revisions", "unlimited" |
| `MISSING_DEPOSIT_TERMS` | warning | No DP mentioned. Default to 50% |
| `DEPOSIT_EXCEEDS_TOTAL` | blocker | |
| `USAGE_RIGHTS_UNCLEAR` | warning | Monetized use not addressed |
| `MISSING_CLIENT_EMAIL` | warning | Asked for on the client page |
| `OTHER` | warning | Free-form |

Deterministic post-checks in code also add flags (`UNSUPPORTED_CURRENCY`, `PAST_DEADLINE`, `DEPOSIT_EXCEEDS_TOTAL`, `MISSING_PRICE`). The LLM is not trusted alone for these.

## 4. Full example

```json
{
  "schema_version": "1.0",
  "service_type": "mix_and_master",
  "service_other": null,
  "title": "Original song mix & master — 'Starfall'",
  "deliverables": [
    { "id": "d1", "description": "Full mix (lead vocal, 2 harmonies, instrumental)", "quantity": 1, "format": "WAV 48kHz/24bit" },
    { "id": "d2", "description": "Master for streaming", "quantity": 1, "format": "WAV + MP3 320" },
    { "id": "d3", "description": "Instrumental + acapella stems", "quantity": 2, "format": "WAV" }
  ],
  "price": { "total": "150.00", "currency": "USD" },
  "deposit": { "type": "percent", "percent": 50, "fixed_amount": null, "amount": "75.00" },
  "balance_amount": "75.00",
  "deadline": { "date": "2026-11-20", "raw_text": "before my debut on the 20th", "is_relative": true },
  "revisions": { "included": 2, "extra_fee": "15.00" },
  "usage_rights": { "commercial": true, "credit_required": true, "notes": "Monetized YouTube premiere" },
  "parties": { "client": { "display_name": "Ren", "handle": "@ren_ch", "email": null } },
  "notes": null,
  "ambiguities": [
    {
      "code": "RELATIVE_DEADLINE", "severity": "warning", "field": "/deadline/date",
      "message": "\"The 20th\" assumed to be Nov 20, 2026.",
      "source_quote": "before my debut on the 20th",
      "suggested_question": "Is your debut on Nov 20? I'll deliver by the 18th so you have buffer."
    },
    {
      "code": "MISSING_CLIENT_EMAIL", "severity": "warning", "field": "/parties/client/email",
      "message": "Need the client's PayPal email to send the invoice.",
      "source_quote": null, "suggested_question": null
    }
  ],
  "extraction": { "model": "gemini-<model-id>", "prompt_version": "extract-v1", "confidence": 0.86, "source_language": "en" }
}
```

## 5. Negotiation output (consumes the agreement)

Owned by Firsta. Included here because each option carries a full agreement.

```json
{
  "mismatch": {
    "detected": true,
    "client_budget": "40.00",
    "estimated_price": "150.00",
    "currency": "USD",
    "reason": "Mix + master + stems with 3 revisions is estimated at $150 on your rate card; the budget is $40 (73% under)."
  },
  "options": [
    {
      "id": "opt1",
      "strategy": "reduce_scope",
      "summary": "Mix only, 1 revision, for $40",
      "message_draft": "Hi Ren! For $40 I can do the full mix with 1 revision round...",
      "proposed_agreement": { "...full agreement, same format as §4...": "" }
    },
    { "id": "opt2", "strategy": "adjust_price", "summary": "Keep everything for $150", "message_draft": "...", "proposed_agreement": { "...": "" } },
    { "id": "opt3", "strategy": "split_milestones", "summary": "$150 in 3 payments", "message_draft": "...", "proposed_agreement": { "...": "" } }
  ]
}
```

- `strategy` ∈ `reduce_scope` · `adjust_price` · `split_milestones`. At most 3 options, one per strategy.
- `proposed_agreement` is a complete agreement in the §4 format. The server validates it and recomputes the money fields; invalid options are dropped.
- The UI shows what changed by diffing `proposed_agreement` against the current version in code.
- MVP note: `split_milestones` still produces **2 PayPal invoices** (deposit + balance). The milestone split shows in the message and in the deposit %.

## 6. Sign-off

Tick in the GitHub issue *"Lock Agreement JSON schema v1"*, not here.
