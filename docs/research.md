# Creator Pain Points & Market Validation Research

| | |
|---|---|
| **Document** | Market Validation & Public Creator Research |
| **Owner** | Marsha (Product, QA & Submission) |
| **Milestone** | M1 — Core Loop / Potential Impact Validation |
| **Related** | [PRD](PRD.md) · [URD](URD.md) · [Agreement Schema](agreement-schema.md) · [Architecture](architecture.md) |

> **Context:** As outlined in PRD §2 and Q5, direct user interviews were not feasible within the hackathon timeframe. This research gathers and synthesizes public posts, case discussions, and community consensus across creator forums (Reddit `r/Artists`, `r/ArtistLounge`, `r/artbusiness`, `r/VirtualYoutubers`, `r/Live2D`, and international freelance communities) to validate the core problem statements, user needs, and solution architecture of **DMpact**.
>
> In accordance with ethical research practices and issue guidelines, all individual usernames, handles, and client identities have been anonymized.

---

## 1. Executive Summary: Core Pain Points & Impact

Creator transactions conducted informally through Direct Messages (DMs) suffer from three systemic failure modes:

| Core Pain Point | Underlying Issues | Real-World Impact on Creators |
|---|---|---|
| **A. Unclear Agreements & Payment Risk** | Client ghosting, no upfront deposit, late/unpaid balances, arbitrary price negotiation | Creator loses income, spends hours chasing invoices, or works for free when clients vanish after receiving deliverables. |
| **B. Uncontrolled Scope & Revisions** | "Revision hell", moving goalposts, retroactive changes, boundary blur | Creative fatigue, burnout, lost hours without additional compensation, delayed queue for other clients. |
| **C. Lack of Project Transparency & Evidence** | Communication breakdown, no single source of truth, losing PayPal disputes due to lack of verifiable delivery proof | Chargebacks filed under "Unauthorized Transaction" or "Item Not Received" where PayPal favors the buyer due to digital goods ambiguity. |

---

## 2. Public Sources & Community Case Studies

