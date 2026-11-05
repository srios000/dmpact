import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClientAgreement } from "@/lib/repositories/agreement-repository";

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
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col gap-2 rounded-[2.5rem] bg-sidebar p-8 text-sidebar-foreground shadow-xl">
        <h1 className="text-2xl font-semibold text-sidebar-accent-foreground">
          {view.agreement.title}
        </h1>
        <p>
          From {view.creatorName} · Version {view.version}
        </p>
      </div>
    </main>
  );
}
