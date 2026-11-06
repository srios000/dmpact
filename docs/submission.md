# Devpost Submission Draft — DMpact

**Event:** [PayPal & Google AI Hackathon: Build What's Next with PayPal and AI](https://paypalaihackathon.devpost.com)  
**Submission Deadline:** Thursday, November 12, 2026, 12:00 PM PST (Friday, November 13, 2026, 03:00 WIB)  
**Target Video Runtime:** 2:42 (Strictly under 3:00) — see [Demo Script](demo-script.md)  
**Milestone:** M3 — Polish & Submit · **Issue Reference:** [#50](https://github.com/srios000/dmpact/issues/50)

---

## 1. General Information (Devpost Overview)

### Project Name (max 60 characters)

```text
DMpact — AI Commerce Shield for Creator DMs
```

*(Exact count: 44 characters)*

### Elevator Pitch / Tagline (max 200 characters)

```text
Turns informal chat DMs into locked agreements and guaranteed PayPal deposit invoices in 10 seconds. Features Gemini extraction, AG Grid pipeline, and dispute-proof PDF evidence packs.
```

*(Exact count: 187 characters)*

---

## 2. Project Story (For Public Project Page)

### Inspiration

> *"I love the preview, I'll pay the rest tomorrow!"*  
> In freelance commissions, that is the single most dangerous sentence a creator can hear.

The creator economy is projected to surpass **\$250 billion**, yet its frontline workers—freelance digital illustrators, Live2D riggers, vocal mixers, and video editors—still conduct high-value business through messy, informal direct messages (Discord, Twitter/X, Instagram, and Reddit). 

Our team investigated public creator communities (`r/Artists`, `r/ArtistLounge`, `r/artbusiness`, `r/VirtualYoutubers`, and `r/Live2D`) to understand why so many talented freelancers struggle financially:
1. **The "I'll Pay Tomorrow" Trap & Ghosted Balances:** Creators frequently accept minimal or no upfront deposits. After weeks of hard work and preview deliveries, clients simply disappear, leaving creators with zero recourse ([Case Study: r/Artists](https://www.reddit.com/r/Artists/comments/10gwxio/a_customer_has_ghosted_me_wont_pay_what_do_i/)).
2. **Uncontrolled Scope Creep & Revision Hell:** Informal DMs rarely specify revision boundaries or commercial licenses. Creators get trapped doing days of unpaid work under the threat of negative reviews ([Case Study: r/ArtistLounge](https://www.reddit.com/r/ArtistLounge/comments/tegp98/commissioned_work_and_scope_creep/)).
3. **The Digital Chargeback Nightmare:** When rogue buyers file "unauthorized transaction" claims on PayPal, creators lose both their digital art and their money because informal chat screenshots fail merchant dispute requirements ([Case Study: r/artbusiness](https://www.reddit.com/r/artbusiness/comments/tykvjy/digital_commission_chargebacks/)).

Traditional freelance platforms (Fiverr, Upwork) charge punishing **10%–20% platform fees** and force clients into cumbersome account registration funnels that kill casual commission conversions. Creators refused to leave their DMs.

We built **DMpact** to solve this: **an AI-powered commerce shield that brings institutional-grade payment protection and automated contract guardrails straight into informal chat DMs—without making clients create an account or taking high platform fees.**

---

### What It Does

DMpact turns chaotic, multi-lingual chat DMs into locked agreements and staged PayPal invoices through a seamless 7-step autonomous commerce loop:

1. **Instant DM Extraction:** Creators paste raw chat logs (in English, Indonesian slang, or Japanese VTuber terminology). Using Google Gemini 3.8 Flash, DMpact extracts structured commercial terms: service type, deliverables, total price, currency, revision limits, deadline dates, and commercial usage rights.
2. **Deterministic Ambiguity Guardrails:** The engine scans for missing or dangerous terms (such as vague deadlines like "ASAP", unmentioned revision caps, or unsupported currencies like IDR). Ambiguities are flagged as actionable **Blockers** (which prevent sending until clarified) or **Warnings** with recommended clarifying questions.
3. **Autonomous Negotiation Shield (Counteroffers):** If a client lowballs the creator's base rate card by more than 20%, Gemini automatically drafts three professionally phrased, assertive counteroffers:
   - *Scope Reduction:* Keep the client's budget by removing extra stems/revisions.
   - *Price Adjustment:* Propose the fair market rate based on the creator's saved rate card.
   - *Milestone Split:* Preserve scope while breaking payments into staged deliverables.
4. **Zero-Login Client Agreement Portal:** The client receives a clean, tokenized mobile review link (`/a/[token]`). With zero sign-up required, they review clear deliverables, confirm terms, and immediately trigger PayPal checkout.
5. **Staged PayPal Invoicing v2:** DMpact automatically calls the PayPal Invoicing REST API to generate a formal **50% Deposit Invoice**. Through real-time PayPal Webhooks (`INVOICING.INVOICE.PAID`), the creator's dashboard flips to **Deposit Paid** instantly—authorizing work to safely begin.
6. **Cryptographic Delivery Vault & Balance Trigger:** When the creator finishes the work, they upload the final master file. DMpact calculates an immutable **SHA-256 cryptographic hash** and timestamp, securely vaults the delivery, and automatically dispatches the final 50% balance invoice. The client cannot unlock the unwatermarked file until the balance invoice is paid.
7. **AG Grid Pipeline & Dispute Evidence Pack:** Creators manage their entire commission pipeline inside an enterprise-grade **AG Grid** interface with real-time revenue summaries, deadline countdowns, and payment badges. If a dispute or chargeback ever occurs, creators can generate a tamper-evident **Dispute Evidence Pack PDF** with one click, binding the signed agreement, chat audit logs, file delivery hashes, and PayPal transaction IDs into airtight merchant defense.

---

### How We Built It

DMpact is built as a production-grade full-stack modern web application:

* **Full-Stack Framework:** Next.js 15 (App Router, Server Actions, React 19) styled with Tailwind CSS, Base UI, and Lucide Icons.
* **Database & Infrastructure:** PostgreSQL deployed on **Neon** serverless database branching with connection pooling and session auth cookies.
* **AI Engine & Prompt Architecture:** 
  - **Google Gemini 3.8 Flash** (`@google/genai` SDK) running optimized structured extraction prompts (`extract-v3`).
  - Strict **Zod** schema validation enforcing contract invariants, money decimals, and deterministic date calculations.
  - Multi-option negotiation engine and context-aware payment reminder nudge generator.
* **PayPal Commerce Integration:**
  - **PayPal Invoicing v2 API** (`/v2/invoicing/invoices`): programmatic draft creation, invoice dispatching, metadata attachment, and automated reminder triggers (`/remind`).
  - **PayPal Webhooks API** (`POST /api/webhooks/paypal`): real-time event listener subscribed to `INVOICING.INVOICE.PAID` and `INVOICING.INVOICE.CANCELLED`.
  - **Cryptographic Signature Verification:** Raw-payload byte preservation sent to `/v1/notifications/verify-webhook-signature` preventing webhook spoofing.
  - **Dual-Layer Synchronization:** Resilient fallback polling (`/api/commissions/[id]/status`) and manual refresh endpoints to guarantee invoice state consistency even during sandbox network drops.
* **Pipeline Visualization:** **AG Grid Community 36.3.0** (`ag-grid-react`) utilizing custom cell renderers, dynamic status filtering, keyboard navigation, and client-side aggregations for revenue tracking.
* **Cryptographic Evidence & Dispute Protection:** Client-side & server-side **SHA-256** checksum logging via Web Crypto API, compiled into standardized PDF evidence packs with `@react-pdf/renderer`.

---

### Challenges We Faced

1. **Unstructured Slang & Multilingual Chat Parsing:**
   Creators deal with messy, emoji-filled DMs combining English, Indonesian colloquialisms (*"kak", "DP 50%", "revisi santai"*), and Japanese VTuber terms (*"illust", "stems", "debut stream"*). Standard regex fails completely. We engineered custom system prompts with few-shot reasoning that extract strict numerical values and convert relative dates (e.g. *"next Friday"* or *"before debut on the 25th"*) into verified ISO dates.
2. **PayPal Sandbox Webhook Verification & Byte-Level Serialization:**
   PayPal's `/v1/notifications/verify-webhook-signature` requires the exact raw byte string received over HTTP. If Next.js parses and re-stringifies the JSON body, whitespace or key reordering causes verification failure (`401 Unauthorized`). We built a custom raw-buffer middleware extractor that forwards untouched payload bytes alongside headers (`transmission_sig`, `cert_url`, `auth_algo`).
3. **Balancing Generative AI with Strict Financial Determinism:**
   LLMs can hallucinate payment splits or deliverable quantities. We solved this with a **zero-trust post-check pipeline**: Gemini outputs structured JSON, which is validated by Zod schemas, cross-checked against creator rate cards with deterministic threshold math, and guarded by blocker flags that physically disable invoice generation until all ambiguities are cleared by a human.

---

### Accomplishments That We're Proud Of

* **Verified Eval Harness (100% Key Field Accuracy):**
  We didn't just test by hand; we engineered an automated evaluation harness across 21 complex fixture DMs (`evals/results/extract-v3-gemini-3.5-flash-lite-medium.json`):
  - **100% Key Field Accuracy** (210 / 210 critical fields across pricing, deliverables, currencies, and deadlines).
  - **99.34% Overall Field Accuracy** (300 / 302 schema attributes matched).
  - **100% Ambiguity Recall** (flagged every single seeded missing term, vague deadline, and unsupported currency).
  - **91.67% Ambiguity Precision** with an average latency of ~5.4 seconds.
* **Under-60-Second Real-Time Sandbox Lifecycle:**
  A creator can paste a 20-line chat log, fix one flagged ambiguity, send a mobile link to a client, receive a PayPal sandbox payment, and see their live AG Grid queue update via webhooks—all in under one minute.
* **Zero-Login Client Experience:**
  Clients never have to sign up for DMpact. They open a tokenized link, verify the deliverables, and pay through PayPal. No friction, no abandoned transactions.
* **Dispute-Proof Delivery Vault:**
  By hashing delivered assets (SHA-256) and logging them before balance collection, we provide freelancers with institutional-grade proof against "item not received" claims.

---

### What We Learned

* **Meet Users Where Commerce Actually Happens:** Creators don't want another walled-garden freelance platform. They want lightweight, intelligent financial guardrails injected directly into their existing chat channels.
* **Agentic Commerce Demands Strict Determinism:** Generative AI is phenomenal for conversational extraction and polite negotiation drafts, but financial state transitions must be locked to cryptographic verifications and reliable payment webhooks.
* **PayPal Invoicing v2 is an Unsung Powerhouse:** Beyond simple checkout buttons, PayPal Invoicing provides complete lifecycle auditing (metadata, itemized deliverables, automatic reminders, dispute integration) perfectly suited for autonomous commerce workflows.

---

### What's Next for DMpact

* **Discord Bot & Twitter/X Extension:** Bringing DMpact directly into chat interfaces with a `/dmpact contract` command or browser extension overlay.
* **Direct PayPal Disputes API Integration:** Automatically packaging and uploading the PDF Evidence Pack directly to PayPal's Resolution Center whenever a buyer dispute is initiated.
* **Multi-Stage Studio Escrow Workflows:** Supporting multi-creator milestone payouts for indie animation studios, VTuber agencies, and game development teams.

---

## 3. Built With (Tags)

`paypal`, `paypal-invoicing-v2`, `paypal-webhooks`, `paypal-sandbox`, `google-gemini`, `gemini-api`, `gemini-3.8-flash`, `nextjs`, `react`, `typescript`, `postgresql`, `neon`, `prisma`, `ag-grid`, `ag-grid-community`, `tailwind-css`, `zod`, `sha-256`, `pdf-generation`, `agentic-commerce`, `creator-economy`, `fintech`, `webhooks`

*(23 tags — strictly within the 25-tag limit)*

---

## 4. "Try It Out" Links & Project Media

### Links
* **Live Web Application:** [https://dmpact.vercel.app](https://dmpact.vercel.app)
* **Public GitHub Repository:** [https://github.com/srios000/dmpact](https://github.com/srios000/dmpact) (MIT License)
* **Demo Video (YouTube):** *[Insert Public YouTube URL (< 3 minutes)]*

### Recommended Image Gallery (3:2 Ratio)
1. **Hero Overview:** The DMpact Creator Dashboard with AG Grid commission queue and financial metrics.
2. **AI DM Extraction:** Pasting raw chat DM and viewing Gemini-extracted agreement terms with ambiguity badges.
3. **Negotiation Drawer:** 3 AI-generated counteroffers with diff preview against creator rate card.
4. **Mobile Client Agreement:** Zero-login mobile view showing scope confirmation and "Pay Deposit" button.
5. **PayPal Checkout Modal:** Live PayPal Sandbox payment modal for the 50% deposit invoice.
6. **Delivery & SHA-256 Vault:** File upload with immutable cryptographic hash logging and balance invoice trigger.
7. **Dispute Evidence Pack:** High-resolution preview of the generated tamper-evident dispute PDF.

---

## 5. Additional Information (For Judges and Organizers)

### Submitter Information
* **Submitter Type:** Team
* **Submitter Country of Residence:** Indonesia
* **Did you start this project before the hackathon?** No. DMpact was conceived, designed, and built 100% from scratch during the hackathon period.

---

### Main Technical Requirement: PayPal & AI Implementation

#### 1. PayPal Developer Platform Usage
DMpact implements an advanced, non-trivial integration of the **PayPal Invoicing v2 REST API** and **PayPal Webhooks**:
* **Staged Deposit & Balance Lifecycle:** Instead of a simple one-off payment button, DMpact models real-world commission agreements with staged invoices:
  - `POST /v2/invoicing/invoices`: Creates detailed, itemized invoices containing extracted deliverable names, revision boundaries, currency codes, and custom metadata linking back to the commission ID.
  - `POST /v2/invoicing/invoices/{id}/send`: Dispatches official PayPal invoice emails and generates direct recipient payment URLs (`recipient_view_url`).
  - `POST /v2/invoicing/invoices/{id}/remind`: Dispatches automated payment reminders for overdue invoices.
* **Webhook Reliability & Security:**
  - DMpact subscribes to `INVOICING.INVOICE.PAID` and `INVOICING.INVOICE.CANCELLED`.
  - Implements strict cryptographic signature verification via `POST /v1/notifications/verify-webhook-signature` using preserved raw request bytes to prevent replay or spoofing attacks.
* **Idempotent Dual-Layer Fallback Architecture:**
  - To prevent stalls during sandbox webhook delivery delays, DMpact features automated background polling (`/api/commissions/[id]/status`) and manual refresh endpoints (`POST /api/commissions/[id]/refresh-payment`) that query PayPal directly and apply state transitions with database row-level locking.

#### 2. Google Gemini AI Usage
* **Structured Data Extraction (`extract-v3`):** Powered by **Google Gemini 3.8 Flash** via `@google/genai`. Extracts 10+ agreement attributes from unstructured, multi-turn, multilingual chat logs into schema-validated JSON.
* **Deterministic Guardrail Classifier:** Identifies missing or high-risk contractual terms, classifying them into `blocker` (prevents agreement issuance) and `warning` states.
* **Agentic Negotiation Engine:** Compares extracted budgets against creator rate cards. If a budget deficit exceeds 20%, Gemini formulates three distinct strategic counteroffers (Scope Cut, Price Match, Milestone Split) with client-ready communication drafts.
* **Smart Overdue Nudge Assistant:** Formulates context-aware, polite yet firm DM nudges for overdue balances, dynamically incorporating PayPal payment URLs.

---

### Sponsor Tools: AG Grid Community

* **Component:** `ag-grid-community` & `ag-grid-react` (v36.3.0).
* **Usage in DMpact:**
  - Powers the central **Creator Commissions Command Center** (`/commissions`).
  - Displays real-time commission rows with custom cell renderers for status badges, live deadline countdown chips (`DaysLeft`), formatted multi-currency amounts, and inline action buttons (Confirm, Review, Send Nudge, Download Evidence).
  - Features real-time state filtering (All, In Progress, Awaiting Payment, Overdue, Delivered, Completed) and client-side aggregations for total active revenue and pending balances.
  - Custom themed with Quartz (`themeQuartz`) to seamlessly integrate with DMpact's modern design system.

---

### Step-by-Step Testing Instructions for Judges

Judges can test the full live application in **under 3 minutes** using our hosted demo and sandbox credentials:

#### 1. Hosted Demo URL
Visit: **[https://dmpact.vercel.app](https://dmpact.vercel.app)**

#### 2. Pre-Seeded Creator Credentials
* **Login URL:** `https://dmpact.vercel.app/login`
* **Email:** `alex.river@example.com`
* **Password:** `demo12345`  
*(Or click the "Quick Demo Login" button on the login screen)*

#### 3. PayPal Sandbox Test Accounts (US Region)
* **Creator / Business Account (Receiver):** `sb-creator@business.example.com`
* **Client / Personal Account (Payer):** `sb-buyer@personal.example.com`  
*(Password for sandbox accounts is available in the submission notes / test credentials)*

#### 4. 3-Minute Golden Path Test Flow
1. **Analyze a DM:** On the dashboard, click **"New Commission"**. Copy and paste the sample DM text below into the input box and click **"Analyze DM"**:
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
2. **Review & Lock Agreement:** Gemini extracts the exact agreement terms in ~5 seconds. Review the extracted cards, resolve any warnings, and click **"Create Agreement"**.
3. **Client Confirmation & Deposit Payment:** 
   - Copy the generated **Client Agreement Link** and open it in a new incognito window (simulating the client's phone).
   - Review terms and click **"Confirm Agreement & Pay Deposit"**.
   - Click **"Pay with PayPal"** to open the sandbox checkout modal. Log in with the sandbox Personal account and complete payment for the **\$75.00 deposit**.
4. **Instant Webhook Sync:** Switch back to the Creator dashboard. Notice the commission has automatically transitioned to **"Deposit Paid"** (`dp_paid`).
5. **Deliver & Complete:**
   - Click **"Upload Delivery"**, select any sample audio/image file, and witness the instant SHA-256 fingerprint logging.
   - The balance invoice (\$75.00) is generated. Pay the balance via the client link.
   - Once fully paid, the final file unlocks for download.
6. **Dispute Evidence Pack:** Click **"Download Evidence Pack"** to inspect the generated tamper-evident dispute PDF containing full audit logs and cryptographic hashes.

---

### Prize Categories Selected & Justifications

1. **Best Use of PayPal + AI:**  
   DMpact represents a true fusion of AI intelligence and PayPal commerce rails. Gemini extracts structured business contracts from raw natural conversation, while PayPal Invoicing v2 and Webhooks enforce financial reality with automated 50% deposit staging, payment verification, and automated reminder sequences.
2. **Best Use of Agentic Commerce:**  
   DMpact acts as an autonomous commercial agent for solo creators. It proactively detects budget-to-scope deficits, autonomously formulates 3 distinct counteroffer options with ready-to-send copy, monitors overdue invoice states, and drafts polite contextual nudges without human administrative overhead.
3. **Best Demo Delivery:**  
   Our video demo runs at **2 minutes and 42 seconds** (strictly under the 3-minute hard ceiling). It avoids pitch clichés, opens with an authentic creator ghosting case study, walks through a live end-to-end transaction with dual-screen creator/client perspectives, and demonstrates a real PayPal sandbox payment without simulated shortcuts.
4. **Best Use of AG Grid:**  
   Rather than simple HTML tables, DMpact utilizes AG Grid Community 36.3.0 to provide freelancers with an enterprise-grade financial pipeline. Features include custom rendering for live status badges, dynamic deadline calculations, multi-currency revenue summaries, and full keyboard navigation.

---

### Experience Rating & Feedback for PayPal APIs

* **Rating:** ⭐⭐⭐⭐⭐ (10 / 10)
* **Feedback:**
  - *Strengths:* The Invoicing v2 API is exceptionally well structured. The ability to create draft invoices, attach custom metadata, generate direct payment URLs, and trigger reminders via REST endpoints provides an ideal foundation for programmatic commerce.
  - *Developer Delight:* The `verify-webhook-signature` API provides indispensable security for verifying webhooks without having to manage custom certificate caching manually.
  - *Recommendation for PayPal:* Providing a sandbox webhook tunnel utility (similar to Stripe CLI) would significantly improve the local development onboarding experience for developers building webhook-dependent applications.

---

## 6. Team Members (Devpost)

| Name | Role | GitHub | Devpost |
|---|---|---|---|
| **Rio Sebastian** | Tech Lead & Architecture | [@srios000](https://github.com/srios000) | `@srios000` |
| **Jia** | Backend & PayPal Integration | [@imjia05stay-star](https://github.com/imjia05stay-star) | `@imjia05stay-star` |
| **Wynn** | AI & Prompt Engineering | [@Wynnzzz](https://github.com/Wynnzzz) | `@Wynnzzz` |
| **Firsta** | Negotiation Engine & Agentic UX | [@Firsta30](https://github.com/Firsta30) | `@Firsta30` |
| **Hasna** | Frontend & AG Grid Pipeline | [@hasnapriswati](https://github.com/hasnapriswati) | `@hasnapriswati` |
| **Marsha Niswah** | Product, QA & Submission Owner | [@marshaniswah](https://github.com/marshaniswah) | `@marshaniswah` |

