# DMpact

A PayPal + AI hackathon project for creators who take commissions over DMs.

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

## Team

[@srios000](https://github.com/srios000) · [@imjia05stay-star](https://github.com/imjia05stay-star) · [@Wynnzzz](https://github.com/Wynnzzz) · [@Firsta30](https://github.com/Firsta30) · [@hasnapriswati](https://github.com/hasnapriswati) · [@marshaniswah](https://github.com/marshaniswah)

## License

[MIT](LICENSE)
