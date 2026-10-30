# DMpact — User Requirements Document

| | |
|---|---|
| **Status** | Under Review |
| **Related** | [PRD](PRD.md) · [Agreement Schema](agreement-schema.md) |

The PRD says *what we build*. This document says *who it's for and what they need to do*, as user stories with acceptance criteria to test against. Story IDs (`US-xx`) can be referenced from issues and test cases.

> The users below are hypotheses from the team's idea pitches. They haven't been validated with real creators or clients yet (see #46).

---

## 1. Users

| User | Who | What they need (hypothesis) |
|---|---|---|
| **Creator** (primary) | Freelance mixer / illustrator / Live2D rigger / MV editor taking commissions over DMs | Clear terms, the deposit before starting, the balance after delivery, proof if something goes wrong |
| **Client** (secondary) | VTuber / YouTuber commissioning that work | A clear price, deliverables, and deadline; paying with PayPal; no account to create |
| **Judge** (evaluator) | Hackathon judge | Understand and try the full flow quickly |

## 2. User needs

| ID | Need | User |
|---|---|---|
| UN-1 | Turn a chat into clear terms without retyping | Creator |
| UN-2 | Know what's unclear before committing | Creator |
| UN-3 | Respond to a budget that's too low for the scope | Creator |
| UN-4 | Get the deposit before starting work | Creator |
| UN-5 | Get the final payment | Creator |
| UN-6 | Prove what was agreed and delivered | Creator |
| UN-7 | See all commissions, money, and deadlines in one place | Creator |
| UN-8 | Understand the deal and pay without signing up | Client |
| UN-9 | Ask for changes before committing | Client |
| UN-10 | Try the full flow quickly | Judge |

## 3. User stories and acceptance criteria

### Epic A — Capture the deal (UN-1, UN-2)

**US-01 — Paste a DM to start a commission**
As a creator, I want to paste a commission DM and get the terms extracted, so I don't have to retype them.
- [ ] A paste box accepts up to 10,000 characters, including emoji and mixed languages.
- [ ] Within 10 s, I see a filled agreement: service, deliverables, price, currency, deposit, deadline, revisions, usage rights.
- [ ] If extraction fails, I see an error and can retry or fill in the agreement by hand. Nothing is lost.

**US-02 — See what's ambiguous**
As a creator, I want unclear or missing terms flagged, so I can ask the client before we start.
- [ ] Each flag shows the field, the reason, the quote from the DM, and a suggested question.
- [ ] Blocker flags look different from warnings.
- [ ] I can't send the agreement to the client until all blockers are resolved.
- [ ] Prices in currencies PayPal doesn't support (e.g. IDR) are flagged.

**US-03 — Edit the agreement**
As a creator, I want to correct anything the AI got wrong.
- [ ] Every field is editable. Saving creates a new version, and older versions stay viewable.
- [ ] Deposit and balance amounts recalculate when the total or deposit changes.

### Epic B — Negotiate (UN-3)

**US-04 — Get counteroffers when the budget is too low**
As a creator, when a client's budget doesn't match the scope, I want ready-made counteroffers.
- [ ] If the budget is more than the threshold under my rate card estimate, I see a mismatch notice with the estimate and the reason.
- [ ] I get 1–3 options labelled *Reduce scope*, *Adjust price*, or *Split into milestones*.
- [ ] Each option shows what changes in the agreement and a message draft.
- [ ] If the budget is fair, I see "Looks fair" and no counteroffers.

**US-05 — Edit and use a counteroffer message**
- [ ] I can edit the message before copying it.
- [ ] "Copy message" copies to the clipboard. "Apply to agreement" creates a new version with the option's changes.

**US-06 — Set my rate card**
As a creator, I want to set my prices so the mismatch check uses my rates.
- [ ] I can set a base price per service type and prices for extras.
- [ ] A default rate card exists so the demo works without setup.

### Epic C — Agree and get the deposit (UN-4, UN-8, UN-9)

**US-07 — Share the agreement with the client**
- [ ] One click generates a private link that I can copy.
- [ ] Status changes to *negotiating*.

**US-08 — Client reviews and confirms (no login)**
As a client, I want to open a link, see exactly what I'm getting, and confirm.
- [ ] The page shows deliverables, price, deposit, balance, deadline, revisions, and usage rights, and works on mobile.
- [ ] **Confirm** records my confirmation with a timestamp for this exact version.
- [ ] If the creator changes the agreement after I confirmed, I have to confirm again.

**US-09 — Client requests changes**
- [ ] **Request changes** lets me write a note that the creator sees.
- [ ] The commission stays in *negotiating*.

**US-10 — Client pays the deposit with PayPal**
- [ ] After I confirm, a PayPal deposit invoice is sent and the page shows a **Pay deposit with PayPal** button.
- [ ] After I pay, the page and the creator's dashboard show *Deposit paid*.
- [ ] The creator can't mark the deposit paid by hand. It comes from PayPal.

### Epic D — Deliver and get the balance (UN-5, UN-6)

**US-11 — Mark work in progress**
- [ ] After the deposit is paid, I can move the commission to *in progress*.

**US-12 — Log a delivery**
As a creator, I want my delivery recorded as evidence.
- [ ] I can upload a file (preview or final), and the app shows its SHA-256 fingerprint and timestamp.
- [ ] Logged deliveries can't be edited or deleted.
- [ ] Logging a delivery moves the commission to *delivered* and sends the balance invoice.

**US-13 — Reminders for overdue invoices**
- [ ] If an invoice is past due, PayPal sends a reminder and I get a nudge message I can copy.
- [ ] Reminders go out at most once per day per invoice.

**US-14 — Fully paid**
- [ ] When the balance invoice is paid, the commission becomes *fully paid*.

**US-15 — Evidence pack**
As a creator facing a dispute, I want all the evidence in one file.
- [ ] One click downloads a PDF with the original DM, final agreement + version hash, both confirmation timestamps, invoices and payment times, delivery fingerprints, and the event timeline.

### Epic E — Manage the queue (UN-7)

**US-16 — See all commissions**
- [ ] A grid lists every commission with client, service, total, deposit status, balance status, state, deadline, and days left.
- [ ] I can sort, filter by state, and search by client.
- [ ] Overdue payments and close deadlines are highlighted.
- [ ] A summary shows money outstanding and commissions due this week.

**US-17 — Commission detail and timeline**
- [ ] Clicking a row opens the commission with its agreement, versions, invoices, deliveries, and event timeline.

### Epic F — Evaluate (UN-10)

**US-18 — Judge can run it**
- [ ] The README has a hosted demo link and/or local setup that takes ≤ 10 minutes.
- [ ] A demo account and sample DMs are available. Sandbox only, no real data.

## 4. Questions to validate with users

- Do creators handle commissions mostly on phone or laptop?
- Would clients use a confirmation link, or do they expect everything inside the DM?
- Which currencies do creators and clients actually use?
- Which of the pains in PRD §2 are real and frequent, and which aren't?

## 5. Traceability

| Story | PRD feature |
|---|---|
| US-01–03 | F1, F2 |
| US-04–06 | F8, F13 |
| US-07–10 | F3, F4, F5, F6 |
| US-11–14 | F3, F9, F10, F11 |
| US-15 | F12 |
| US-16–17 | F7, F14 |
| US-18 | NFR-6 |
