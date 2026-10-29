# DMpact — Architecture

| | |
|---|---|
| **Status** | Draft, not yet reviewed by the team |

## 1. System overview

```mermaid
flowchart LR
  subgraph Browser
    C[Creator dashboard<br/>Next.js + AG Grid]
    K[Client agreement page<br/>tokenized link]
  end

  subgraph App["Next.js app (Vercel Hobby, free)"]
    API[API routes]
    SM[State machine]
    AIX[AI: extractor]
    AIN[AI: negotiator]
    PP[PayPal client]
    EV[Evidence pack builder]
  end

  DB[(PostgreSQL + Storage<br/>Supabase free tier)]
  CRON[Vercel Cron<br/>daily overdue check]
  G[Google Gemini API]
  PAY[PayPal Sandbox<br/>Invoicing v2 + Webhooks]

  C --> API
  K --> API
  API --> SM --> DB
  API --> AIX --> G
  API --> AIN --> G
  SM --> PP --> PAY
  PAY -- webhook INVOICING.INVOICE.PAID --> API
  CRON --> API
  API --> EV --> DB
```

One deployable Next.js app holds both UI and API. Every boundary that talks to an external service sits behind a module (`lib/ai/*`, `lib/paypal/*`) so it can be mocked in tests and demos.

## 2. Folder layout

```
dmpact/
├── docs/                      # PRD, URD, schema, architecture, timeline
├── schema/                    # agreement.schema.json (generated from zod)
├── prisma/                    # schema.prisma, migrations, seed.ts
├── prisma.config.ts
├── fixtures/dms/              # fake commission DMs + expected JSON
├── evals/                     # extraction + negotiation eval runners
├── public/
└── src/
    ├── proxy.ts               # Supabase session refresh
    ├── generated/prisma/      # Prisma Client (git-ignored)
    ├── app/
    │   ├── (auth)/login/
    │   ├── (creator)/
    │   │   ├── layout.tsx     # creator shell, redirects if logged out
    │   │   ├── commissions/
    │   │   │   ├── page.tsx   # AG Grid queue
    │   │   │   ├── new/       # paste DM
    │   │   │   └── [id]/      # detail, timeline, actions.ts
    │   │   └── settings/rate-card/
    │   ├── a/[token]/         # client agreement page
    │   └── api/
    │       ├── webhooks/paypal/
    │       ├── cron/overdue/
    │       └── commissions/[id]/
    │           ├── status/    # polling
    │           └── evidence/  # PDF download
    ├── components/            # ui/ (atoms), molecules/, organisms/, templates/
    ├── hooks/                 # use-polling.ts, ...
    └── lib/
        ├── db.ts
        ├── auth/              # session helpers
        ├── repositories/      # server-only data access, one file per domain
        ├── supabase/          # client.ts, server.ts, proxy.ts
        ├── schema/            # zod: agreement, negotiation, forms
        ├── state-machine/
        ├── money/
        ├── ai/                # gemini.ts, extract/, negotiate/
        ├── paypal/
        └── evidence/
```

Unit tests sit next to the code they test (`*.test.ts`).

Creator pages and API routes check the user with `supabase.auth.getClaims()`. The client page, PayPal webhook, and cron route are protected by the token, webhook signature, and `CRON_SECRET`.

## 3. Commission state machine

```mermaid
stateDiagram-v2
  [*] --> draft: DM pasted / manual create
  draft --> negotiating: creator sends link (no blocker flags)
  negotiating --> negotiating: new version / client requests changes
  negotiating --> agreed: creator + client confirmed same version hash
  agreed --> dp_paid: webhook INVOICE.PAID (deposit)
  agreed --> in_progress: deposit.type = none
  dp_paid --> in_progress: creator starts work
  in_progress --> delivered: delivery logged
  delivered --> fully_paid: webhook INVOICE.PAID (balance)
  draft --> cancelled
  negotiating --> cancelled
  agreed --> cancelled: deposit invoice cancelled
  fully_paid --> [*]
  cancelled --> [*]
```

| Transition | Trigger | Guard | Side effect |
|---|---|---|---|
| draft → negotiating | Creator | No `blocker` ambiguities | Generate client token |
| negotiating → agreed | Client confirm | Both confirmations on the same `content_hash` | Create + send deposit invoice |
| agreed → dp_paid | PayPal webhook | Verified signature, invoice = this commission's deposit | — |
| dp_paid → in_progress | Creator | — | — |
| in_progress → delivered | Delivery upload | ≥ 1 delivery log entry | Create + send balance invoice (skip if balance = 0 → straight to fully_paid) |
| delivered → fully_paid | PayPal webhook | Verified, invoice = balance invoice | — |
| * → cancelled | Creator | State before dp_paid | Cancel open PayPal invoices |

All transitions go through one function, `transition(commissionId, to, actor, reason)`, which checks the guard, writes a `commission_events` row, and runs side effects. Nothing else updates `commissions.state`.

## 4. Data model

