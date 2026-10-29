# DMpact — Product Requirements Document

| | |
|---|---|
| **Product** | DMpact |
| **Event** | Build What's Next with PayPal and AI (Devpost) |
| **Hard deadline** | **Nov 12, 2026, 12:00 PM PST** (= Nov 13, 03:00 WIB) |
| **Status** | Draft, not yet reviewed by the team |
| **Related** | [URD](URD.md) · [Agreement Schema](agreement-schema.md) · [Architecture](architecture.md) · [Timeline](timeline.md) · [Submission Checklist](submission-checklist.md) |

> Everything in this draft is a proposal until the team reviews it. Problem statements and user descriptions are hypotheses taken from the team's idea pitches and have not been validated with creators yet (see #46).

---

## 1. One-liner

**Paste a commission DM. Get a clear agreement, a counteroffer if the budget doesn't fit, staged PayPal invoices (deposit first, then the balance), automatic overdue reminders, and a delivery log to use as evidence if the client opens a dispute.**

DMpact is meant for independent creators (mixers, illustrators, Live2D riggers, MV editors) who take commissions from VTubers and YouTubers over DMs.

## 2. Problem (hypothesis)

These pains come from the team's idea pitches (Commission Desk, DealMate AI). They still need to be checked with real creators.

| Expected pain | What we think happens |
|---|---|
| **Terms live in a chat** | Price, deadline, revision count, and deposit are spread across a DM thread, and each side may remember them differently. |
| **Budget ≠ scope** | A client's budget may not match what they ask for, and the creator has to negotiate it in chat. |
| **Deposit (DP) tracking** | The deposit is requested and confirmed by hand, with nothing linking the payment to the agreed scope. |
| **Late or no final payment** | The balance may be paid late or not at all after delivery. |
| **"I never received it" disputes** | If a client disputes the payment, the creator has to gather proof of what was agreed and delivered. |

**Why AI:** the input is unstructured chat (mixed languages, slang, relative dates), so we plan to use an LLM with structured output for extraction and for drafting counteroffers. Whether it is accurate enough is measured with our eval set (F15).

**Why PayPal:** PayPal Invoicing supports separate invoices, payment status webhooks, and reminders, which map to the deposit → balance flow. The idea assumes clients pay through PayPal; this is one of the things to validate.

## 3. Target users (hypothesis)

| User | Description |
|---|---|
| **Creator (primary)** | Freelance mixer / illustrator / Live2D rigger / MV editor who takes commissions over DMs and gets paid through PayPal. |
| **Client (secondary)** | VTuber / YouTuber commissioning that work. In our design the client side needs no account. |

User stories and acceptance criteria: see **[URD](URD.md)**.

## 4. Goals and non-goals

### Goals (hackathon MVP)
1. **G1. DM → agreement.** Paste a commission DM and get a structured agreement with ambiguities flagged.
2. **G2. Negotiation help.** When budget and scope don't match, offer up to 3 editable counteroffers.
3. **G3. Client confirms on one page.** A no-login agreement page where the client reviews, confirms, and pays the deposit through PayPal.
4. **G4. Staged PayPal invoicing.** Deposit invoice on agreement, balance invoice on delivery. Paid status comes from webhooks, and overdue invoices get reminders.
5. **G5. Delivery evidence.** Every delivery is hashed and timestamped, and an evidence pack can be exported.
6. **G6. Overview.** An AG Grid commission queue with every commission's state, money, and deadlines.

### Non-goals
- Escrow or holding funds on the platform. PayPal moves money directly from client to creator.
- Sending messages into Discord/X/Instagram. The creator copies drafted messages; we never post for them.
- Marketplace / creator discovery.
- Multi-creator teams, agencies, revenue splits.
- Live (production) PayPal. **Sandbox only.**
- Native mobile apps. The web app should work on mobile.
- Country-specific tax/invoice compliance.

## 5. Success metrics (proposed targets)

| Metric | Target |
|---|---|
| End-to-end demo (paste DM → fully paid) | Runs in sandbox without manual DB edits |
| Extraction accuracy on the test DM set | ≥ 90% field-level accuracy for price, currency, deadline, revisions, deposit |
| Ambiguity recall | ≥ 85% of seeded ambiguities flagged |
| Counteroffer validity | Every option's proposed agreement is schema-valid |
| Judge can run it | Fresh clone + README → running app in ≤ 10 min, or a hosted URL |

