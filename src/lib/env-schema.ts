import { z } from "zod";

const optional = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEON_AUTH_BASE_URL: z.url(),
  NEON_AUTH_COOKIE_SECRET: z.string().min(32),
  APP_BASE_URL: z.url(),
  GEMINI_API_KEY: optional,
  GEMINI_MODEL: optional,
  GEMINI_FALLBACK_MODEL: optional,
  PAYPAL_API_BASE: optional,
  PAYPAL_CLIENT_ID: optional,
  PAYPAL_CLIENT_SECRET: optional,
  PAYPAL_WEBHOOK_ID: optional,
  PAYPAL_MOCK: optional,
  AWS_ENDPOINT_URL_S3: optional,
  AWS_REGION: optional,
  AWS_ACCESS_KEY_ID: optional,
  AWS_SECRET_ACCESS_KEY: optional,
  CRON_SECRET: optional,
  DEMO_CREATOR_EMAIL: optional,
  DEMO_CLIENT_PAYPAL_EMAIL: optional,
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return parsed.data;

  const names = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
  throw new Error(`Missing or invalid env vars: ${names.join(", ")}`);
}
