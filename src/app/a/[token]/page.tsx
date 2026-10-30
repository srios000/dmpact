import { ClientAgreementPage } from "@/app/a/[token]/_components/client-agreement-page"

export default async function ClientAgreementRoute({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return <ClientAgreementPage token={token} />
}
