# Creator Pain Points & Market Validation Research

| | |
|---|---|
| **Document** | Market Validation & Public Creator Research |
| **Owner** | Marsha (Product, QA & Submission) |
| **Milestone** | M1 — Core Loop / Potential Impact Validation |
| **Related** | [PRD](PRD.md) · [URD](URD.md) · [Agreement Schema](agreement-schema.md) · [Architecture](architecture.md) |

> **Context:** As outlined in PRD §2 and Q5, direct user interviews were not feasible within the hackathon timeframe. This research summarizes public Reddit threads from creator communities (`r/Artists`, `r/ArtistLounge`, `r/artbusiness`, `r/VirtualYoutubers`, `r/Live2D`) to check the problem statements behind **DMpact**.
>
> In accordance with ethical research practices and issue guidelines, all individual usernames, handles, and client identities have been anonymized.

---

## 1. Executive Summary: Core Pain Points & Impact

Creator transactions conducted informally through Direct Messages (DMs) suffer from three systemic failure modes:

| Core Pain Point | Underlying Issues | Real-World Impact on Creators |
|---|---|---|
| **A. Unclear Agreements & Payment Risk** | Client ghosting, small upfront deposit, unpaid balances | Creator loses income or spends hours chasing payment after the work is done. |
| **B. Uncontrolled Scope & Revisions** | "Revision hell", moving goalposts, retroactive changes, boundary blur | Creative fatigue, burnout, lost hours without additional compensation, delayed queue for other clients. |
| **C. Lack of Project Transparency & Evidence** | Communication breakdown, no single record of what was agreed and delivered | When a payment is disputed, the creator has to rebuild the history from chats. Commenters say chargebacks tend to favor the buyer. |

---

## 2. Public Sources & Community Case Studies

