# DMpact — Demo Video Script & Storyboard

**Owner:** Marsha · **Target Video Length:** 2:42 (Strictly under 3:00 / ≤ 2:50 target)  
**Milestone:** M2 — Full Flow · **Issue Reference:** [#48](https://github.com/srios000/dmpact/issues/48)  
**Hero Fixture:** `fixtures/dms/001-mix-clear.txt` (Luna Echo debut cover mix & master)  
**Feature Highlight Fixture:** `fixtures/dms/014-lowball-mix.txt` (AI negotiation counteroffers)  
**Rehearsal Dates:** Rehearsal 1: Nov 5, 2026 · Rehearsal 2 (Final Run): Nov 9, 2026

---

## 1. Hackathon Judging Criteria Alignment Matrix

This demo video is structured to systematically address each of the 5 criteria for the **PayPal & Google AI Hackathon**:

| Judging Criterion | Key Question Evaluated | How DMpact Demonstrates It in the Video | Exact Timestamp |
|---|---|---|---|
| **Technological Implementation** | Thorough and skillful use of PayPal Platform and AI? Non-trivial working implementation? | Demonstrates **PayPal Invoicing v2 API** (auto-generating deposit and balance invoices) + **PayPal Webhooks (`INVOICING.INVOICE.PAID`)** updating dashboard state in real time + **Google Gemini 3.8 Flash** structured extraction with Zod schema validation & deterministic ambiguity guardrails + SHA-256 cryptographic file hashing. | `0:20 - 0:50`<br>`1:18 - 1:48`<br>`1:48 - 2:12` |
| **Design** | Complete, coherent product experience — not just a technical POC? | Shows a polished, end-to-end dual-perspective flow: Creator desktop dashboard (`/commissions`), interactive agreement review form with ambiguity badges, zero-login mobile client agreement page (`/a/[token]`), PayPal Sandbox checkout modal, and high-performance **AG Grid** commission pipeline. | `0:20 - 2:32` |
| **Potential Impact** | Credible, specific case solving a real problem for a real audience? | Tackles the $250B+ creator economy's #1 livelihood crisis: ghosted final balances, scope creep, and digital chargebacks (grounded in `docs/research.md`). Demonstrates **gated file delivery (FR-6.10)** and **50% deposit standard (FR-6.7)**. | `0:00 - 0:20`<br>`1:48 - 2:12` |
| **Innovation / Idea** | Creative and novel concept differing from existing solutions? | Introduces **Agentic Commerce in DMs**: Instead of trapping users in high-fee (20%) marketplaces like Fiverr or Upwork, DMpact meets creators *where deals actually happen* (social media DMs), extracting structured contracts, enforcing payment guardrails, and generating 3-way AI counteroffers. | `0:50 - 1:18`<br>`2:12 - 2:32` |
| **Presentation** | Clear end-to-end demonstration, easy to follow, communicates what/who/why? | Paced at exactly 02:42. Starts with a high-stakes emotional hook, moves through one complete uninterrupted commission lifecycle with real UI clicks, displays live PayPal checkout, and closes on a satisfying full-circle punchline. | `0:00 - 2:42` |

---

## 2. Seeded Data & Hero Commission Profile

* **Hero DM Fixture:** `fixtures/dms/001-mix-clear.txt`
* **Creator Persona:** `Alex River` (Freelance Audio Engineer & Vocal Mixer)
* **Client Persona:** `Luna Echo` (`@luna_echo` on Twitter/Discord, email: `luna@example.com`, indie VTuber preparing for debut)
* **Project Title:** Original Song Debut Cover — *"Starlight Echo"*
* **Deliverables:**
  * `d1`: Vocal mix (Lead vocal + 2 harmony tracks + instrumental mix)
  * `d2`: Master (WAV 48kHz/24bit format)
* **Agreed Financials:**
  * Total Price: **$150.00 USD**
  * Deposit (50%): **$75.00 USD** (via PayPal Invoicing v2)
  * Final Balance: **$75.00 USD** (due upon preview delivery)
* **Agreed Terms:**
  * Revisions Included: **2 rounds**
  * Deadline: **November 25, 2026**
  * Commercial Usage: **Commercial monetization permitted (YouTube & Spotify, credit mandatory)**
* **PayPal Sandbox Accounts:**
  * Creator / Seller: `sb-creator@business.example.com`
  * Client / Buyer: `sb-buyer@personal.example.com`
* **Delivery Asset:** `starlight_echo_master_v1.wav` (Mock WAV stem file, SHA-256 fingerprint verified)

---

## 3. Master Timing Breakdown & Storyboard Matrix

```
0:00 ───────────── 0:20 ───────────── 0:50 ───────────── 1:18 ───────────── 1:48 ───────────── 2:12 ───────── 2:32 ───── 2:42
 Hook: "I'll Pay     DM Paste & AI      AI Counteroffer    Client Mobile &    Work Delivery &    AG Grid Pipeline &  Full-Circle
 Tomorrow" Ghost     Extraction         (Lowball Shield)   Sandbox Deposit    Balance Invoice    Evidence Pack PDF   Resolution
```

| Scene # | Timecode | Beat / Focus | Visual Framing | Narration Script (Voiceover) | Exact Clicks & UI Actions | On-Screen Graphic Callout |
|---|---|---|---|---|---|---|
| **1** | `0:00 - 0:20` (20s) | **The Hook: The "I'll Pay Tomorrow" Trap** | Visual micro-drama of a VTuber debut commission ghosting scenario. | *" 'I love the preview, I'll pay the rest tomorrow!' In freelance commissions, that's the single most dangerous sentence. Across creator communities, the story is always the same: an artist delivers the work, but because agreements lived in casual DMs, they spend weeks chasing the balance by hand—or never get paid at all. Meet DMpact: turning messy chat DMs into locked agreements and guaranteed PayPal milestones in under 10 seconds."* | 1. Discord chat close-up: Mixer sends `preview_v1.mp3`.<br>2. VTuber client: *"OMGGG I love it so much!! Teaser sounds insane, debut is in 3 days! I'll pay the other $75 tomorrow morning promise!"*<br>3. Flash cut: 3 days later, VTuber's YouTube debut stream is live with 10k views using the song.<br>4. Mixer's follow-up DM: *"Hey, congrats on debut! Just following up on the remaining $75 balance?"*<br>5. Chat status: **Delivered (Seen 3 days ago)**. Empty PayPal balance.<br>6. Deep bass whoosh into DMpact UI. | 💬 *"I'll pay the rest tomorrow!"*<br>🔴 **Seen 3 Days Ago (Unpaid Balance)**<br>⚡ *Introducing DMpact* |
| **2** | `0:20 - 0:50` (30s) | **DM Extraction & Gemini Guardrails** | Full Desktop (1080p): Creator dashboard at `/commissions`. | *"Meet DMpact: the AI commerce shield for gig creators. Watch: we copy a raw chat DM from VTuber Luna Echo requesting a vocal mix and master. We click 'New Commission', paste the text, and hit 'Analyze DM'. In just one second, Google Gemini extracts structured agreement terms: deliverables, deadline, revision limits, and commercial usage rights. Notice how DMpact automatically enforces safe commerce rules, calculating a 50% PayPal deposit before any work begins."* | 1. Click **`+ New Commission`** at `/commissions`.<br>2. Paste raw text from `001-mix-clear.txt`.<br>3. Click **`Analyze DM`** button.<br>4. Form populates smoothly with deliverables (`d1`, `d2`), price ($150), deposit ($75), deadline (Nov 25, 2026), and green badge: `0 Blockers · Ready to Lock`. | 🤖 **Google Gemini 3.8 Flash**<br>✅ Structured Agreement JSON<br>✅ Deposit: 50% ($75.00 USD)<br>🛡️ Ambiguity Guard: Commercial Rights Verified |
| **3** | `0:50 - 1:18` (28s) | **AI Negotiation & Lowball Shield** | Desktop: Quick cut to lowball DM demonstration (`014-lowball-mix.txt`). | *"What if a client tries to lowball your rates? In this second case, a client offers $40 for a $150 package. DMpact detects the rate mismatch and generates three professional, tailored counteroffers: reduce scope, adjust price, or split into milestones. No awkward haggling—just copy the polite, assertively phrased response directly back to the DM to protect your creative value."* | 1. Show lowball paste ($40 offer vs $150 rate card).<br>2. Rate card mismatch triggers counteroffer drawer.<br>3. Show 3 cards: Option 1 (Trim scope), Option 2 (Adjust price to $150), Option 3 (Milestone split).<br>4. Click **`Copy Response`** with toast notification: *"Copied to clipboard!"*. | 💬 **AI Negotiation Engine**<br>• Option A: Firm Rate ($150)<br>• Option B: Trim Scope ($40 basic)<br>• Option C: Milestone Plan |
| **4** | `1:18 - 1:48` (30s) | **Client Agreement Page & PayPal Sandbox Deposit** | **Dual Screen:** Left = Creator Desktop (`/commissions/[id]`). Right = Client Mobile mockup (`/a/[token]`). | *"Back to Luna's project: once approved, DMpact generates a tokenized, mobile-friendly review link. The client opens the link on her phone, reviews the clear scope, and clicks 'Confirm Agreement'. DMpact calls PayPal Invoicing v2 to issue Deposit Invoice #1. Luna taps 'Pay with PayPal' in sandbox, completes checkout, and watch the creator's dashboard—via real-time PayPal Webhooks, the status instantly flips to 'Deposit Paid'. Work can now safely begin."* | 1. Creator clicks **`Send to Client`** and copies link.<br>2. Client opens mobile view `/a/[token]`.<br>3. Client taps **`Confirm agreement`**.<br>4. Client taps **`Pay with PayPal`**.<br>5. PayPal Sandbox modal opens, client completes $75.00 payment.<br>6. Left screen: Webhook fires, status badge transitions from `agreed` ➔ `dp_paid` with green flash. | 📱 **Mobile Client View (`/a/[token]`)**<br>💳 **PayPal Invoicing v2 API**<br>⚡ **Webhook event:** `INVOICING.INVOICE.PAID`<br>🟢 Status: `agreed` ➔ `dp_paid` |
| **5** | `1:48 - 2:12` (24s) | **Work Delivery, SHA-256 Hash & Balance Invoice** | Creator Desktop: Commission detail view (`/commissions/[id]`). | *"When the creative work is finished, the creator uploads the master audio. DMpact immediately hashes the file with SHA-256, logging an immutable cryptographic delivery fingerprint. The system automatically issues the final PayPal balance invoice for $75. And if a client is slow to pay? DMpact generates automated PayPal reminders and AI-drafted nudge messages with the direct pay link."* | 1. Drag & drop `starlight_echo_master_v1.wav` into delivery vault.<br>2. Green badge displays: `SHA-256: 7f83b165...` logged.<br>3. Automatic generation of Balance Invoice #2 ($75.00).<br>4. Quick preview of context-aware payment reminder nudge. | 🔒 **SHA-256 Immutable Fingerprint**<br>`7f83b1652469a9...`<br>🧾 Balance Invoice Sent ($75.00 USD)<br>📬 AI Overdue Nudge Assistant |
| **6** | `2:12 - 2:32` (20s) | **Full Payment, AG Grid Pipeline & Evidence Pack PDF** | Split view: Client pays final $75. Dashboard updates to `fully_paid`. Creator opens `/commissions` AG Grid. | *"Luna pays the remaining balance. The final files unlock for download, and our AG Grid commission pipeline updates in real-time with revenue summaries and deadline tracking. Best of all: with one click, creators can download a complete Dispute Evidence Pack PDF—binding the signed terms, chat logs, delivery hashes, and PayPal transaction IDs into airtight protection against fraudulent chargebacks."* | 1. Client pays final balance on mobile; final files unlock.<br>2. Creator navigates to `/commissions`.<br>3. AG Grid table demonstrates sorting, status filtering, and summary bar ($150 collected).<br>4. Creator clicks **`Download Evidence Pack`**.<br>5. PDF opens showing full audit trail: Agreement v1, timestamps, delivery SHA-256, and PayPal Invoice IDs. | 📊 **AG Grid Pipeline Overview**<br>📄 **Dispute Evidence Pack (PDF)**<br>• Signed Agreement v1<br>• Server Timestamps & Delivery Hash<br>• PayPal Payment Reference IDs |
| **7** | `2:32 - 2:42` (10s) | **Closing: Full-Circle Resolution** | Push notification on creator's phone: "Payment Received: $75.00 USD from Luna Echo". Fade to DMpact logo and hackathon credits. | *"So the next time a client says 'I love the preview, I'll pay tomorrow'—you don't have to hold your breath. With DMpact, your work is already protected, and your payment is already guaranteed."* | 1. Push notification pops up on mobile: 🟢 PayPal Payment Received ($75.00 USD).<br>2. Clean animated fade out to DMpact logo and GitHub repository link: `github.com/srios000/dmpact`. | 🛡️ **Zero Ghosting. Zero Unpaid Balances.**<br>✨ *DMpact: Protected Creator Commerce*<br>github.com/srios000/dmpact |

---

## 4. Line-by-Line Narration Script (Audio Track)

### 0:00 – 0:20 (Problem & Hook)
> *" 'I love the preview, I'll pay the rest tomorrow!'*  
> *In freelance commissions, that's the single most dangerous sentence.*  
> *Across creator communities, the story is always the same: an artist delivers the work, but because agreements lived in casual DMs, they spend weeks chasing the balance by hand—or never get paid at all.*  
> *Meet DMpact: turning messy chat DMs into locked agreements and guaranteed PayPal milestones in under 10 seconds."*

### 0:20 – 0:50 (DM Extraction & AI Guardrails)
> *"Meet DMpact: the AI commerce shield for gig creators. Watch: we copy a raw chat DM from VTuber Luna Echo requesting a vocal mix and master. We click 'New Commission', paste the text, and hit 'Analyze DM'. In just one second, Google Gemini extracts structured agreement terms: deliverables, deadline, revision limits, and commercial usage rights. Notice how DMpact automatically enforces safe commerce rules, calculating a 50% PayPal deposit before any work begins."*

### 0:50 – 1:18 (Negotiation Counteroffers)
> *"What if a client tries to lowball your rates? In this second case, a client offers $40 for a $150 package. DMpact detects the rate mismatch and generates three professional, tailored counteroffers: reduce scope, adjust price, or split into milestones. No awkward haggling—just copy the polite, assertively phrased response directly back to the DM to protect your creative value."*

### 1:18 – 1:48 (Client Signing & PayPal Sandbox DP)
> *"Back to Luna's project: once approved, DMpact generates a tokenized, mobile-friendly review link. The client opens the link on her phone, reviews the clear scope, and clicks 'Confirm Agreement'. DMpact calls PayPal Invoicing v2 to issue Deposit Invoice #1. Luna taps 'Pay with PayPal' in sandbox, completes checkout, and watch the creator's dashboard—via real-time PayPal Webhooks, the status instantly flips to 'Deposit Paid'. Work can now safely begin."*

### 1:48 – 2:12 (Work Delivery, Hashing & Balance Invoice)
> *"When the creative work is finished, the creator uploads the master audio. DMpact immediately hashes the file with SHA-256, logging an immutable cryptographic delivery fingerprint. The system automatically issues the final PayPal balance invoice for $75. And if a client is slow to pay? DMpact generates automated PayPal reminders and AI-drafted nudge messages with the direct pay link."*

### 2:12 – 2:32 (AG Grid & Dispute Shield PDF)
> *"Luna pays the remaining balance. The final files unlock for download, and our AG Grid commission pipeline updates in real-time with revenue summaries and deadline tracking. Best of all: with one click, creators can download a complete Dispute Evidence Pack PDF—binding the signed terms, chat logs, delivery hashes, and PayPal transaction IDs into airtight protection against fraudulent chargebacks."*

### 2:32 – 2:42 (Closing: Full-Circle Resolution)
> *"So the next time a client says 'I love the preview, I'll pay tomorrow'—you don't have to hold your breath.*  
> *With DMpact, your work is already protected, and your payment is already guaranteed."*

---

## 5. Team Rehearsal & Recording Runbook

### Rehearsal Schedule
* **Rehearsal 1 (Dry Run & Timing Verification):** Wednesday, Nov 5, 2026, 20:00 WIB
  * Validate screen capture resolution (1080p, 60fps), audio levels, and stop-watch checkpoints.
* **Rehearsal 2 (Full Live Run with PayPal Sandbox):** Sunday, Nov 9, 2026, 20:00 WIB
  * Conduct a live run with real-time PayPal sandbox payments and webhook triggers.

### Technical Recording Environment
1. **Screen Resolution:** 1920x1080 (16:9 widescreen) at 100% OS DPI scaling.
2. **Browser Framing:** Google Chrome at 110% zoom with bookmarks bar hidden (`Ctrl+Shift+B`).
3. **Mobile Client Framing:** Clean iPhone 15 frame overlay (9:16 aspect ratio) positioned on the right third of the screen during scenes 4 and 6.
4. **Audio Normalization:** Voiceover recorded on a cardioid microphone, de-essed, with soft compressor settings, normalized to **-16 LUFS**. Background music ducked to **-24 dB** under speech.
5. **Database Seed State:** PostgreSQL database seeded with:
   - Creator account: `Alex River` logged in at `localhost:3000/commissions`.
   - Rate card pre-configured: Vocal Mixing base rate $150.00 USD.
   - Clean slate for `fixtures/dms/001-mix-clear.txt` paste.

### Milestone Checkpoints During Recording
* `0:20` mark: Transition from problem montage to DMpact dashboard.
* `0:50` mark: Transition from Luna extraction to lowball counteroffer drawer.
* `1:18` mark: Dual screen opens (Desktop creator + Mobile client).
* `1:48` mark: PayPal sandbox payment succeeds, transition to file delivery upload.
* `2:12` mark: Transition to AG Grid table and PDF Evidence Pack preview.
* `2:42` mark: Final slide fade out.