## 6. Scope

Priority key: **P0** = must ship for demo · **P1** = should ship · **Stretch** = only if time allows. Owners follow the team's role assignment.

| # | Feature | Priority | Owner |
|---|---|---|---|
| F1 | Paste DM → AI extraction to Agreement JSON + ambiguity flags | P0 | Berwyn |
| F2 | Creator review/edit of extracted agreement | P0 | Hasna |
| F3 | Commission state machine + event log | P0 | Rio |
| F4 | Client agreement page (tokenized link): confirm / request changes | P0 | Hasna + Rio |
| F5 | PayPal deposit (DP) invoice created + sent on agreement | P0 | Giani |
| F6 | PayPal webhook → paid status → state transitions | P0 | Giani |
| F7 | AG Grid commission queue | P0 | Hasna |
| F8 | Budget/scope mismatch detection + up to 3 counteroffers (editable) | P0 | Firsta |
| F9 | Delivery log: file hash (SHA-256) + timestamp | P0 | Giani |
| F10 | Balance invoice on delivery | P0 | Giani |
| F11 | Overdue reminders (PayPal remind + AI-drafted DM nudge) | P1 | Giani + Firsta |
| F12 | Evidence pack export (PDF) | P1 | Giani |
| F13 | Creator rate card (used by mismatch detection) | P1 | Firsta + Rio |
| F14 | Commission detail timeline view | P1 | Hasna |
| F15 | Extraction + negotiation evals on test DMs | P1 | Berwyn, Firsta, Marsha |
| F16 | Webhook-miss fallback (poll invoice status) | P1 | Giani |
| F17 | PayPal Disputes API: attach evidence pack to a dispute | Stretch | Giani |
| F18 | Reply drafts in the client's language | Stretch | Firsta |
| F19 | DM screenshot input (image → agreement) | Stretch | Berwyn |

## 7. End-to-end flow

```
Creator                         DMpact                                Client                 PayPal (sandbox)
───────                         ──────                                ──────                 ────────────────
1. Paste DM  ───────────────▶  AI extracts Agreement JSON
                               + flags ambiguities
2. Fix flags / edit  ───────▶  Mismatch check vs rate card
                               └─ if mismatch: ≤3 counteroffers
3. Pick/edit counteroffer,
   copy message to DM  ─────▶  status: negotiating
4. Send agreement link  ────────────────────────────────────────▶  Opens link, reviews
                                                                    Confirms  ──────────▶
                               status: agreed
                               Create + send DP invoice  ───────────────────────────────▶  Invoice #1
                                                                    Pays DP  ───────────▶  INVOICE.PAID webhook
                               status: dp_paid ◀────────────────────────────────────────────────┘
5. Start work  ─────────────▶  status: in_progress
6. Upload delivery  ────────▶  SHA-256 + timestamp logged
                               status: delivered
                               Create + send balance invoice ───────────────────────────▶  Invoice #2
                               (overdue? → remind + AI nudge draft)
                                                                    Pays balance  ──────▶  INVOICE.PAID webhook
                               status: fully_paid ◀─────────────────────────────────────────────┘
7. (If dispute) Download evidence pack: agreement + confirmations + invoices + delivery hashes
```

## 8. Functional requirements

### 8.1 DM → Agreement (AI extraction) — F1
- **FR-1.1** Accept pasted text up to 10,000 characters (chat logs, mixed EN/ID/JP romaji).
- **FR-1.2** Extract to the **[Agreement JSON schema](agreement-schema.md)**: service type, deliverables, total price, currency, deposit terms, deadline, revision count, usage rights, parties.
- **FR-1.3** Output must validate against the schema (zod). On invalid output, retry once with the validation error, then fall back to a partially filled draft with every missing field flagged.
- **FR-1.4** Flag ambiguities with code, severity (`blocker` | `warning`), the JSON path of the field, a source quote, and a suggested clarifying question.
- **FR-1.5** Resolve relative dates ("next Friday", "before debut on the 20th") against the paste date and flag them `RELATIVE_DEADLINE` (warning) so the creator confirms.
- **FR-1.6** Flag currencies PayPal doesn't support (e.g. **IDR**) as `UNSUPPORTED_CURRENCY` with a suggestion to convert to USD.
- **FR-1.7** DM content is treated as data only. Instructions inside the DM must not change behavior (prompt-injection hardening).

