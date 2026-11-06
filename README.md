<p align="center">
  <h1 align="center">🛡️ DMpact</h1>
  <p align="center"><b>AI Commerce Shield for Creator DMs</b></p>
  <p align="center">
    <i>Turns informal chat DMs into locked agreements and guaranteed PayPal deposit invoices in 10 seconds.</i>
  </p>
</p>

<p align="center">
  <a href="https://dmpact.vercel.app"><img src="https://img.shields.io/badge/Live%20Demo-dmpact.vercel.app-0070F3?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" /></a>
  <a href="https://paypalaihackathon.devpost.com"><img src="https://img.shields.io/badge/Devpost-PayPal%20%26%20Google%20AI%20Hackathon-003087?style=for-the-badge" alt="Hackathon" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-success?style=for-the-badge" alt="MIT License" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Google%20Gemini-3.8%20Flash-4285F4?style=flat-square&logo=googlegemini&logoColor=white" alt="Google Gemini" />
  <img src="https://img.shields.io/badge/PayPal-Invoicing%20v2-003087?style=flat-square&logo=paypal&logoColor=white" alt="PayPal Invoicing" />
  <img src="https://img.shields.io/badge/AG%20Grid-36.3.0-E0234E?style=flat-square&logo=aggrid&logoColor=white" alt="AG Grid" />
  <img src="https://img.shields.io/badge/Neon-PostgreSQL-00E599?style=flat-square&logo=postgresql&logoColor=black" alt="Neon Postgres" />
  <img src="https://img.shields.io/badge/AI%20Evals-100%25%20Key%20Accuracy-success?style=flat-square" alt="AI Evals" />
</p>

<p align="center">
  <a href="https://dmpact.vercel.app"><b>🚀 Try Live Demo</b></a> •
  <a href="#-quick-tour-3-minute-judge-flow"><b>⚡ 3-Min Judge Guide</b></a> •
  <a href="docs/submission.md"><b>📑 Devpost Packet</b></a> •
  <a href="docs/demo-script.md"><b>📹 Demo Script</b></a> •
  <a href="docs/research.md"><b>🔬 Market Research</b></a> •
  <a href="docs/architecture.md"><b>🏗️ Architecture</b></a>
</p>

---

## 💡 The Problem

The creator economy is booming past **$250 billion**, yet freelance creators—digital artists, Live2D riggers, vocal mixers, and video editors—still conduct their business in informal chat direct messages (**Discord, Twitter/X, Instagram, and Reddit**).

Informal DMs lead to three catastrophic failure modes:

| The DM Failure Mode | What Actually Happens | The DMpact Countermeasure |
|:---|:---|:---|
| **💸 Ghosted Final Balances** | *"I love the preview, I'll pay the rest tomorrow!"* Client disappears; creator gets 0% final balance. | **Gated Delivery (FR-6.10):** Client cannot download final high-res files until the final balance invoice is paid. |
| **🌀 Scope Creep & Revision Hell** | Revisions keep growing with no written boundary or additional payment. | **Scope Locking & Counteroffers (FR-1.2, FR-3.2):** Explicit revision limits; AI drafts 3 strategic counteroffers if budget is too low. |
| **⚠️ Digital Chargebacks** | Buyer files an *"unauthorized transaction"* or *"item not received"* dispute with PayPal. | **Cryptographic Dispute Shield (FR-6.8):** 1-click PDF Evidence Pack compiling signed terms, SHA-256 file hashes, and PayPal txn IDs. |

> **Why not Fiverr or Upwork?**  
> Traditional marketplaces charge **10%–20% platform fees** and force casual buyers into cumbersome account sign-ups. Creators want to stay in their DMs—**DMpact gives them institutional payment protection without leaving chat.**

---

## ✨ Key Features

```
  ┌─────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
  │  1. Paste DM    │ ──▶  │  2. Gemini Extraction   │ ──▶  │  3. Agentic Negotiation │
  │  Raw Chat Logs  │      │  + Ambiguity Blockers   │      │  3 Counteroffers        │
  └─────────────────┘      └─────────────────────────┘      └─────────────────────────┘
                                                                          │
  ┌─────────────────┐      ┌─────────────────────────┐                    ▼
  │  6. Deliver &   │ ◀──  │  5. PayPal Deposit      │ ◀──  ┌─────────────────────────┐
  │  SHA-256 Hash   │      │  50% Invoice + Webhook  │      │  4. Zero-Login Client   │
  └─────────────────┘      └─────────────────────────┘      │  Mobile Agreement Page  │
           │                                                └─────────────────────────┘
           ▼
  ┌─────────────────┐      ┌─────────────────────────┐
  │  7. AG Grid     │ ──▶  │  8. Dispute Evidence    │
  │  Commission Hub │      │  Tamper-Proof PDF Pack  │
  └─────────────────┘      └─────────────────────────┘
```

