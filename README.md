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

Next.js · TypeScript · PostgreSQL · Google Gemini · PayPal Invoicing v2 + Webhooks (Sandbox) · AG Grid · Vercel · Supabase

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
docker compose up -d
pnpm db:deploy
pnpm dev
```

Requires Node 24, pnpm, and Docker. Without Docker, point `DATABASE_URL` and `DIRECT_URL` in `.env` at any local Postgres. Fill in the PayPal sandbox and Gemini keys in `.env`.

`pnpm db:reset` wipes the local database and re-applies all migrations.

## Team

[@srios000](https://github.com/srios000) · [@imjia05stay-star](https://github.com/imjia05stay-star) · [@Wynnzzz](https://github.com/Wynnzzz) · [@Firsta30](https://github.com/Firsta30) · [@hasnapriswati](https://github.com/hasnapriswati) · [@marshaniswah](https://github.com/marshaniswah)

## License

[MIT](LICENSE)
