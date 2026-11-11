<p align="center">
  <h1 align="center">🛡️ DMpact</h1>
  <p align="center"><b>AI Commerce Shield for Creator DMs</b></p>
  <p align="center">
    <i>Turns creator-client DMs into clear agreements, staged PayPal invoices, and verifiable delivery evidence.</i>
  </p>
</p>

<p align="center">
  <a href="https://dmpact.vercel.app"><img src="https://img.shields.io/badge/Live%20Demo-dmpact.vercel.app-0070F3?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" /></a>
  <a href="https://paypalaihackathon.devpost.com"><img src="https://img.shields.io/badge/PayPal%20Competition-Devpost-003087?style=for-the-badge" alt="PayPal Competition" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-success?style=for-the-badge" alt="MIT License" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Google%20Gemini-API-4285F4?style=flat-square&logo=googlegemini&logoColor=white" alt="Google Gemini API" />
  <img src="https://img.shields.io/badge/PayPal-Invoicing%20v2-003087?style=flat-square&logo=paypal&logoColor=white" alt="PayPal Invoicing" />
  <img src="https://img.shields.io/badge/AG%20Grid-36.3.0-E0234E?style=flat-square&logo=aggrid&logoColor=white" alt="AG Grid" />
  <img src="https://img.shields.io/badge/Neon-PostgreSQL-00E599?style=flat-square&logo=postgresql&logoColor=black" alt="Neon Postgres" />
  <img src="https://img.shields.io/badge/AI%20Evals-100%25%20Key%20Accuracy-success?style=flat-square" alt="AI Evals" />
</p>

<p align="center">
  <a href="https://dmpact.vercel.app"><b>🚀 Try Live Demo</b></a>
</p>

---

## The Problem

The creator economy is booming, yet freelance creators—digital artists, Live2D riggers, vocal mixers, and video editors—still conduct their business in informal chat direct messages (**Discord, Twitter/X, Instagram, and Reddit**).

Informal DMs lead to three catastrophic failure modes:

| The DM Failure Mode | What Actually Happens | The DMpact Countermeasure |
|:---|:---|:---|
| **Ghosted Final Balances** | *"I love the preview, I'll pay the rest tomorrow!"* Client disappears; creator gets 0% final balance. | **Gated Delivery (FR-6.10):** Client cannot download final high-res files until the final balance invoice is paid. |
| **Scope Creep & Revision Hell** | Revisions keep growing with no written boundary or additional payment. | **Scope Locking & Counteroffers (FR-1.2, FR-3.2):** Explicit revision limits; AI can draft up to three counteroffers if the budget is too low. |
| **Digital Chargebacks** | Buyer files an *"unauthorized transaction"* or *"item not received"* dispute with PayPal. | **Cryptographic Dispute Shield (FR-6.8):** 1-click PDF Evidence Pack compiling signed terms, SHA-256 file hashes, and PayPal txn IDs. |

> **Why not Fiverr or Upwork?**
> Traditional marketplaces charge **10%–20% platform fees** and force casual buyers into cumbersome account sign-ups. Creators want to stay in their DMs—**DMpact gives them institutional payment protection without leaving chat.**

---

## Key Features

```
  ┌─────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
  │  1. Paste DM    │ ──▶  │  2. Gemini Extraction   │ ──▶  │  3. Agentic Negotiation │
  │  Raw Chat Logs  │      │  + Ambiguity Blockers   │      │  Up to 3 Counteroffers  │
  └─────────────────┘      └─────────────────────────┘      └─────────────────────────┘
                                                                          │
  ┌─────────────────┐      ┌─────────────────────────┐                    ▼
  │  6. Deliver &   │ ◀──  │  5. PayPal Deposit      │ ◀──  ┌─────────────────────────┐
  │  SHA-256 Hash   │      │  Deposit Invoice + Hook │      │  4. No DMpact Login     │
  └─────────────────┘      └─────────────────────────┘      │  Mobile Agreement Page  │
           │                                                └─────────────────────────┘
           ▼
  ┌─────────────────┐      ┌─────────────────────────┐
  │  7. AG Grid     │ ──▶  │  8. Dispute Evidence    │
  │  Commission Hub │      │  Evidence PDF Pack      │
  └─────────────────┘      └─────────────────────────┘
```

