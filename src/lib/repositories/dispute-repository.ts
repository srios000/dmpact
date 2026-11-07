import "server-only";
import { db } from "@/lib/db";
import { renderEvidencePdf } from "@/lib/evidence/evidence-pdf";
import {
  canProvideEvidence,
  getPayPalClient,
  PayPalError,
  invoiceTransactionIds,
  type Dispute,
  type PayPalClient,
} from "@/lib/paypal";
import { RepositoryError } from "./errors";
import { getEvidencePack } from "./evidence-repository";
import { notFound, requireCreator } from "./shared";

/**
 * PayPal disputes on a commission's invoices (stretch #21, FR-7.4). Disputes
 * are matched through the transaction IDs of the invoice payments, then the
 * evidence pack PDF is uploaded with provide-evidence.
 */

export type CommissionDispute = {
  id: string;
  invoiceKind: "deposit" | "balance";
  transactionId: string;
  status: string;
  reason: string | null;
  stage: string | null;
  amount: { currency: string; value: string } | null;
  sellerResponseDueDate: string | null;
  canProvideEvidence: boolean;
};

export type DisputeOptions = { paypal?: PayPalClient; now?: Date };

/** Turns PayPal failures into a message the creator can act on. */
async function withPayPal<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new RepositoryError(
      "dispute_failed",
      error instanceof PayPalError
        ? `PayPal couldn't complete the request: ${message}`
        : `PayPal isn't available: ${message}`,
    );
  }
}

async function ownedCommission(commissionId: string) {
  const creator = await requireCreator();
  const commission = await db.commission.findFirst({
    where: { id: commissionId, creatorId: creator.id },
    select: {
      id: true,
      invoices: {
        where: { paypalInvoiceId: { not: null }, status: "paid" },
        orderBy: { createdAt: "asc" },
        select: { kind: true, paypalInvoiceId: true },
      },
    },
  });
  if (!commission) throw notFound();
  return commission;
}

/** Disputes opened on this commission's paid invoices. */
export async function listCommissionDisputes(
  commissionId: string,
  options: DisputeOptions = {},
): Promise<CommissionDispute[]> {
  const commission = await ownedCommission(commissionId);
  return withPayPal(() => findDisputes(commission, options));
}

async function findDisputes(
  commission: Awaited<ReturnType<typeof ownedCommission>>,
  options: DisputeOptions,
): Promise<CommissionDispute[]> {
  const paypal = options.paypal ?? getPayPalClient();
  const found = new Map<string, CommissionDispute>();
  for (const invoice of commission.invoices) {
    const remote = await paypal.getInvoice(invoice.paypalInvoiceId!);
    for (const transactionId of invoiceTransactionIds(remote)) {
      const summaries = await paypal.listDisputesForTransaction(transactionId);
      for (const summary of summaries) {
        if (found.has(summary.id)) continue;
        // The list is a summary; details confirm the transaction matches.
        const dispute: Dispute = await paypal.getDispute(summary.id);
        const matches =
          dispute.transactionIds.length === 0 ||
          dispute.transactionIds.includes(transactionId) ||
          (remote.invoiceNumber !== null &&
            dispute.invoiceNumbers.includes(remote.invoiceNumber));
        if (!matches) continue;
        found.set(dispute.id, {
          id: dispute.id,
          invoiceKind: invoice.kind,
          transactionId,
          status: dispute.status,
          reason: dispute.reason,
          stage: dispute.stage,
          amount: dispute.amount,
          sellerResponseDueDate: dispute.sellerResponseDueDate,
          canProvideEvidence: canProvideEvidence(dispute),
        });
      }
    }
  }
  return [...found.values()];
}

/**
 * Uploads the evidence pack PDF to one of this commission's disputes and logs
 * a `dispute_evidence_sent` event.
 */
export async function sendDisputeEvidence(
  commissionId: string,
  disputeId: string,
  options: DisputeOptions = {},
): Promise<CommissionDispute> {
  const disputes = await listCommissionDisputes(commissionId, options);
  const dispute = disputes.find((d) => d.id === disputeId);
  if (!dispute) throw notFound();
  if (!dispute.canProvideEvidence) {
    throw new RepositoryError(
      "retry_not_allowed",
      `PayPal isn't accepting evidence for this dispute right now (status: ${dispute.status}).`,
    );
  }

  const now = options.now ?? new Date();
  const pdf = await renderEvidencePdf(await getEvidencePack(commissionId, now));
  await withPayPal(() =>
    (options.paypal ?? getPayPalClient()).provideDisputeEvidence(disputeId, {
      pdf,
      filename: `dmpact-evidence-${commissionId.slice(-12)}.pdf`,
      notes:
        "Evidence pack from DMpact: the agreement both parties confirmed (with its SHA-256 hash), " +
        "confirmation times, PayPal invoices and payment times, the delivery log with file " +
        "fingerprints, client download records, and the full event timeline.",
    }),
  );

  await db.commissionEvent.create({
    data: {
      commissionId,
      type: "dispute_evidence_sent",
      actor: "creator",
      reason: `Evidence pack sent to PayPal dispute ${disputeId}.`,
      at: now,
      meta: {
        disputeId,
        invoiceKind: dispute.invoiceKind,
        transactionId: dispute.transactionId,
        status: dispute.status,
      },
    },
  });

  return { ...dispute, canProvideEvidence: false };
}