### 8.2 Agreement review & editing — F2
- **FR-2.1** Creator sees the extracted agreement as a form with ambiguity flags shown next to the field.
- **FR-2.2** Creator can edit any field. Each save creates a new, immutable **agreement version**.
- **FR-2.3** The agreement can't be sent to the client while any `blocker` flag is unresolved.

### 8.3 Negotiation AI — F8, F13
- **FR-3.1** Compare the agreement against the creator's **rate card** (base price per service + extras) and detect a mismatch when the budget is below the estimate by more than a configurable threshold (default 20%).
- **FR-3.2** When mismatched, generate **1–3 counteroffers**, one per strategy:
  1. **Reduce scope:** keep the budget, drop or reduce deliverables/revisions.
  2. **Adjust price:** keep the scope, propose a price based on the rate card.
  3. **Split into milestones:** keep scope and price, spread payment across stages.
- **FR-3.3** Each counteroffer has a one-line summary, a **client-facing message draft**, and the full **proposed agreement**. The UI shows a diff against the current version, computed in code.
- **FR-3.4** The creator can edit the message before copying. Applying an option creates a new agreement version.
- **FR-3.5** No mismatch → show "Looks fair" with the reasoning. Never invent a mismatch.
- **FR-3.6** `service_type: other` skips the mismatch check (no rate card price).

