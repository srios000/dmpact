import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resetDemoCommissions } from "@/lib/demo/demo-commissions";
import { env } from "@/lib/env";

function authorized(request: Request): boolean {
  if (!env.CRON_SECRET) return false;
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const email = env.DEMO_CREATOR_EMAIL?.toLowerCase();
  const clientPaypalEmail = env.DEMO_CLIENT_PAYPAL_EMAIL;
  if (!email || !clientPaypalEmail) {
    return NextResponse.json({ skipped: "Demo env vars are not set." });
  }

  const creator = await db.creator.findUnique({ where: { email } });
  if (!creator) {
    return NextResponse.json({ skipped: "The demo creator doesn't exist." });
  }

  const seeded = await resetDemoCommissions(db, creator.id, clientPaypalEmail);
  revalidateTag("commissions", { expire: 0 });
  return NextResponse.json(
    { commissions: seeded.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
