import { NextResponse } from "next/server";
import { renderEvidencePdf } from "@/lib/evidence/evidence-pdf";
import { RepositoryError } from "@/lib/repositories/errors";
import { getEvidencePack } from "@/lib/repositories/evidence-repository";
import { commissionIdSchema } from "@/lib/schema/commission-forms";

const NOT_FOUND = { error: "Commission not found." };

/**
 * Evidence pack PDF (FR-7.3) for the signed-in creator who owns the
 * commission: agreement + hash, confirmations, invoices, upload evidence,
 * receipt evidence, the event timeline, and the original DM.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/commissions/[id]/evidence">,
) {
  const { id } = await params;
  const parsed = commissionIdSchema.safeParse(id);
  if (!parsed.success) return NextResponse.json(NOT_FOUND, { status: 404 });

  try {
    const pack = await getEvidencePack(parsed.data);
    const pdf = await renderEvidencePdf(pack);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="dmpact-evidence-${parsed.data.slice(-12)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof RepositoryError) {
      if (error.code === "unauthorized") {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.code === "not_found") {
        return NextResponse.json(NOT_FOUND, { status: 404 });
      }
    }
    throw error;
  }
}