### 8.4 Commission state machine — F3
States: `draft → negotiating → agreed → dp_paid → in_progress → delivered → fully_paid`, plus `cancelled` (from any state before `dp_paid`).
- **FR-4.1** Transitions are guarded server-side. Invalid transitions return 409.
- **FR-4.2** `agreed` requires creator and client confirmations on the **same agreement version hash**.
- **FR-4.3** `dp_paid` and `fully_paid` are set **only** by a verified PayPal webhook (or the polling fallback), never by a button.
- **FR-4.4** Every transition writes an append-only event (who, when, from, to, reason).
- Diagram: [Architecture §3](architecture.md#3-commission-state-machine).

### 8.5 Client agreement page — F4
- **FR-5.1** Opened via an unguessable tokenized URL. No login.
- **FR-5.2** Shows deliverables, price, deposit and balance amounts, deadline, revisions, usage rights.
- **FR-5.3** Actions: **Confirm agreement** or **Request changes** (free text, shown to the creator).
- **FR-5.4** After confirmation, shows the deposit invoice's PayPal pay link and the payment status.

### 8.6 PayPal invoicing — F5, F6, F10, F11, F16
- **FR-6.1** On `agreed`: create and send **Invoice #1 (deposit)** via PayPal Invoicing API v2.
- **FR-6.2** On `delivered`: create and send **Invoice #2 (balance)** = total − deposit.
- **FR-6.3** The webhook endpoint verifies PayPal signatures, handles `INVOICING.INVOICE.PAID` and `INVOICING.INVOICE.CANCELLED`, and is idempotent (dedupe by event ID).
- **FR-6.4** If no webhook arrives within 10 minutes after the client opens the pay link, poll the invoice status.
- **FR-6.5** Overdue job (daily + on demand): for invoices past due, call PayPal **remind** and generate an AI-drafted nudge for the creator to copy.
- **FR-6.6** 100%-upfront and no-deposit commissions skip the corresponding invoice.

### 8.7 Delivery log & evidence pack — F9, F12, F17
- **FR-7.1** Creator uploads a delivery file (or a preview). The server computes SHA-256 and stores hash, filename, size, MIME type, and server timestamp. Storing the file itself is optional; the hash is required.
- **FR-7.2** Delivery log entries are append-only.
- **FR-7.3** Evidence pack (PDF) contains: final agreement version + hash, both confirmation timestamps, the original DM, invoice IDs + statuses + paid timestamps, delivery log entries, and the event log.
- **FR-7.4** *(Stretch)* Submit evidence to a sandbox dispute via the PayPal Disputes API.

### 8.8 Commission queue (AG Grid) — F7
- **FR-8.1** Columns: client, service, total, currency, deposit status, balance status, state, deadline, days left, overdue flag.
- **FR-8.2** Sort, filter, quick search. Status as colored badges. Overdue rows highlighted.
- **FR-8.3** Row click → commission detail. Quick actions: copy client link, mark in progress, upload delivery.
- **FR-8.4** Summary bar: money outstanding, deposits pending, commissions due this week.

## 9. AI design (proposed)

| Component | Model | Technique | Output |
|---|---|---|---|
| DM extractor | Google Gemini (model ID in `GEMINI_MODEL`, to be chosen) | Prompt + JSON-schema structured output + zod validation + 1 repair retry | Agreement JSON + ambiguities |
| Ambiguity rules | Gemini + code checks | LLM flags + deterministic rules (missing fields, unsupported currency, past dates, deposit > total) | `ambiguities[]` |
| Mismatch detector | Code + Gemini | Rate-card math gives the estimate; LLM writes the explanation | `mismatch{}` |
| Counteroffer generator | Gemini | Structured output: up to 3 options, each with message + full proposed agreement, validated in code | `counteroffers[]` |
| Reminder nudge writer | Gemini | Short, polite message | `string` |

**Guardrails**
- AI output is always a proposal. The creator approves every agreement, counteroffer, and message; the AI never sends anything.
- Money math (deposit, balance, totals) is computed in code, never taken from the LLM.
- DM text is passed as untrusted data. The test set includes injection attempts.
- Model and prompt version are logged with each extraction.

## 10. PayPal integration (proposed)

| Capability | API | Used for |
|---|---|---|
| OAuth 2.0 client credentials | `POST /v1/oauth2/token` | Server auth |
| Invoicing v2 | `POST /v2/invoicing/invoices`, `POST …/{id}/send`, `GET …/{id}`, `POST …/{id}/remind`, `POST …/{id}/cancel` | Deposit + balance invoices, reminders, cancellation |
| Webhooks | `INVOICING.INVOICE.PAID`, `INVOICING.INVOICE.CANCELLED`; `POST /v1/notifications/verify-webhook-signature` | Paid status |
| Disputes *(stretch)* | `GET /v1/customer/disputes`, `POST …/{id}/provide-evidence` | Attach the evidence pack to a dispute |

Environment: **PayPal Sandbox** only, with a Business account (creator) and a Personal account (client). Currency defaults to **USD**. IDR is not a PayPal-supported currency, so it's flagged.

## 11. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | Extraction p95 < 10 s. Page interactions < 1 s excluding AI/PayPal calls. |
| NFR-2 | Secrets only in env vars. `.env.example` lists all keys. No secrets in git. |
| NFR-3 | Webhook handler is idempotent and signature-verified. |
| NFR-4 | Agreement versions, events, and delivery logs are append-only. |
| NFR-5 | Works on current Chrome/Firefox/Safari and at 375 px width. |
| NFR-6 | A judge can run it locally from the README in ≤ 10 min, or use a hosted demo. |
| NFR-7 | Repo is public, MIT licensed, license visible in the About section. |
| NFR-8 | Demo data uses no real people's names, trademarks, or copyrighted assets. |
| NFR-9 | Free tiers only. No paid subscriptions. |

## 12. Tech stack

Confirmed by Rio on Oct 29 (#1). AI code is TypeScript (confirmed with Berwyn and Firsta).

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js (App Router) + TypeScript**, one deployable | API routes and UI in one place |
| UI | Tailwind CSS + shadcn/ui, **AG Grid (Community)** | AG Grid is required by the team |
| Validation | **zod**, exported to JSON Schema for Gemini | One schema shared by AI, API, and UI |
| DB access | **PostgreSQL** + Prisma | Commissions, versions, and events are relational |
| AI | **Google Gemini API** (`@google/genai`) with structured output | Named in the Commission Desk idea pitch |
| Payments | **PayPal REST APIs (Sandbox)**: Invoicing v2, Webhooks | Core requirement |
| Hosting | **Vercel Hobby** (free) | Free Next.js hosting |
| DB + file storage | **Supabase free tier** (Postgres + Storage) | Free Postgres and file storage |
| Scheduled jobs | **Vercel Cron** (once a day, included in Hobby) calling `/api/cron/overdue` | Free, configured in the app |
| Creator auth | **Supabase Auth** (email + password) + seeded demo account | Free, already part of Supabase |
| Package manager | **pnpm** | |
| PayPal SDK tooling *(optional)* | **APIMatic** | Optional, only if it helps (#53) |
| CI | GitHub Actions: typecheck, lint, unit tests | Keep `main` working |

## 13. Judging criteria → plan

| Criterion | How we plan to address it |
|---|---|
| **Technological implementation** | PayPal Invoicing v2 lifecycle (create/send/remind/cancel) and verified webhooks driving a guarded state machine. Gemini structured output with validation, repair, and evals. |
| **Design** | A full loop for two users (creator dashboard + client page) with clear states and error handling. |
| **Potential impact** | A specific audience and specific pains, supported by creator interviews if we get them (#46). |
| **Innovation** | Turning a chat DM into a payable agreement with evidence, plus editable AI negotiation. |
| **Presentation** | A video under 3 minutes following one commission from DM to fully paid. |

**Prize categories to consider:** overall placing, Best Use of PayPal + AI, Best Use of Agentic Commerce, Best Demo Delivery, **Best Use of AG Grid** (required), Best Use of APIMatic (optional).

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Agreement schema changes late and breaks several roles | Lock schema v1 early (#2). After that, changes need approval from Rio and the affected owners. |
| PayPal sandbox webhooks are slow or unreliable | Polling fallback (FR-6.4). Webhook simulator in dev. |
| Sandbox payment flow behaves differently than expected | Document the exact sandbox steps in the README. Rehearse the demo before recording. |
| LLM output inconsistent | Structured output + zod + repair retry. Evals catch regressions. Pin the model version. |
| Scope creep | P0 first. P1 only after the P0 flow works end to end. Stretch last. |
| Free-tier limits (e.g. Supabase pauses inactive projects) | Keep the project active during judging. Local run instructions as backup. |
| Needing AG Grid Enterprise features | Stay on Community features. |

## 15. Milestones (proposed)

| Milestone | Due (WIB) | Exit criteria |
|---|---|---|
| **M0 — Foundations** | Sun Nov 1 | Schema v1 signed off, repo scaffolded, CI green, sandbox + Gemini keys working, first 10 test DMs |
| **M1 — Core loop** | Thu Nov 5 | Paste DM → agreement → client confirms → DP invoice sent → webhook marks `dp_paid`, deployed |
| **M2 — Full flow** | Mon Nov 9 | Negotiation, delivery log, balance invoice, reminders, AG Grid queue, evidence pack, evals at target |
| **M3 — Polish & submit** | Wed Nov 11 | Video uploaded, Devpost draft complete, README verified on a fresh clone. **Submit before Nov 12 12:00 PST** |

Day-by-day draft: [timeline.md](timeline.md).

## 16. Team and roles

| Role | Person | Owns |
|---|---|---|
| Tech Lead / backend core | **Rio** | API, database, state machine, Agreement schema, deployment |
| PayPal & proof | **Giani** | Sandbox, invoices, webhooks, reminders, delivery log, evidence pack |
| AI: DM → agreement | **Berwyn** | Extraction prompts, structured output, ambiguity flags |
| AI: negotiation | **Firsta** | Mismatch detection, counteroffers, message drafts |
| Frontend | **Hasna** | Paste flow, agreement page, counteroffer editor, AG Grid queue |
| Product, QA & submission | **Marsha** | Test DM set, E2E testing, demo script and video, Devpost write-up |

## 17. Open questions

| # | Question | Suggested owner |
|---|---|---|
| Q1 | Gemini: whose API key, which model, are free-tier limits enough for the demo? | Berwyn |
| Q2 | Deliver the final file before or after the balance is paid? | Marsha + Rio |
| Q3 | Store delivered files, or only their hashes? | Giani |
| Q5 | Can we talk to real creators to validate the problem? | Marsha |
| Q6 | Do clients in this space actually pay through PayPal, and in which currencies? | Marsha |
