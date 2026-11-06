import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import {
  canAccessCommission,
  refreshPayments,
} from "@/lib/repositories/invoice-sync-repository";
import { commissionIdSchema } from "@/lib/schema/commission-forms";

const NOT_FOUND = { error: "Commission not found." };

/**
 * Manual "Refresh payment status" for when a PayPal webhook is slow or lost.
 * Asks PayPal directly and applies the result like the webhook would.
 * Callers: the client page (x-client-token header) or the owning creator.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/commissions/[id]/refresh-payment">,
) {
  const { id } = await params;
  const parsed = commissionIdSchema.safeParse(id);
  if (!parsed.success) return NextResponse.json(NOT_FOUND, { status: 404 });

  const allowed = await canAccessCommission(
    parsed.data,
    request.headers.get("x-client-token"),
  );
  if (!allowed) return NextResponse.json(NOT_FOUND, { status: 404 });

  try {
    const result = await refreshPayments(parsed.data, "manual");
    if (result.changed > 0) {
      revalidateTag("commissions", { expire: 0 });
      revalidateTag(`commission-${parsed.data}`, { expire: 0 });
    }
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(`Payment refresh for ${parsed.data} failed.`, error);
    return NextResponse.json(
      { error: "Couldn't reach PayPal. Try again in a moment." },
      { status: 502 },
    );
  }
}
