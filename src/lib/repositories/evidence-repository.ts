import "server-only";
import { db } from "@/lib/db";
import type { EvidencePack } from "@/lib/evidence/evidence-pdf";
import { currencyExponent } from "@/lib/money/decimal";
import {
  agreementInForce,
  isConfirmedBy,
  notFound,
  readAgreement,
  requireCreator,
} from "./shared";

/**
 * Collects everything for the evidence pack (FR-7.3) of a commission the
 * signed-in creator owns. Upload evidence (deliveries) and receipt evidence
 * (client downloads) are kept separate (FR-8A.8).
 */
export async function getEvidencePack(
  commissionId: string,
  now: Date = new Date(),
): Promise<EvidencePack> {
  const creator = await requireCreator();
  const commission = await db.commission.findFirst({
    where: { id: commissionId, creatorId: creator.id },
    include: {
      creator: { select: { displayName: true } },
      agreementVersions: {
        orderBy: { version: "desc" },
        include: { confirmations: true },
      },
      invoices: { orderBy: { createdAt: "asc" } },
      deliveries: { orderBy: { loggedAt: "asc" } },
      deliveryDownloads: {
        orderBy: { requestedAt: "asc" },
        include: { delivery: { select: { filename: true, sha256: true } } },
      },
      events: { orderBy: { at: "asc" } },
      followUpDms: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!commission) throw notFound();

  const versions = commission.agreementVersions;
  const inForce = agreementInForce(versions);
  const shown = inForce ?? versions[0] ?? null;

  return {
    generatedAt: now.toISOString(),
    commission: {
      id: commission.id,
      state: commission.state,
      createdAt: commission.createdAt.toISOString(),
      creatorName: commission.creator.displayName,
      clientToken: commission.clientToken,
    },
    agreement: shown
      ? {
          version: shown.version,
          contentHash: shown.contentHash,
          confirmedByBoth:
            isConfirmedBy(shown, "creator") && isConfirmedBy(shown, "client"),
          content: readAgreement(shown.content),
        }
      : null,
    confirmations: versions
      .flatMap((version) =>
        version.confirmations.map((confirmation) => ({
          party: confirmation.party,
          version: version.version,
          contentHash: confirmation.contentHash,
          confirmedAt: confirmation.confirmedAt.toISOString(),
        })),
      )
      .sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt)),
    invoices: commission.invoices.map((invoice) => ({
      kind: invoice.kind,
      status: invoice.status,
      paypalInvoiceId: invoice.paypalInvoiceId,
      amount: invoice.amount.toFixed(currencyExponent(invoice.currency)),
      currency: invoice.currency,
      dueDate: invoice.dueDate?.toISOString().slice(0, 10) ?? null,
      createdAt: invoice.createdAt.toISOString(),
      paidAt: invoice.paidAt?.toISOString() ?? null,
    })),
    deliveries: commission.deliveries.map((delivery) => ({
      filename: delivery.filename,
      sha256: delivery.sha256,
      sizeBytes: delivery.sizeBytes,
      mimeType: delivery.mimeType,
      isFinal: delivery.isFinal,
      loggedAt: delivery.loggedAt.toISOString(),
    })),
    downloads: commission.deliveryDownloads.map((download) => ({
      filename: download.delivery.filename,
      sha256: download.delivery.sha256,
      requestedAt: download.requestedAt.toISOString(),
      userAgent: download.userAgent,
    })),
    events: commission.events.map((event) => ({
      at: event.at.toISOString(),
      type: event.type,
      actor: event.actor,
      fromState: event.fromState,
      toState: event.toState,
      reason: event.reason,
    })),
    sourceDm: commission.sourceDm,
    followUpDms: commission.followUpDms.map((dm) => ({
      message: dm.message,
      createdAt: dm.createdAt.toISOString(),
    })),
  };
}
