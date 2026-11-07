import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClientAgreement } from "@/lib/repositories/agreement-repository";
import { ClientAgreement } from "./_components/client-agreement";

export const instant = false;

export const metadata: Metadata = {
  title: "Your agreement | DMpact",
  robots: { index: false, follow: false },
};

export default async function ClientAgreementPage({
  params,
}: PageProps<"/a/[token]">) {
  const { token } = await params;
  const view = await getClientAgreement(token);
  if (!view) notFound();

  return (
    <ClientAgreement
      key={`${view.version}-${view.state}-${view.deposit.status}-${view.balance.status}`}
      token={token}
      view={view}
    />
  );
}