* **⚡ Multi-Turn Chat Extraction:** Powered by **Google Gemini 3.8 Flash** (`extract-v3`). Ingests multi-turn, multilingual chat logs (English, Indonesian colloquialisms, Japanese VTuber terminology) into a structured commercial agreement in under 5 seconds.
* **🚦 Deterministic Ambiguity Guardrails:** Automatically flags missing terms, vague deadlines (*"ASAP"*), unstated revision limits, and unsupported currencies (*IDR*). **Blockers** physically prevent sending until resolved; **Warnings** suggest polite clarifying questions.
* **🤝 Autonomous Negotiation Shield:** Cross-checks client requests against the creator's saved rate card. If a client lowballs by >20%, Gemini generates 3 professional, ready-to-copy counteroffers: *Scope Reduction*, *Price Adjustment*, or *Milestone Split*.
* **📱 Zero-Login Client Agreement Portal:** Mobile-first tokenized review link (`/a/[token]`). Clients confirm project scope and pay deposits directly through PayPal with **zero account registration required**.
* **💳 Staged PayPal Invoicing v2 + Real-Time Webhooks:** Dispatches a formal 50% deposit invoice. Upon sandbox payment, PayPal Webhooks (`INVOICING.INVOICE.PAID`) instantly flip the commission state to `dp_paid` with signature verification.
* **🔒 Cryptographic Delivery Vault:** Final files are hashed (**SHA-256**) and timestamped upon upload. High-res downloads remain locked until the 50% balance invoice is paid.
* **📊 Enterprise AG Grid Pipeline:** Live commission queue built on **AG Grid Community 36.3.0**, featuring custom status badges, dynamic deadline tags (`DaysLeft`), multi-currency rollups, and keyboard navigation.
* **🛡️ Dispute Evidence Pack PDF:** 1-click generation of a court- and PayPal-ready evidence document combining signed agreements, client confirmations, file hashes, and PayPal transaction IDs.

---

## 🔬 AI Evaluation & Empirical Benchmarks

DMpact includes an automated end-to-end evaluation harness across **21 fixture DMs** (`evals/results/extract-v3-gemini-3.5-flash-lite-medium.json`) simulating edge cases, prompt injections, and complex negotiations:

| Metric | Benchmark Result | Target | Status |
|:---|:---:|:---:|:---:|
| **Key Field Accuracy** (Prices, deliverables, deadlines, currencies) | **100.0%** (210 / 210) | ≥ 95% | 🟢 Surpassed |
| **Overall Field-Level Accuracy** (All schema attributes) | **99.34%** (300 / 302) | ≥ 90% | 🟢 Surpassed |
| **Ambiguity Blocker Recall** (Seeded missing terms caught) | **100.0%** (Zero missed) | ≥ 85% | 🟢 Surpassed |
| **Ambiguity Precision** | **91.67%** | ≥ 85% | 🟢 Surpassed |
| **Prompt Injection Resilience** (Malicious DM bypass attempts) | **100.0%** Pass | 100% | 🟢 Surpassed |
| **Median Latency ($p_{50}$)** | **5.43 seconds** | ≤ 8.0s | 🟢 Fast |

---

## ⚡ Quick Tour (3-Minute Judge Flow)

Judges can test the full live application in **under 3 minutes** using our hosted demo:

1. **Open Live App:** Navigate to **[https://dmpact.vercel.app](https://dmpact.vercel.app)**.
2. **Log In:** Click **"Quick Demo Login"** (or use `alex.river@example.com` / `demo12345`).
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
4. **Lock & Send Agreement:** In ~5s, Gemini extracts the complete agreement. Click **"Create Agreement"**.
5. **Client Checkout (Incognito):** Open the generated **Client Agreement Link** in incognito. Click **"Confirm Agreement & Pay Deposit"** → **"Pay with PayPal"**. Log in with PayPal Sandbox Personal account (`sb-buyer@personal.example.com`).
6. **Watch Real-Time Sync:** Return to the Creator dashboard. Real-time PayPal Webhooks flip the status to **"Deposit Paid"** (`dp_paid`).
7. **Deliver & Dispute Shield:** Upload any file to witness SHA-256 hashing and balance invoice generation. Click **"Download Evidence Pack"** to inspect the dispute-proof PDF.

---

## 🏗️ Tech Stack

```
Frontend:       Next.js 15 (App Router, Server Actions, React 19) · Tailwind CSS 4 · Base UI
Pipeline:       AG Grid Community 36.3.0 (@ag-grid-community/react)
Database:       PostgreSQL · Neon Serverless Branching · Prisma ORM
AI Platform:    Google Gemini 3.8 Flash & Gemini 3.5 Flash Lite (@google/genai)
Payments:       PayPal Invoicing v2 REST API · Webhooks (`INVOICING.INVOICE.PAID`)
Security:       PayPal Webhook Signature Verification · SHA-256 Web Crypto
Validation:     Zod 4 schema validation
Evidence Pack:  @react-pdf/renderer
Hosting:        Vercel (Edge Network)
```

---

## 🚀 Local Development Setup

### Prerequisites
* **Node.js:** `v24+` (or `v20.6+` with native `--env-file` support)
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

## 👥 Hackathon Team

Built with ❤️ for the **PayPal & Google AI Hackathon**:

| Member | Role | GitHub | Devpost |
|:---|:---|:---:|:---:|
| **Rio Sebastian** | Tech Lead & Architecture | [@srios000](https://github.com/srios000) | `@srios000` |
| **Jia** | Backend & PayPal Integration | [@imjia05stay-star](https://github.com/imjia05stay-star) | `@imjia05stay-star` |
| **Wynn** | AI & Prompt Engineering | [@Wynnzzz](https://github.com/Wynnzzz) | `@Wynnzzz` |
| **Firsta** | Negotiation Engine & Agentic UX | [@Firsta30](https://github.com/Firsta30) | `@Firsta30` |
| **Hasna** | Frontend & AG Grid Pipeline | [@hasnapriswati](https://github.com/hasnapriswati) | `@hasnapriswati` |
| **Marsha Niswah** | Product, QA & Submission Owner | [@marshaniswah](https://github.com/marshaniswah) | `@marshaniswah` |

---

## 📜 License

This project is open-source under the [MIT License](LICENSE).