```mermaid
erDiagram
  creators ||--o{ commissions : owns
  creators ||--o| rate_cards : has
  commissions ||--|{ agreement_versions : has
  agreement_versions ||--o{ confirmations : confirmed_by
  commissions ||--o{ invoices : has
  commissions ||--o{ deliveries : has
  commissions ||--o{ commission_events : logs
  commissions ||--o{ change_requests : receives
  webhook_events }o--o| invoices : updates

  creators { uuid id  uuid auth_user_id  string email  string display_name  string paypal_email }
  commissions { uuid id  uuid creator_id  string state  text source_dm  string client_token  timestamptz created_at }
  agreement_versions { uuid id  uuid commission_id  int version  jsonb content  string content_hash  string created_by }
  confirmations { uuid id  uuid agreement_version_id  string party "creator|client"  string content_hash  timestamptz confirmed_at }
  invoices { uuid id  uuid commission_id  string kind "deposit|balance"  string paypal_invoice_id  string status  decimal amount  string currency  date due_date  timestamptz paid_at  timestamptz last_reminded_at }
  deliveries { uuid id  uuid commission_id  string filename  string sha256  int size_bytes  string mime_type  string storage_key  bool is_final  timestamptz logged_at }
  commission_events { uuid id  uuid commission_id  string type  string from_state  string to_state  string actor  string reason  jsonb meta  timestamptz at }
  change_requests { uuid id  uuid commission_id  int version  text message  timestamptz at }
  rate_cards { uuid id  uuid creator_id  jsonb rates  int mismatch_threshold_pct }
  webhook_events { string id  string type  jsonb payload  timestamptz received_at  timestamptz processed_at }
```

`agreement_versions`, `confirmations`, `deliveries`, and `commission_events` are append-only, enforced by database triggers.

## 5. Key sequences

### 5.1 Paste DM → agreement

```mermaid
sequenceDiagram
  actor Cr as Creator
  participant UI
  participant API as Server Action
  participant G as Gemini
  Cr->>UI: paste DM
  UI->>API: extractAgreement(dm)
  API->>G: system prompt + DM (as data) + JSON schema
  G-->>API: JSON
  API->>API: zod validate → (repair retry once) → deterministic post-checks → compute money
  API-->>UI: agreement v1 + ambiguities
  UI-->>Cr: form with inline flags
```

### 5.2 Client confirms → deposit invoice → paid

```mermaid
sequenceDiagram
  actor Cl as Client
  participant P as /a/[token]
  participant API as Server
  participant PP as PayPal Sandbox
  Cl->>P: open link, Confirm
  P->>API: confirmAgreement(token, version_hash)
  API->>API: transition → agreed
  API->>PP: POST /v2/invoicing/invoices (deposit)
  API->>PP: POST /v2/invoicing/invoices/{id}/send
  PP-->>Cl: invoice email / pay link
  Cl->>PP: pay (sandbox personal account)
  PP->>API: webhook INVOICING.INVOICE.PAID
  API->>PP: verify-webhook-signature
  API->>API: dedupe event → transition → dp_paid
  P->>API: GET /api/commissions/[id]/status (polling)
  API-->>P: dp_paid ✓
```

### 5.3 Overdue reminders

Vercel Cron (once a day, plus a manual "Run now" button for the demo) calls `GET /api/cron/overdue` with `Authorization: Bearer $CRON_SECRET`. For each unpaid invoice past `due_date` and not reminded in 24 h: `POST /v2/invoicing/invoices/{id}/remind`, generate an AI nudge message, store it on the commission, and set `last_reminded_at`.

## 6. Environments and config

| Env var | Used by |
|---|---|
| `DATABASE_URL` | Prisma Client at runtime (Supabase pooled connection) |
| `DIRECT_URL` | Prisma CLI / migrations via `prisma.config.ts` (direct connection) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Auth (creator login) |
| `SUPABASE_SECRET_KEY` | Delivery file storage (server only, never exposed to the browser) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | AI modules |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | PayPal client |
| `PAYPAL_API_BASE` = `https://api-m.sandbox.paypal.com` | PayPal client |
| `PAYPAL_WEBHOOK_ID` | Webhook signature verification |
| `APP_BASE_URL` | Client links, PayPal invoice notes |
| `CRON_SECRET` | Vercel Cron → `/api/cron/*` auth |

Local dev receives PayPal webhooks through a tunnel (ngrok / cloudflared) or the PayPal webhook simulator. The polling fallback means the demo still works without either.

## 7. Testing strategy

| Layer | What | Tool |
|---|---|---|
| Unit | Money math, state machine guards, post-check rules, agreement diff | Vitest |
| AI evals | Extraction on `fixtures/dms` (field accuracy, ambiguity recall). Negotiation on mismatch cases | `evals/` scripts, run manually + nightly |
| Integration | PayPal client against sandbox (create/send/get/cancel) | Vitest, tagged `@sandbox`, not run in CI |
| E2E | Paste → fully paid happy path, plus 3 edge paths | Playwright, or a manual checklist if time is short (Marsha) |
