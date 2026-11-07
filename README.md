# DMpact

A PayPal + AI hackathon project for creators who take commissions over DMs.

Live: https://dmpact.vercel.app

## Planned flow

1. **Paste the DM.** Gemini extracts price, currency, deadline, revisions, deposit terms, and deliverables, and flags anything ambiguous.
2. **Negotiate.** If budget and scope don't match, the AI suggests up to 3 counteroffers the creator can edit.
3. **Client confirms** on a private link, no account needed.
4. **Deposit invoice** is sent through PayPal. A webhook marks it paid.
5. **Deliver.** The file's SHA-256 hash and timestamp are logged, and the balance invoice goes out.
6. **Reminders** for overdue invoices, with an AI-drafted nudge.
7. **Evidence pack** for disputes: agreement, confirmations, invoices, delivery log.

All commissions are tracked in an AG Grid queue.

## Planned stack

Next.js · TypeScript · PostgreSQL · Google Gemini · PayPal Invoicing v2 + Webhooks (Sandbox) · AG Grid · Vercel · Neon

## Docs

- [PRD](docs/PRD.md)
- [URD](docs/URD.md)
- [Agreement schema](docs/agreement-schema.md)
- [Architecture](docs/architecture.md)
- [Timeline](docs/timeline.md)
- [Submission checklist](docs/submission-checklist.md)
- [Contributing](CONTRIBUTING.md)

## Setup

```bash
git clone https://github.com/srios000/dmpact.git
cd dmpact
pnpm install
cp .env.example .env
pnpm db:deploy
pnpm dev
```

Requires Node 24 and pnpm. Each teammate develops on their own Neon branch (`dev-<name>` in the `dmpact` Neon project), which has its own database, auth, and storage. In the Neon console, open your branch: **Connect** gives `DATABASE_URL` (pooled) and `DIRECT_URL` (direct), and **Auth** gives `NEON_AUTH_BASE_URL`. Generate `NEON_AUTH_COOKIE_SECRET` with `openssl rand -base64 32`. For a database-only setup without Neon, run `docker compose up -d` and keep the local `DATABASE_URL` / `DIRECT_URL`. Fill in the PayPal sandbox and Gemini keys in `.env`.

`pnpm db:reset` wipes your database and re-applies all migrations.

### Demo account

Set `DEMO_CREATOR_EMAIL`, `DEMO_CREATOR_PASSWORD`, and `DEMO_CREATOR_PAYPAL_EMAIL` (the PayPal sandbox business email) in `.env`, then run `pnpm db:seed`. It creates the Neon Auth user and its creator row, and is safe to run again. Log in at `/login`. Use sandbox-only credentials.

## Troubleshooting

### A PayPal payment doesn't show as paid

Paid status normally arrives through the PayPal webhook (`/api/webhooks/paypal`). Sandbox webhooks can be slow or never arrive, so there are two fallbacks that ask PayPal directly and apply the result the same way the webhook does:

- **Automatic:** while the client page or dashboard polls `/api/commissions/[id]/status`, any invoice still unpaid 10 minutes after it was sent is checked at PayPal (at most once a minute per commission).
- **Manual:** `POST /api/commissions/[id]/refresh-payment` checks right away (at most every 10 seconds). Send the client token in the `x-client-token` header, or call it while signed in as the creator.

If it still shows unpaid:

1. In the PayPal developer dashboard (Sandbox), open **Event Logs → Webhooks Events** and check whether the event was sent and what the app answered. `401` means the signature didn't verify: check that `PAYPAL_WEBHOOK_ID` matches the webhook registered for that exact URL. `500` usually means `PAYPAL_WEBHOOK_ID` is missing.
2. Check that the invoice was paid with the sandbox **Personal** account and shows **Paid** in the sandbox Business account.
3. Local dev only receives webhooks through a tunnel (see [docs/paypal-sandbox.md](docs/paypal-sandbox.md)). Without one, use the manual refresh.

## Team

[@srios000](https://github.com/srios000) · [@imjia05stay-star](https://github.com/imjia05stay-star) · [@Wynnzzz](https://github.com/Wynnzzz) · [@Firsta30](https://github.com/Firsta30) · [@hasnapriswati](https://github.com/hasnapriswati) · [@marshaniswah](https://github.com/marshaniswah)

## License

[MIT](LICENSE)
