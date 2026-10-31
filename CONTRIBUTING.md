# Contributing

## Workflow

1. Pick an issue from the **DMpact** project board. Assign yourself and move it to **In Progress**.
2. Branch from `main`: `<type>/<issue-number>-<short-slug>`
   - e.g. `feat/14-deposit-invoice`, `fix/31-webhook-dedupe`, `docs/2-readme-setup`
3. Commit with [Conventional Commits](https://www.conventionalcommits.org/): `feat: create deposit invoice on agreed`
4. Open a PR into `main`. Put `Closes #<issue>` in the description.
5. At least **1 approval** is required. **Rio** reviews anything touching `src/lib/schema`, `src/lib/state-machine`, or `prisma/`.
6. Squash-merge, then delete the branch.

## Rules

- **Never commit secrets.** Use `.env` (git-ignored). Add new keys to `.env.example` with an empty value.
- **PayPal sandbox only.** No live credentials anywhere.
- **Money is a decimal string**, never a float.
- **After changing a zod schema in `src/lib/schema/`, run `pnpm schema:generate`** and commit the JSON files. CI fails if they're out of date.
- **Never use `prisma db push`.** Change `prisma/schema.prisma`, run `pnpm db:migrate`, and commit the migration. `prisma generate` runs on `pnpm install`.
- Demo data uses fictional names only: no real VTubers, brands, or copyrighted assets.

## Frontend

### Atomic Design

| Level | Folder | Contains |
|---|---|---|
| Atoms | `src/components/ui/` | shadcn primitives: Button, Input, Badge. No business logic, no data fetching. |
| Molecules | `src/components/molecules/` | A few atoms with one job: form field, money input, ambiguity flag. Plain props only. |
| Organisms | `src/components/organisms/` | Sections that know domain types: agreement form, commission queue, counteroffer list. |
| Templates | `src/components/templates/` | Page layouts with slots. No data. |
| Pages | `src/app/**/page.tsx` | Fetch data and pass it down. |

- Import only from lower levels. Never upward, never across the same level.
- Add atoms with the shadcn CLI (`pnpm dlx shadcn@latest add <name>`), not by hand.
- One component per file, named in PascalCase, file in kebab-case.

### Variants

- A visual difference of the same component is a `cva` variant on that component, not a new component.
- Name variant props consistently: `variant`, `size`, and domain ones like `state`. Always set `defaultVariants`.
- No boolean style props (`isPrimary`, `isLarge`). Use a variant.
- `className` is for layout only (spacing, width, placement), not for restyling.
- Colors come from theme tokens, never hard-coded hex.

### Routes

- Route groups by audience: `(auth)`, `(creator)`. Group names never appear in the URL.
- URL segments in kebab-case. Dynamic segments named after what they identify: `[id]`, `[token]`. `params` is a Promise: `const { id } = await params`.
- Page-only components go in a private `_components/` folder next to the page.
- Route handlers (`app/api/`) only for callers outside the UI: Neon Auth, PayPal webhooks, cron, polling, file downloads. UI writes use Server Actions.
- The `(creator)` layout redirect is for UX only. The auth check that protects data happens in the repositories.

### Data and hooks

- Reads: Server Components call repositories. No client-side data fetching library (no TanStack Query, no SWR).
- Writes: Server Actions in an `actions.ts` next to the page (see Backend).
- Pending and optimistic UI: `useActionState`, `useTransition`, `useOptimistic`.
- Live status (payment): the `usePolling` hook against an `app/api/.../status` route.
- Forms: react-hook-form with the zod resolver, using the same schema as the server.
- Custom hooks live in `src/hooks/`, one per file, named `useX` in a kebab-case file (`use-polling.ts`).

## Backend

### Security

- Every Server Action and route handler checks access itself. Page, layout, and `proxy.ts` checks don't protect them.
- Read the session only through `getCurrentCreator()` in `src/lib/auth/` (wrapped in React `cache`).
- Actions take IDs, never whole objects, and re-read data on the server.
- Client-page actions check the agreement token instead of a session.

### Repositories

- One file per domain in `src/lib/repositories/` (`commission-repository.ts`, ...). Each starts with `import "server-only"`.
- Every function checks that the current creator owns the data.
- Return plain data that client components can receive: convert `Decimal` and `Date` to strings inside the repository.
- Business rules stay in `state-machine/`, `money/`, `ai/`, `paypal/`, not in repositories.

### Server Actions

- Order: validate input with zod → repositories, `state-machine/`, `paypal/` or `ai/` → `updateTag` → return.
- Return expected errors as values (`{ ok: false, error }`) and show them with `useActionState`. Throw only unexpected errors; they reach `error.tsx`.
- Writes only. Reads happen in Server Components.
- Pages whose actions call Gemini set `export const maxDuration`.

### Caching

Cache Components is on.

- Components that read the session or per-user data render inside `<Suspense>`. Don't `await` the session at the top of a layout.
- Per-user data is not cached with `"use cache"`.
- After a write: `updateTag` in Server Actions, `revalidateTag(tag, "max")` in route handlers.

### Route handlers

- PayPal webhook: read the raw body with `request.text()`, verify the signature, store the event (dedupe by ID), respond 200, and process it in `after()`.
- Cron: require `Authorization: Bearer $CRON_SECRET`.
- Missing records or bad tokens: `notFound()`.

### Config

- App code reads env vars only through `src/lib/env.ts` (`server-only`, validated with zod), never `process.env` directly.
- `DATABASE_URL` is Neon's pooled connection (host contains `-pooler`), `DIRECT_URL` the direct one for migrations.
- Develop on your own Neon branch (`dev-<name>`). The Neon `main` branch is the deployed demo; migrations reach it only through deploys.
- Integration tests (`*.integration.test.ts`) run only when `TEST_DATABASE_URL` points at a separate, migrated database. They wipe it.

## Types

- Database types come from Prisma (`@/generated/prisma/client`). Contract and form types come from zod schemas in `src/lib/schema/` via `z.infer`.
- Component props are typed in the component file.
- No separate `types/` folder.

## Labels

| Label | Meaning |
|---|---|
| `role: tech-lead` · `role: paypal` · `role: ai-extraction` · `role: ai-negotiation` · `role: frontend` · `role: product-qa` | Owning role |
| `P0` · `P1` · `P2` | Must ship for demo · should ship · nice to have |
| `stretch` | Only after the main flow works |
| `schema-contract` | Touches the shared Agreement schema |
| `blocked` | Waiting on something. Say what in a comment |

## Project board

Columns: `Todo` → `In Progress` → `In Review` → `Done`.

- New issues and PRs are added to the board automatically.
- Linking a PR to an issue (`Closes #N`) moves the issue to **In Review**.
- Merging the PR moves it to **Done** and closes the issue.
