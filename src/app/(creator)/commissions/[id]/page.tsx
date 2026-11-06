import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { todayInZone } from "@/lib/ai/extract";
import { getCommission } from "@/lib/repositories/commission-repository";
import { agreementEditMode } from "@/lib/state-machine/agreement-edits";
import { AgreementEditor } from "./_components/agreement-editor";

export const instant = false;

export const metadata: Metadata = {
  title: "Agreement | DMpact",
  robots: { index: false, follow: false },
};

export default async function CommissionDetailPage({
  params,
}: PageProps<"/commissions/[id]">) {
  const { id } = await params;
  const commission = await getCommission(id);
  if (!commission) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-12 md:py-10">
      <AgreementEditor
        commission={commission}
        mode={agreementEditMode(commission.state)}
        today={todayInZone()}
      />
    </div>
  );
}