* **Multi-Turn Chat Extraction:** Powered by the **Google Gemini API** (`@google/genai`, configurable model with a fallback). Ingests multi-turn, multilingual chat logs (English, Indonesian colloquialisms, Japanese VTuber terminology) into a structured commercial agreement.
* **Deterministic Ambiguity Guardrails:** Automatically flags missing terms, vague deadlines (*"ASAP"*), unstated revision limits, and unsupported currencies (*IDR*). **Blockers** physically prevent sending until resolved; **Warnings** suggest polite clarifying questions.
* **Negotiation Assistant:** Compares client requests with the creator's rate card. For a low budget, Gemini can suggest up to three counteroffers: *Scope Reduction*, *Price Adjustment*, or *Milestone Split*.
* **Client Agreement Portal:** Clients can review and confirm through a private link without creating a DMpact account. PayPal checkout may still require PayPal authentication.
* **PayPal Invoicing v2 and Webhooks:** Creates deposit invoices based on agreed terms (the demo uses a 50% deposit). Signature-verified `INVOICING.INVOICE.PAID` webhooks update payment state; polling checks status if a webhook is delayed or missed.
* **Delivery Vault:** Uploaded files receive a SHA-256 hash and timestamp. Final downloads stay locked until the balance is fully paid.
* **AG Grid Pipeline:** Commission queue built on **AG Grid Community 36.3.0**, with status badges, deadline tags, revenue summaries, and keyboard navigation.
* **Dispute Evidence Pack PDF:** 1-click generation of a structured evidence document combining signed agreements, client confirmations, file hashes, and PayPal transaction IDs.

---

## AI Evaluation & Empirical Benchmarks

The latest recorded extraction evaluation uses **21 fixture DMs** and prompt `extract-v4` with `gemini-3.5-flash-lite` (`evals/results/extract-v4-gemini-3.5-flash-lite-medium.json`, run November 8, 2026). It covers edge cases, prompt injection, and multilingual messages:

| Metric | Benchmark Result | Target | Status |
|:---|:---:|:---:|:---:|
| **Fixture pass rate** | **18 / 21** (85.7%) | Informational | 3 cases need review |
| **Key Field Accuracy** (Prices, deliverables, deadlines, currencies) | **100%** (208 / 208) | ≥ 95% | Meets target |
| **Overall Field-Level Accuracy** (All schema attributes) | **99.12%** (449 / 453) | ≥ 90% | Meets target |
| **Ambiguity Blocker Recall** (Seeded missing terms caught) | **100%** | ≥ 85% | Meets target |
| **Ambiguity Precision** | **84.62%** | ≥ 85% | Below target |
| **Prompt Injection Fixture** | **Passed** (1 / 1) | Pass | Passed |
| **Median Latency ($p_{50}$)** | **5.84 seconds** | ≤ 8.0s | Meets target |

---

## Quick Tour

Use the hosted demo to walk through the main commission flow. A sandbox payment requires access to the PayPal Sandbox buyer account configured for the rehearsal.

