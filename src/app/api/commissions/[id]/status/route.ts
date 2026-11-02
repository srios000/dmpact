import { NextResponse } from "next/server";
import { getCommissionStatus } from "@/lib/repositories/commission-repository";
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

  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