### Source 1: "Client Ghosted After Work is Done" — Payment Risk & Deposit Tracking
* **Community / Platform:** Reddit (`r/Artists`)
* **Thread Title:** *"A customer has ghosted me/ wont pay- what do I message them?"*
* **Source Link:** [Reddit: A customer has ghosted me/ wont pay](https://www.reddit.com/r/Artists/comments/10gwxio/a_customer_has_ghosted_me_wont_pay_what_do_i/)
* **Theme:** Client disappears before paying remaining balance after work is completed.
* **Anonymized Case Context & Creator Quote:**
  > *"I took a small deposit upfront (£20 on a £90 commission). The client asked for a major revision (changing a night scene to daytime), which I did. When I showed the finished watermarked piece, the client said they loved it, promised to send the rest of the payment the next day, and then completely stopped responding across multiple follow-up messages. Now I'm left chasing the remaining £70 balance with no reply."*
* **Analysis & DMpact Solution:**
  * **The Problem:** The creator relied on an inadequate upfront deposit and informal trust in DMs. Without an automated, staged payment mechanism, chasing the final balance turns into unpaid emotional and administrative labor.
  * **DMpact Countermeasure:** **FR-1.1 & FR-1.8** standardizes deposit milestones (50% upfront deposit as safe commerce standard); **FR-6.10** strictly gates final file delivery on the `fully_paid` state, automatically issuing balance invoices and unlocking final files only after PayPal confirms receipt via webhook.

---

### Source 2: "Scope Creep & The Tangential Changes Trap" — Uncontrolled Scope
* **Community / Platform:** Reddit (`r/ArtistLounge`)
* **Thread Title:** *"Commissioned work and scope creep"*
* **Source Link:** [Reddit: Commissioned work and scope creep](https://www.reddit.com/r/ArtistLounge/comments/tegp98/commissioned_work_and_scope_creep/)
* **Theme:** Moving goalposts, endless tweaks, and blurred project boundaries draining creator hours.
* **Anonymized Case Context & Creator Quote:**
  > *"I started taking freelance logo and graphic design work. Clients give a rough idea, I quote a flat price, and then they continuously ask for more changes and tweaks that stretch far beyond what we started with. Because the changes feel 'related' to the project, I feel trapped into saying yes instead of knowing how to set a firm limit or charge extra without feeling awkward. It completely kills my hourly rate."*
* **Analysis & DMpact Solution:**
  * **The Problem:** Social media DMs lack structured bounds on revisions. Clients perceive ongoing tweaks as free, and creators lack an assertive, objective way to say "this is out of scope" without risking conflict.
  * **DMpact Countermeasure:** **FR-1.2 & FR-1.9** extracts and locks explicit `revisions.included` counts, flagging missing or vague limits as warnings/blockers. When clients push beyond scope, DMpact's **AI Negotiation Engine (FR-3.1)** generates three assertive, polite counteroffer templates (firm, compromise, or paid add-on).

---

### Source 3: "Digital Commission Chargebacks" — Delivery Evidence & Dispute Protection
* **Community / Platform:** Reddit (`r/artbusiness`)
* **Thread Title:** *"Digital Commission Chargebacks"*
* **Source Link:** [Reddit: Digital Commission Chargebacks](https://www.reddit.com/r/artbusiness/comments/tykvjy/digital_commission_chargebacks/)
* **Theme:** Digital creators losing PayPal disputes due to lack of verifiable delivery tracking.
* **Anonymized Case Context & Creator Community Consensus:**
  > *"When dealing with PayPal chargebacks on private digital commissions, artists frequently find themselves unprotected. PayPal's standard seller protections are built around physical shipping tracking numbers. When a client files an 'Unauthorized Transaction' or dispute, chat screenshots from Discord or Twitter are easily dismissed as inconclusive, leaving creators with negative balances and dispute fees."*
* **Analysis & DMpact Solution:**
  * **The Problem:** Conventional chat DMs provide no cryptographic link between the agreed terms, the client's PayPal payment, and the delivered digital artifact.
  * **DMpact Countermeasure:** **FR-7.1 & FR-8A.4** compute an immutable SHA-256 fingerprint for every delivered file upon upload; **FR-6.12** exports a tamper-evident **Dispute Evidence Pack (PDF)** that binds the signed agreement version, server UTC timestamps, delivery SHA-256 hash, and PayPal transaction IDs for immediate submission to PayPal dispute resolution.

---

### Source 4: "Missed Deadlines & Unclear Commercial Rights in Debut Assets" — Project Transparency
* **Community / Platform:** Reddit (`r/VirtualYoutubers` & `r/Live2D`)
* **Thread Titles:**
  * *"Why do you think ghosting and missed deadlines are so common when commissioning artists?"* ([Link](https://www.reddit.com/r/VirtualYoutubers/comments/1k1g127/why_do_you_think_ghosting_and_missed_deadlines/))
  * *"How much do artists usually charge for commercial fee?"* ([Link](https://www.reddit.com/r/Live2D/comments/1b3sv7b/how_much_do_artists_usually_charge_for_commercial/))
* **Theme:** Unclear delivery timelines and ambiguity over commercial streaming/monetization rights causing public disputes.
* **Anonymized Creator / Client Insight:**
  > *"In the VTuber and content creator space, commissioning assets (Live2D models, rigging, vocal mixing, overlays) often runs into deadline chaos and licensing friction. Commissioners assume monetized streaming rights are included in the base rate, while artists expect a 50%–100%+ commercial fee. When deadlines slip or rights aren't written down in an explicit contract, debut plans get derailed and both parties end up in public drama."*
* **Analysis & DMpact Solution:**
  * **The Problem:** Informal DMs often use vague delivery targets (e.g., "ASAP", "before my debut") and fail to explicitly state commercial versus personal usage rights.
  * **DMpact Countermeasure:** **FR-1.9** enforces mandatory **blocking ambiguity flags** for missing/relative deadlines (`VAGUE_DEADLINE_ASAP`, `RELATIVE_DEADLINE`) and missing usage rights (`MISSING_USAGE_RIGHTS`). Agreements cannot be locked until an exact calendar date and commercial rights terms are affirmed.

---

### Source 5: "Cross-Border Commissions & PayPal Invoicing Fees" — Payment Feasibility
* **Community / Platform:** Reddit (`r/artbusiness`)
* **Thread Title:** *"Do you charge your clients Pay pal fees?"*
* **Source Link:** [Reddit: Do you charge your clients Pay pal fees?](https://www.reddit.com/r/artbusiness/comments/1fb0eja/do_you_charge_pay_pal_fees/)
* **Theme:** International freelancers handling PayPal transaction fees, multi-stage deposits, and currency friction.
* **Anonymized Case Context & Creator Quote:**
  > *"When splitting commission payments into a 50% deposit and 50% final balance for international clients, transaction fees and currency conversions hit twice. Asking clients to pay PayPal fees as an extra line item causes friction and can violate PayPal TOS, but absorbing hidden conversion spreads severely cuts into margins. Many creators struggle with setting up proper invoices that handle deposits cleanly across different currencies."*
* **Analysis & DMpact Solution:**
  * **The Problem:** Independent creators lack automated tooling to manage international currency conversion, staged invoicing, and rate verification, often encountering currency blockers (such as unsupported IDR in PayPal Invoicing).
  * **DMpact Countermeasure:** **FR-1.6** identifies unsupported invoice currencies (`UNSUPPORTED_CURRENCY` blocker) and suggests USD conversion; **FR-3.1** benchmarks client offers against the creator's USD rate card; **FR-6.1** utilizes native PayPal Invoicing v2 API to create professional staged invoices with automatic fee and deposit calculation.

---

## 3. Key Validation Findings for Product Design

1. **Staged Invoicing (50/50) is the Industry Consensus:**
   Across all creative communities, the golden standard for commission safety is **50% deposit upfront before work begins, 50% upon completion**. DMpact automates this staged invoicing natively via PayPal Invoicing API.

2. **Gated Delivery Eliminates Final Balance Ghosting:**
   The single most common financial loss experienced by independent creators occurs when unwatermarked or master files are delivered prior to balance settlement. Gating the final download behind verified webhook events (`INVOICING.INVOICE.PAID`) completely removes this vulnerability.

3. **Deterministic Ambiguity Flagging Prevents "Revision Hell":**
   Vague deadlines (e.g. "ASAP") and unmentioned commercial usage rights are the leading drivers of post-agreement conflict. Flagging these as blockers (FR-1.9) protects both creator and client before any money moves.

4. **Cryptographic Proof is Required for Disputes:**
   PayPal and credit card arbitrations routinely reject raw chat screenshots as inconclusive. A structured Evidence Pack with SHA-256 hashes, server-side UTC timestamps, and linked PayPal invoice records provides decisive evidence for dispute defense.
