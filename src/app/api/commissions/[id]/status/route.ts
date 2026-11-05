import { revalidateTag } from "next/cache";
import { after, NextResponse } from "next/server";
import { getCommissionStatus } from "@/lib/repositories/commission-repository";
import { refreshPayments } from "@/lib/repositories/invoice-sync-repository";
import { commissionIdSchema } from "@/lib/schema/commission-forms";

const NOT_FOUND = { error: "Commission not found." };

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/commissions/[id]/status">,
) {
  const { id } = await params;
  const parsed = commissionIdSchema.safeParse(id);
  if (!parsed.success) return NextResponse.json(NOT_FOUND, { status: 404 });

  const status = await getCommissionStatus(
    parsed.data,
    request.headers.get("x-client-token"),
  );
  if (!status) return NextResponse.json(NOT_FOUND, { status: 404 });

  // Webhook fallback: while someone is waiting on an unpaid invoice, check
  // PayPal in the background once it has been out for 10+ minutes.
  if (status.deposit.status === "sent" || status.balance.status === "sent") {
    const commissionId = parsed.data;
    after(async () => {
      try {
        const { changed } = await refreshPayments(commissionId, "background");
        if (changed > 0) {
          revalidateTag("commissions", "max");
          revalidateTag(`commission-${commissionId}`, "max");
        }
      } catch (error) {
        console.error(
          `Background payment check for ${commissionId} failed.`,
          error,
        );
      }
    });
  }

  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
