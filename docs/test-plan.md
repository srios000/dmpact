# DMpact — End-to-End Test Plan & Sandbox Verification

| | |
|---|---|
| **Document** | End-to-End Test Plan & Sandbox Execution Matrix |
| **Owner** | Marsha (Product, QA & Submission) |
| **Milestone** | M2 — Full Flow Verification |
| **Related** | [PRD](PRD.md) · [URD](URD.md) · [Architecture](architecture.md) · [PayPal Sandbox Setup](paypal-sandbox.md) · [Submission Checklist](submission-checklist.md) |

---

## 1. Objectives & Scope

The purpose of this test plan is to validate that DMpact executes flawlessly across the full commission lifecycle in the **PayPal Sandbox** environment without manual database interventions.

### Goals:
1. Verify the primary **Happy Path** (paste DM → extraction → agreement confirmation → staged PayPal invoices → delivery evidence → fully paid).
2. Verify all **10 Key Edge Paths** identified in PRD §8 and URD §3.
3. Establish a repeatable manual rehearsal checklist for the team before recording the final submission video.

---

## 2. Test Environment & Prerequisites

### 2.1 Accounts & Infrastructure
* **Hosting:** Vercel deployment preview / production URL (`$APP_BASE_URL`).
* **Database & Storage:** Neon Postgres branch with seeded demo creator + Neon Object Storage for delivery files.
* **PayPal Sandbox Business Account (Creator):** Configured in `.env` (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`).
* **PayPal Sandbox Personal Account (Client):** Funded buyer account for completing payments.
* **Webhook Receiver:** Active webhook listener with verified webhook ID (`PAYPAL_WEBHOOK_ID`).

### 2.2 Seeded Persona
* **Creator User:** `demo@dmpact.dev` (Password: seeded in dev environment)
* **Creator Display Name:** Alex Mixer / Studio Horizon
* **Client Persona:** Luna Echo (`@luna_echo`, PayPal: `luna@example.com`)

---

## 3. Happy-Path Test Scenario (TC-E2E-001)

**Scenario:** Complete commission from initial DM paste to final delivery and Evidence Pack download using standard staged payments (50% deposit, 50% balance).

| Step | Action | Expected State / UI Result | Underlying Verification |
|---|---|---|---|
| **1. Login** | Creator logs into `/login` with demo credentials. | Redirected to `/commissions` (queue view). App shell shows navigation. | Neon Auth session cookie established. |
| **2. Paste DM** | Navigate to `/commissions/new`. Paste text from `fixtures/dms/001-mix-clear.txt`. Click **Extract Agreement**. | Progress loader appears. Within 10s, form is populated with extracted fields. | Gemini returns structured JSON; Zod validation passes; Post-checks compute deposit: $75.00, balance: $75.00. |
| **3. Review** | Creator reviews agreement fields. No blockers are present. Click **Generate Agreement Link**. | Status transitions to `negotiating`. Tokenized private link generated (`/a/[token]`). | Commission record created in DB (`commissions.state = 'negotiating'`). |
| **4. Client Review** | In an incognito window, open `/a/[token]`. | Agreement review page loads without login. Displays deliverables, price ($150.00 USD), 50% deposit, deadline, revisions, usage rights. | Client token matches record; client cannot view creator admin panels. |
| **5. Client Confirm** | Client clicks **Confirm Agreement**. | Confirmation modal records timestamp; status moves to `agreed`. PayPal deposit invoice is generated. | Both creator and client confirm the identical `content_hash`. PayPal Invoicing API creates & sends Invoice #1. |
| **6. Deposit Payment** | Client clicks **Pay Deposit with PayPal**. Logs into Sandbox Personal account and completes $75.00 payment. | Client page updates to show "Deposit Paid". Creator dashboard reflects `dp_paid`. | PayPal triggers `INVOICING.INVOICE.PAID` webhook; signature verified; DB transitions to `dp_paid`. |
| **7. Start Work** | Creator clicks **Mark In Progress** on commission detail. | State transitions to `in_progress`. Event logged in timeline. | `commission_events` records transition with actor `creator`. |
| **8. Preview Upload** | Creator uploads initial mix deliverable (preview WAV/MP3) via delivery form. | File hash (SHA-256) and server UTC timestamp logged. State moves to `delivered`. | S3 storage key saved in `deliveries`; balance invoice ($75.00) created & sent automatically. |
| **9. Balance Payment** | Client opens invoice link or client page and pays remaining $75.00 balance via PayPal Sandbox. | Status updates to `fully_paid`. Final delivery files unlocked. | Webhook processes second `INVOICE.PAID`; state machine guards unlock final files. |
| **10. Evidence Export**| Creator clicks **Export Evidence Pack**. | Generates and downloads structured PDF containing full agreement hash, confirmation logs, PayPal invoice IDs, and delivery SHA-256 logs. | `GET /api/commissions/[id]/evidence` generates verified PDF audit trail. |

---

## 4. Key Edge-Path Test Scenarios

### TC-EDGE-01: Client Requests Changes
* **Precondition:** Commission is in `negotiating` state (`/a/[token]`).
* **Steps:** Client enters "Could we add 1 more harmony track?" into the change request box and submits.
* **Expected Result:**
  * State remains `negotiating`.
  * `change_requests` row created in database.
  * Creator detail page displays the change request banner.
  * Creator can edit agreement fields, generating `version 2` with a new `content_hash`.

### TC-EDGE-02: Zero-Deposit Commission (`deposit.type: none`)
* **Precondition:** DM specifies 100% payment upon delivery or no deposit.
* **Steps:** Creator confirms agreement where `deposit.type = "none"`. Client confirms.
* **Expected Result:**
  * Deposit invoice generation is skipped.
  * Commission automatically transitions directly from `agreed` to `in_progress`.
  * Only one invoice (100% balance) is sent upon file delivery.

### TC-EDGE-03: Webhook Missed (Polling Fallback)
* **Precondition:** Client pays deposit invoice, but incoming webhook is delayed or dropped.
* **Steps:** Client returns to `/a/[token]`. Background polling triggers `/api/commissions/[id]/status`.
* **Expected Result:**
  * Server queries PayPal API `GET /v2/invoicing/invoices/{id}` directly.
  * Detects status `PAID`.
  * State advances to `dp_paid` idempotently without manual database tampering.

### TC-EDGE-04: Automated Overdue Reminder Job
* **Precondition:** Commission invoice is past its `due_date` and unpaid.
* **Steps:** Invoke `/api/cron/overdue` with `Authorization: Bearer $CRON_SECRET`.
* **Expected Result:**
  * PayPal Invoicing `POST .../{id}/remind` API is executed.
  * AI drafts a polite reminder nudge message for the creator.
  * `last_reminded_at` timestamp is updated in `invoices` table.
  * Duplicate reminders are rate-limited to at most once per 24 hours.

### TC-EDGE-05: Unsupported Currency (IDR Blocker)
* **Precondition:** DM contains price in Indonesian Rupiah (`fixtures/dms/011-unsupported-currency-idr.txt`).
* **Steps:** Run AI extraction on pasted text.
* **Expected Result:**
  * Ambiguity flag `UNSUPPORTED_CURRENCY` (Severity: `blocker`) is raised on `/price/currency`.
  * Send button is disabled until currency is converted to a PayPal-supported currency (e.g. USD).

### TC-EDGE-06: Vague / Missing Deadline ("ASAP" Blocker — FR-1.9)
* **Precondition:** DM specifies deadline as "ASAP", "whenever", or mentions no date (`fixtures/dms/006-vague-deadline-asap.txt`).
* **Steps:** Run AI extraction.
* **Expected Result:**
  * Extractor rejects vague phrases and sets `deadline.date = null`.
  * Ambiguity flag `MISSING_DEADLINE` (Severity: `blocker`) is raised.
  * Creator is prohibited from sending the agreement until an explicit date is input.

### TC-EDGE-07: Missing Usage Rights (Blocker — FR-1.9)
* **Precondition:** DM mentions nothing about commercial rights or credit (`fixtures/dms/008-missing-usage-rights.txt`).
* **Steps:** Run AI extraction.
* **Expected Result:**
  * Ambiguity flag `MISSING_USAGE_RIGHTS` (Severity: `blocker`) is raised on `/usage_rights`.
  * Creator must define commercial terms before link generation is permitted.

### TC-EDGE-08: Deadline Change Post-Approval (US-08A & FR-3.10)
* **Precondition:** Commission is in `agreed` or `in_progress` state.
* **Steps:** Creator modifies the deadline date in commission settings.
* **Expected Result:**
  * System bumps agreement version (e.g., `version 1` → `version 2`).
  * New version generates a distinct `content_hash`.
  * Client page invalidates previous confirmation and prompts the client to review and re-confirm the revised version.

### TC-EDGE-09: Fixed Deposit Calculation (`deposit.type: fixed`)
* **Precondition:** Total price is $200.00 USD, fixed deposit set to $40.00 USD.
* **Steps:** Submit agreement.
* **Expected Result:**
  * Server computes `deposit.amount = "40.00"` and `balance_amount = "160.00"`.
  * PayPal Invoice #1 is sent for exactly $40.00.
  * Invoice #2 is sent for exactly $160.00.

### TC-EDGE-10: Gated Delivery Protection
* **Precondition:** Work is completed; creator uploads delivery package. Commission is in `delivered` state; balance invoice is unpaid.
* **Steps:** Client visits `/a/[token]` and attempts to download final production files.
* **Expected Result:**
  * Final download links are disabled / hidden.
  * Client sees a clear notice: *"Final unwatermarked deliverables will unlock automatically once balance invoice is settled via PayPal."*
  * Files unlock immediately after balance webhook confirmation.

---

## 5. Execution Matrix & Sign-Off Checklist

| Test Case ID | Description | Type | Environment | Status | Tested By | Date |
|---|---|---|---|---|---|---|
| **TC-E2E-001** | Happy Path: Paste to Fully Paid | E2E Happy Path | Vercel + Sandbox | [ ] | Marsha | — |
| **TC-EDGE-01** | Client Requests Changes Loop | Functional Edge | Vercel + Sandbox | [ ] | Marsha | — |
| **TC-EDGE-02** | Zero Deposit Flow | Functional Edge | Vercel + Sandbox | [ ] | Marsha | — |
| **TC-EDGE-03** | Webhook Miss Polling Fallback | Integration | Vercel + Sandbox | [ ] | Marsha / Giani | — |
| **TC-EDGE-04** | Overdue Cron & AI Nudge | Backend / AI | Vercel Cron | [ ] | Marsha / Giani | — |
| **TC-EDGE-05** | Unsupported Currency Flag | AI / Validation | Web Client | [ ] | Marsha / Berwyn | — |
| **TC-EDGE-06** | Vague Deadline "ASAP" Blocker | AI / Validation | Web Client | [ ] | Marsha / Berwyn | — |
| **TC-EDGE-07** | Missing Usage Rights Blocker | AI / Validation | Web Client | [ ] | Marsha / Berwyn | — |
| **TC-EDGE-08** | Post-Approval Modification | State Machine | Web Client | [ ] | Marsha / Rio | — |
| **TC-EDGE-09** | Fixed Deposit Math | Money / Invoice | Sandbox | [ ] | Marsha / Rio | — |
| **TC-EDGE-10** | Gated Delivery File Protection | Security / State | Client Page | [ ] | Marsha / Hasna | — |

---

## 6. Bug Filing & Reporting Workflow

1. Any failure encountered during rehearsal must be documented in a GitHub Issue with:
   * **Title:** `[E2E Bug]: <Short description>`
   * **Label:** `bug`
   * **Priority:** `P0` (blocks demo) or `P1` (minor edge path)
   * **Steps to Reproduce:** Commission ID, actor role, and relevant state machine transition.
2. Direct blockers to Rio (State machine/DB), Giani (PayPal/Webhooks), or Hasna (UI).