1. **Open Live App:** Navigate to **[https://dmpact.vercel.app](https://dmpact.vercel.app)**.
2. **Log In:** Use the demo creator credentials provided for the hosted deployment. Credentials are not stored in this public repository.
3. **Analyze a Raw DM:** Click **"New Commission"**, paste the snippet below, and hit **"Analyze DM"**:
   ```text
   Luna Echo (@luna_echo): Hi Alex! I love your vocal mixing. Are your commissions open?
   Creator: Hey Luna! Yes, what project do you have in mind?
   Luna Echo (@luna_echo): I have an original song called "Starlight Echo" that needs full vocal mixing and mastering. 1 lead vocal, 2 harmony tracks, and instrumental.
   Creator: Standard rate is $150.00 USD with a 50% deposit before I start. Includes 2 revision rounds.
   Luna Echo (@luna_echo): $150.00 USD works! 50% deposit upfront is standard.
   Creator: When do you need the final files?
   Luna Echo (@luna_echo): Delivery by November 25, 2026 in WAV 48kHz/24bit format please.
   Creator: Will this be monetized?
   Luna Echo (@luna_echo): Yes, monetized on YouTube and Spotify! Full commercial use, credit provided.
   Creator: What is your PayPal email?
   Luna Echo (@luna_echo): Send invoice to luna@example.com. Thanks!
   ```
4. **Lock & Send Agreement:** Review the extracted agreement and click **"Create Agreement"**.
5. **Client Checkout (Incognito):** Open the generated **Client Agreement Link** in a private window. Click **"Confirm Agreement & Pay Deposit"** → **"Pay with PayPal"**. Complete checkout with the PayPal Sandbox buyer account configured for the rehearsal.
6. **Check Payment Status:** Return to the creator dashboard. A verified PayPal webhook updates the commission to **"Deposit Paid"** (`dp_paid`); polling provides a fallback if delivery is delayed.
7. **Deliver & Evidence Pack:** Upload a supported delivery file to see its SHA-256 hash and the balance invoice. Click **"Download Evidence Pack"** to inspect the PDF.

---

## Tech Stack

```
Frontend:       Next.js 16.4 · React 19.3 · TypeScript 5 · Tailwind CSS 4 · Base UI
Pipeline:       AG Grid Community 36.3 (`ag-grid-react`)
Database:       Neon PostgreSQL · Prisma ORM 7 with the PostgreSQL adapter
Authentication: Neon Auth (`@neon/auth`)
Storage:        Neon Object Storage (S3-compatible API)
AI Platform:    Google Gemini API (`@google/genai`); default gemini-3.5-flash-lite, fallback gemini-3.1-flash-lite (configurable)
Payments:       PayPal Invoicing v2 REST API · signed webhooks · payment polling fallback
Security:       PayPal webhook signature verification · SHA-256 file hashing (`node:crypto`)
Validation:     Zod 4 schema validation
Evidence Pack:  PDF generation with `pdf-lib`
Hosting:        Vercel
```

---

## Local Development Setup

### Prerequisites
* **Node.js:** `v24+` (recommended); supported versions are `v20.19+` or `v22.12+`
* **Package Manager:** `pnpm` (`v11+`)
* **Database:** PostgreSQL (Neon serverless or local Docker Postgres)

### Installation

```bash
# 1. Clone repository
git clone https://github.com/srios000/dmpact.git
cd dmpact

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your Google Gemini API key and PayPal Sandbox credentials

# 4. Initialize database migrations
pnpm db:deploy

# 5. Seed demo creator & realistic commissions
pnpm db:seed

# 6. Start local development server
pnpm dev
```

Visit `http://localhost:3000` to start using DMpact.

### Running Automated Evals & Tests

```bash
# Run unit & integration test suite
pnpm test

# Run the 21-case Gemini contract extraction evaluation suite
pnpm eval:extract

# Run negotiation counteroffer evals
pnpm eval:negotiate

# Verify Prettier & ESLint code style
pnpm format:check
pnpm lint
```

---

## Competition Team

Built for the **PayPal Competition**, using PayPal payments and Google Gemini AI:

| Member | Role | GitHub | Devpost |
|:---|:---|:---:|:---:|
| **Rio** | Tech Lead & Architecture | [@srios000](https://github.com/srios000) | `@srios000` |
| **Jia** | Backend & PayPal Integration | [@imjia05stay-star](https://github.com/imjia05stay-star) | `@imjia05stay-star` |
| **Berwyn** | AI & Prompt Engineering | [@Wynnzzz](https://github.com/Wynnzzz) | `@Wynnzzz` |
| **Firsta** | Negotiation Engine & Agentic UX | [@Firsta30](https://github.com/Firsta30) | `@Firsta30` |
| **Hasna** | Frontend & AG Grid Pipeline | [@hasnapriswati](https://github.com/hasnapriswati) | `@hasnapriswati` |
| **Marsha** | Product, QA & Submission Owner | [@marshaniswah](https://github.com/marshaniswah) | `@marshaniswah` |

---

## License

This project is open-source under the [MIT License](LICENSE).