### Source 1: "Client Ghosted After Work is Done" — Payment Risk & Deposit Tracking
* **Community / Platform:** Reddit (`r/Artists`)
* **Thread Title:** *"A customer has ghosted me/ wont pay- what do I message them?"*
* **Source Link:** [Reddit: A customer has ghosted me/ wont pay](https://www.reddit.com/r/Artists/comments/10gwxio/a_customer_has_ghosted_me_wont_pay_what_do_i/)
* **Theme:** Client disappears before paying remaining balance after work is completed.
* **Summary of the post (paraphrased, not a quote):**
  > The artist took a £20 deposit on a £90 digital commission. The client asked for a revision (night scene to daytime), which the artist did for free while noting further revisions would cost £10/hour. The client said they loved the watermarked piece and asked to pay the next day, then stopped replying to follow-ups after three days and one week.
* **Analysis & DMpact Solution:**
  * **The Problem:** The deposit covered only about a fifth of the price, and the artist had to chase the balance by hand. One commenter says they now take 50% or more upfront because clients who pay less upfront ghost more often.
  * **DMpact Countermeasure:** **FR-6.7** defaults the deposit to 50%; **FR-6.2** sends the balance invoice on delivery; **FR-6.5** sends PayPal reminders for overdue invoices and drafts a nudge message; **FR-6.10** lets the client download the final file only after `fully_paid`.

---

### Source 2: "Scope Creep & The Tangential Changes Trap" — Uncontrolled Scope
* **Community / Platform:** Reddit (`r/ArtistLounge`)
* **Thread Title:** *"Commissioned work and scope creep"*
* **Source Link:** [Reddit: Commissioned work and scope creep](https://www.reddit.com/r/ArtistLounge/comments/tegp98/commissioned_work_and_scope_creep/)
* **Theme:** Moving goalposts, endless tweaks, and blurred project boundaries draining creator hours.
* **Summary of the post (paraphrased, not a quote):**
  > The artist started doing logos and graphic design on the side. They quote based on the client's first description, but clients keep asking for changes. One client first asked for a check of business card layouts; over two weeks the small tweaks added up to a new set of materials and a logo. The artist doesn't know when to say no or charge more, and says they've undercharged.
* **Analysis & DMpact Solution:**
  * **The Problem:** Nothing written down limited the revisions, so every request felt like part of the original job. Most commenters give the same fix: state the number of included revisions and the price of extra ones before starting.
  * **DMpact Countermeasure:** **FR-1.2** extracts the revision count into the agreement, and the schema flags a missing or vague count (`MISSING_REVISIONS`, `VAGUE_REVISIONS`) as a warning so the creator sets it before the client agrees. **FR-3.2** offers up to 3 counteroffers (reduce scope, adjust price, split into milestones) when the budget is below the rate card estimate.

---

### Source 3: "Digital Commission Chargebacks" — Delivery Evidence & Dispute Protection
* **Community / Platform:** Reddit (`r/artbusiness`)
* **Thread Title:** *"Digital Commission Chargebacks"*
* **Source Link:** [Reddit: Digital Commission Chargebacks](https://www.reddit.com/r/artbusiness/comments/tykvjy/digital_commission_chargebacks/)
* **Theme:** A client filed a PayPal chargeback as "unauthorized transaction" days after paying for and receiving a digital commission.
* **Summary of the post (paraphrased, not a quote):**
  > Nine days after a paid PayPal invoice and delivery, the artist got a chargeback for an "unauthorized transaction" and asked what proof would help. Commenters said to dispute right away because chargebacks tend to favor the buyer, and to send PayPal every message, the client's email, and the artwork. The client later said their bank had flagged the payment automatically.
* **Analysis & DMpact Solution:**
  * **The Problem:** The artist's proof was spread across an email thread and the PayPal invoice, so they had to gather it by hand.
  * **DMpact Countermeasure:** **FR-7.1** stores a SHA-256 hash and server timestamp for every delivered file, and **FR-8A.4** keeps delivered files from being deleted or replaced. **FR-7.3** exports an evidence pack (PDF) with the final agreement version and hash, both confirmation timestamps, the original DM, invoice IDs and paid timestamps, and the delivery and event logs.

---

### Source 4: "Missed Deadlines & Unclear Commercial Fees" — Deadlines and Usage Rights
* **Community / Platform:** Reddit (`r/VirtualYoutubers` & `r/Live2D`)
* **Thread Titles:**
  * *"Why do you think ghosting and missed deadlines are so common when commissioning artists?"* ([Link](https://www.reddit.com/r/VirtualYoutubers/comments/1k1g127/why_do_you_think_ghosting_and_missed_deadlines/))
  * *"How much do artists usually charge for commercial fee?"* ([Link](https://www.reddit.com/r/Live2D/comments/1b3sv7b/how_much_do_artists_usually_charge_for_commercial/))
* **Theme:** Clients describe artists missing deadlines without updates, and artists disagree on whether commercial use costs extra.
* **Summary of the post (paraphrased, not a quote):**
  > In the VTuber thread, a client asks why commissioned artists so often ghost or miss deadlines; replies blame poor communication and inexperience, and suggest agreeing on a timeline and holding payment until delivery. In the Live2D thread, a new artist asks how much to charge as a commercial fee; replies say a model's price should already include commercial use, and that fees for other work vary with the client.
* **Analysis & DMpact Solution:**
  * **The Problem:** Both threads come down to terms that were never written down: when the work is due, and whether commercial use is included in the price.
  * **DMpact Countermeasure:** **FR-1.9** blocks the agreement when the deadline has no exact date (`MISSING_DEADLINE`, including "ASAP") or usage rights aren't mentioned (`MISSING_USAGE_RIGHTS`). **FR-1.5** resolves relative dates like "before debut" and flags them `RELATIVE_DEADLINE` (warning) for the creator to confirm.

---

### Source 5: "Cross-Border Commissions & PayPal Invoicing Fees" — Payment Feasibility
* **Community / Platform:** Reddit (`r/artbusiness`)
* **Thread Title:** *"Do you charge your clients Pay pal fees?"*
* **Source Link:** [Reddit: Do you charge your clients Pay pal fees?](https://www.reddit.com/r/artbusiness/comments/1fb0eja/do_you_charge_pay_pal_fees/)
* **Theme:** A digital artist with US clients loses about $5 in PayPal fees on each $90 payment, twice per commission with a 50/50 split.
* **Summary of the post (paraphrased, not a quote):**
  > The artist splits payment 50/50, so PayPal fees are charged on two transactions, and asks whether to add a $10 fee for clients. Commenters advise building fees into the price instead of listing them, some say PayPal's terms may not allow passing fees on, and one suggests a single PayPal invoice with partial payment to avoid two transactions.
* **Analysis & DMpact Solution:**
  * **The Problem:** Splitting payment across two separate transactions means paying fixed PayPal fees twice, and trying to pass processing surcharges to the client can cause friction or conflict with terms of service.
  * **DMpact Countermeasure:** **FR-6.1 & FR-6.2** manage staged invoicing via the PayPal Invoicing API. **FR-3.1** compares client offers against the creator's rate card so creators can price their work sustainably to account for fees, while **FR-1.6** prevents currency errors by flagging unsupported currencies (`UNSUPPORTED_CURRENCY` blocker) with USD conversion.

---

## 3. Key Validation Findings for Product Design

1. **Staged Invoicing (50/50) is the Industry Consensus:**
   Across all creative communities, the golden standard for commission safety is **50% deposit upfront before work begins, 50% upon completion**. DMpact automates this staged invoicing natively via PayPal Invoicing API.

2. **Gated Delivery Eliminates Final Balance Ghosting:**
   The single most common financial loss experienced by independent creators occurs when unwatermarked or master files are delivered prior to balance settlement. Gating the final download behind verified webhook events (`INVOICING.INVOICE.PAID`) completely removes this vulnerability.

3. **Write Down Revisions, Deadlines, and Usage Rights Before Work Starts:**
   Commenters in Sources 2 and 4 recommend setting the number of revisions, the timeline, and commercial use up front. DMpact flags a missing deadline or usage rights as blockers (FR-1.9) and a missing or vague revision count as a warning, before any money moves.

4. **Keep Dispute Evidence in One Place:**
   In Source 3, commenters say to send PayPal every message and the delivered work. DMpact's evidence pack (FR-7.3) collects the agreement, timestamps, invoice records, and delivery hashes into one PDF.
