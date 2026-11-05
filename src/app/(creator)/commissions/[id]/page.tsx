import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AgreementEditor } from "./_components/agreement-editor";
import { getCommission } from "@/lib/repositories/commission-repository";
import { agreementEditMode } from "@/lib/state-machine/agreement-edits";

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
    <div className="relative flex min-h-svh flex-1 flex-col overflow-hidden p-6 md:p-12">
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <AgreementEditor
          commission={commission}
          mode={agreementEditMode(commission.state)}
        />
      </div>
    </div>
  );
}
