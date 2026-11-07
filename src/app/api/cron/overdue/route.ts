import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { createGeminiClient } from "@/lib/ai/gemini";
import { env } from "@/lib/env";
import { runOverdueReminders } from "@/lib/repositories/overdue-repository";

function authorized(request: Request): boolean {
  if (!env.CRON_SECRET) return false;
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Daily overdue reminders (Vercel Cron, see vercel.ts). For each unpaid
 * invoice past due: PayPal remind + an AI-drafted nudge stored on the
 * commission. At most once per invoice per 24 hours.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const outcomes = await runOverdueReminders({
    model: env.GEMINI_API_KEY ? createGeminiClient() : null,
  });

  const count = (status: string) =>
    outcomes.filter((o) => o.status === status).length;
  const changed = new Set(
    outcomes.filter((o) => o.status === "reminded").map((o) => o.commissionId),
  );
  if (changed.size > 0) revalidateTag("commissions", { expire: 0 });
  for (const id of changed) revalidateTag(`commission-${id}`, { expire: 0 });

  return NextResponse.json(
    {
      checked: outcomes.length,
      reminded: count("reminded"),
      skipped: count("skipped"),
      failed: count("failed"),
      outcomes,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
