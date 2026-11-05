import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  regions: ["sin1"],
  buildCommand: "pnpm db:deploy && pnpm build",
  crons: [{ path: "/api/cron/overdue", schedule: "0 1 * * *" }],
};
