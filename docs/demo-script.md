# DMpact — Demo Video Script & Storyboard

**Owner:** Marsha · **Target Video Length:** 2:45 (Strictly under 3:00 / ≤ 2:50)  
**Milestone:** M2 — Full Flow · **Issue Reference:** [#48](https://github.com/srios000/dmpact/issues/48)  
**Hero Fixture:** `fixtures/dms/001-mix-clear.txt` (Luna Echo debut cover mix & master)  
**Feature Highlight Fixture:** `fixtures/dms/014-lowball-mix.txt` (AI negotiation counteroffers)

---

## 1. Video Production Overview

| Specification | Target Requirement |
|---|---|
| **Max Runtime** | 02:45 (Devpost strict limit < 03:00) |
| **Resolution** | 1080p Full HD (1920x1080, 60 fps) |
| **Aspect Ratio** | 16:9 widescreen (with simulated 9:16 mobile frame for client view) |
| **Audio / Voiceover** | Clear, enthusiastic English voiceover + soft royalty-free lo-fi background music (ducked at -24 dB during voiceover) |
| **No Trademarks / Copyright** | Uses fictional creator/client identities (`Luna Echo`, `Alex River`), royalty-free UI icons, and custom generated artwork |
| **Tech Stack Callouts** | PayPal Invoicing v2, PayPal Webhooks, Google Gemini 1.5, Next.js App Router, AG Grid Community, SHA-256 |

---

## 2. Timing Breakdown & Storyboard Matrix

```
0:00 ──────────────── 0:20 ──────────────── 0:55 ──────────────── 1:25 ──────────────── 1:55 ──────────────── 2:25 ──────── 2:45
 Hook & Problem        Paste DM & Gemini     AI Counteroffer      Client Mobile         Delivery & Webhook   AG Grid &      Impact &
 (Creator Pain)        Extraction Engine     (Lowball Shield)     & Sandbox DP          Balance Invoice      PDF Pack       Credits
```

| Scene # | Timecode | Beat / Focus | Visual Framing | Narration / Voiceover Script | On-Screen Graphic / Callout |
|---|---|---|---|---|---|
| **Scene 1** | `0:00 - 0:20` (20s) | **The Creator Pain (Hook)** | Split screen: Fast montage of chaotic Discord/Twitter DMs, spreadsheet with red unpaid rows, quote callout overlay. | *"Every day, millions of gig creators take commissions over messy chat DMs. But without clear contracts or upfront deposits, 70% of creative freelancers experience ghosted balances, endless scope creep, and PayPal dispute nightmares. What if turning a chaotic chat into a legally binding agreement and guaranteed PayPal payment took just 10 seconds?"* | 🔴 *"Client ghosted after stems sent"*<br>⚠️ *No DP = Zero protection*<br>⚡ *Introducing DMpact* |
| **Scene 2** | `0:20 - 0:55` (35s) | **DM Extraction & Gemini Guardrails** | Full Desktop: Creator dashboard (`/dashboard`). Clicks **"New Commission"**. Pastes DM text from `fixtures/dms/001-mix-clear.txt` (Luna Echo). Clicks **"Analyze DM"**. | *"Meet DMpact: the AI-powered commerce shield for gig creators. Watch this: we copy a real chat DM from VTuber Luna Echo requesting a song mix. With one click, our Gemini-powered engine instantly extracts structured agreement terms: deliverables, deadline, revisions, and usage rights. Notice how DMpact automatically catches required payment milestones, calculating a 50% PayPal deposit before any work starts."* | 🤖 **Gemini 1.5 Structured Extraction**<br>✅ Deliverable: Vocal Mix + Master ($150.00 USD)<br>✅ Deposit: 50% ($75.00 USD)<br>🛡️ Ambiguity Guard: Commercial Rights Verified |
| **Scene 3** | `0:55 - 1:25` (30s) | **Lowball & Scope Creep Shield** | Quick cut to negotiation tab. Demonstrates lowball DM handling (`014-lowball-mix.txt`). 3 AI counteroffer options appear. Creator selects "Compromise" and clicks "Copy Reply". | *"What if the client tries to lowball or scope-creep? DMpact's negotiation engine generates three instant, professional counteroffers: conservative, compromise, or value-add. No awkward haggling—just copy the polite, assertively phrased response directly back to the DM to protect your rates."* | 💬 **AI Negotiation Engine**<br>Option A: Firm Rate ($150)<br>Option B: Trim Scope ($100 basic)<br>Option C: Split Milestone Plan |
| **Scene 4** | `1:25 - 1:55` (30s) | **Client Confirmation & PayPal Sandbox Deposit** | Mobile device mockup side-by-side. Client opens `/c/[token]`. Clean responsive summary. Clicks **"Confirm & Pay Deposit"**. PayPal Sandbox modal opens, pays $75.00 USD. Dashboard immediately flashes green: `DP_PAID`. | *"Once locked, DMpact creates a clean, mobile-optimized client review page. The client reviews the exact terms, clicks 'Confirm & Pay Deposit', and checks out seamlessly with PayPal. Behind the scenes, PayPal Invoicing v2 generates the invoice, and an instant PayPal Webhook updates the creator's dashboard in real-time. Production can now safely begin."* | 📱 **Mobile Client View (`/c/[token]`)**<br>💳 **PayPal Invoicing v2 API**<br>⚡ **Webhook event:** `INVOICING.INVOICE.PAID`<br>🟢 State: `DRAFT` ➔ `DP_PAID` |
| **Scene 5** | `1:55 - 2:20` (25s) | **Work Delivery & Balance Invoice** | Creator uploads `starlight_echo_master_v1.wav`. System calculates cryptographic SHA-256 hash. One-click "Send Final Balance Invoice" ($75.00). | *"When the music is ready, the creator uploads the finished master. DMpact logs an immutable SHA-256 file hash to cryptographically prove exact delivery. With one tap, DMpact triggers the remaining PayPal balance invoice. If a client goes quiet, DMpact drafts friendly, context-aware payment reminders."* | 🔒 **SHA-256 Delivery Fingerprint**<br>`e3b0c44298fc1c149afbf4c899...`<br>🧾 Final Invoice Sent ($75.00 USD) |
| **Scene 6** | `2:20 - 2:38` (18s) | **AG Grid Dashboard & Evidence Pack PDF** | Client pays final balance. Creator dashboard updates to `COMPLETED`. Opens AG Grid commission pipeline. Clicks **"Download Evidence Pack"**. PDF opens with full audit trail. | *"Once the final payment clears, the entire commission lifecycle is tracked on our AG Grid dashboard with filtering, search, and live totals. And for total peace of mind? A one-click PDF Evidence Pack containing the signed agreement, chat timestamps, delivery hashes, and PayPal transaction IDs—airtight defense against fraudulent chargebacks."* | 📊 **AG Grid Pipeline Overview**<br>📄 **Dispute-Proof Evidence Pack**<br>• Signed Agreement v1<br>• Delivery Hash & Timestamp<br>• PayPal Payment Reference |
| **Scene 7** | `2:38 - 2:45` (7s) | **Vision & Closing Call to Action** | Splash screen with DMpact logo, team credits, PayPal + Google AI hackathon banner, GitHub URL. | *"DMpact: Protecting creator livelihoods, turning messy DMs into guaranteed PayPal payments. Built with love by Team DMpact for the PayPal & Google AI Hackathon."* | 🏆 **PayPal & Google AI Hackathon**<br>github.com/srios000/dmpact<br>✨ *Empowering 50M+ Creators* |

---

## 3. Shot-by-Shot Execution Script

### Beat 1: Hook (0:00 – 0:20)
- **Visuals:**
  - Fast-paced 3-second cuts: Screen recording of a chaotic Discord DM channel (`"Hey can u add 5 more revisions?"`, `"Will pay rest next week promise"`), followed by a creator looking stressed.
  - Text overlay appears: *"70% of creative freelancers experience payment disputes or ghosted balances."*
  - Sound effect: Subdued notification chime followed by a clean whoosh transition into DMpact UI.
- **Voiceover:**
  > *"Every day, millions of freelance artists, music producers, and VTuber riggers close deals inside chaotic chat DMs. But without formal agreements or upfront deposits, creators get burned by scope creep and ghosted balances. What if turning any chat into a legally binding agreement with guaranteed PayPal escrow took under 10 seconds?"*

### Beat 2: Gemini Extraction & Guardrails (0:20 – 0:55)
- **Visuals:**
  - Cursor navigates to DMpact homepage (`localhost:3000` or deployed Vercel URL).
  - Creator clicks `+ New Agreement`.
  - Pastes the full raw chat text from `fixtures/dms/001-mix-clear.txt`:
    - *Client: Luna Echo (@luna_echo)*
    - *Deliverable: Full vocal mix and master for "Starlight Echo"*
    - *Price: $150.00 USD (50% upfront deposit)*
    - *Deadline: November 25, 2026*
  - Hits **"Analyze DM"**. A glowing Gemini pulse animation runs for 1.2s.
  - The structured agreement editor populates smoothly with zero errors:
    - Deliverables table: `d1` (Vocal mix), `d2` (Mastering).
    - Payment Terms: `$150.00 USD total`, `$75.00 USD deposit (50%)`.
    - Usage Rights: Commercial use (YouTube + Spotify), credit mandatory.
    - Ambiguity status: `0 Blockers · Ready to Lock`.
- **Voiceover:**
  > *"Meet DMpact. Simply paste the raw conversation directly into our app. In a fraction of a second, Google Gemini parses the messy chat into a structured agreement—extracting the exact deliverables, revision limits, deadline, and commercial licensing terms. Crucially, DMpact enforces safe commerce rules, automatically flagging missing deposits and ambiguous deadlines before you ever send a quote."*

### Beat 3: AI Negotiation & Lowball Shield (0:55 – 1:25)
- **Visuals:**
  - Quick picture-in-picture transition showing a second scenario (`fixtures/dms/014-lowball-mix.txt`): A client offering $40 for a $150 mixing package.
  - DMpact detects `LOWBALL_BUDGET`.
  - The **AI Negotiation Assistant** drawer slides out with 3 generated responses:
    1. *Firm:* Reiterate standard $150 rate with portfolio value justification.
    2. *Scope Adjustment:* Offer lead vocal mix only without tuning for $40.
    3. *Milestone:* Split into two smaller milestone deliverables.
  - User clicks **"Copy Response"** with an animated "Copied to clipboard!" toast notification.
- **Voiceover:**
  > *"When clients lowball or push for uncompensated extras, DMpact's AI negotiation assistant generates three strategic, polite counteroffers in seconds. Choose between standing firm on value, trimming scope to meet their budget, or proposing milestone payments—eliminating the emotional stress of awkward pricing negotiations."*

### Beat 4: Client Review & PayPal Sandbox Deposit (1:25 – 1:55)
- **Visuals:**
  - Split screen: Left side shows creator generating the secure link (`/c/agreement-token-luna`). Right side shows mobile view of the client opening the link.
  - Clean client review UI: High-contrast summary cards, terms breakdown, no confusing legalese.
  - Client taps the prominent blue button: **"Confirm Terms & Pay $75.00 Deposit"**.
  - PayPal Sandbox checkout modal opens. Client selects PayPal Sandbox balance and clicks **"Pay Now"**.
  - PayPal success checkmark appears.
  - Left screen (creator dashboard) instantly transitions via live webhook from `PENDING_DEPOSIT` to `DP_PAID` with a celebratory green badge.
- **Voiceover:**
  > *"Once locked, DMpact creates a dedicated, mobile-friendly confirmation page for the client. With zero friction, the client reviews the project scope and clicks 'Confirm & Pay'. DMpact generates a PayPal Invoicing v2 deposit request on the fly. As soon as the sandbox payment succeeds, real-time PayPal Webhooks update the creator's pipeline instantly. No more starting work on empty promises."*

### Beat 5: Production Delivery & Balance Invoice (1:55 – 2:20)
- **Visuals:**
  - Creator dashboard in `DP_PAID` status.
  - Creator drags-and-drops `starlight_echo_master_v1.wav` into the Delivery Vault.
  - Progress bar finishes: Green badge shows `SHA-256: 7f83b165...` logged.
  - Creator clicks **"Issue Final Invoice ($75.00 USD)"**.
  - Popover shows preview of the final PayPal invoice sent to `luna@example.com` with delivery attachment and download link.
- **Voiceover:**
  > *"When the creative work is finished, the creator uploads the deliverable. DMpact automatically hashes the file with SHA-256, creating an immutable proof-of-delivery fingerprint. With one click, DMpact issues the final PayPal balance invoice. If a payment is delayed, our automated nudge engine crafts courteous, professional reminder emails with the PayPal direct pay link."*

### Beat 6: AG Grid Pipeline & Evidence Pack Export (2:20 – 2:38)
- **Visuals:**
  - Webhook fires `INVOICE_PAID` for the final $75.00.
  - Status updates to `FULLY_PAID`.
  - Creator navigates to `/dashboard/commissions`.
  - AG Grid data table displays all active and completed commissions with live status filters, payment summaries, and client tags.
  - Creator clicks the three-dots menu on Luna Echo's row and selects **"Download Dispute Shield PDF"**.
  - A formatted 2-page PDF document opens on screen showing:
    - Complete DM extraction audit trail
    - Signed terms & timestamped client acceptance
    - Cryptographic delivery hash
    - PayPal Transaction IDs for both Deposit & Final Balance
- **Voiceover:**
  > *"All commissions live in our high-performance AG Grid pipeline, giving creators total visibility over incoming cash flow and deadlines. And if a client ever files an unjustified chargeback? DMpact generates a complete, tamper-evident Evidence Pack PDF in one click—including signed terms, chat logs, delivery hashes, and PayPal receipts—built specifically to satisfy payment processor disputes."*

### Beat 7: Summary & Hackathon Close (2:38 – 2:45)
- **Visuals:**
  - Clean animated closing slide:
    - **DMpact** Logo + Tagline: *"From Messy DMs to Guaranteed Payments"*
    - Tech Badges: PayPal Invoicing v2 · PayPal Webhooks · Google Gemini · Next.js · AG Grid
    - GitHub Repo: `github.com/srios000/dmpact`
    - Team DMpact credits (Rio, Jia, Wynn, Marsha)
- **Voiceover:**
  > *"DMpact bridges the gap between creator passion and professional commerce. Simple for clients, dispute-proof for creators. Thank you!"*

---

## 4. Rehearsal & Recording Checklist

### Technical Setup
- [ ] Screen resolution set to exactly **1920x1080** at 100% DPI scaling (no UI blurriness).
- [ ] Browser zoom level set to 110% on Chrome for crisp text readability.
- [ ] Chrome bookmarks bar hidden (`Ctrl+Shift+B`), clean browser profile with no personal extensions.
- [ ] Test audio microphone: clean room acoustic, pop filter, normalized to -16 LUFS.
- [ ] Seed data refreshed in PostgreSQL/Neon: Luna Echo commission ready to paste on clean database state.
- [ ] PayPal Sandbox accounts logged in and cached (Buyer Sandbox: `sb-buyer@business.example.com`, Seller Sandbox: `sb-creator@business.example.com`).

### Asset Checklist
- [ ] Audio sample asset: `starlight_echo_master_v1.wav` (15-second royalty-free vocal track).
- [ ] Audio background: Royalty-free upbeat lo-fi instrumental track.
- [ ] Fictional avatars: Luna Echo avatar (custom anime VTuber portrait) and Creator avatar.
- [ ] Evidence Pack PDF sample pre-generated for instant preview transition.

### Timing Rehearsal Milestones
- [ ] **0:20 mark:** "What if turning a chaotic chat..." transition to app.
- [ ] **0:55 mark:** "Gemini parses the messy chat..." transition to negotiation drawer.
- [ ] **1:25 mark:** "Eliminating emotional stress..." transition to client mobile view.
- [ ] **1:55 mark:** "Instant PayPal webhook..." transition to delivery upload.
- [ ] **2:20 mark:** "Proof-of-delivery fingerprint..." transition to AG Grid table.
- [ ] **2:45 mark:** Fade out on GitHub URL and hackathon credits. Total time ≤ 2:45.

