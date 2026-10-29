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
