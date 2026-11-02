import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { withComputedAmounts } from "@/lib/money/agreement";
import { currencyExponent } from "@/lib/money/decimal";
import { contentHash } from "@/lib/schema/content-hash";
import type { Agreement } from "@/lib/schema/agreement";
import { readAgreementFacts } from "@/lib/state-machine/agreement-facts";
import { effectHandlers } from "@/lib/state-machine/effect-handlers";
import type { CommissionState } from "@/lib/state-machine/rules";
import {
  applyTransition,
  runEffects,
  transition,
} from "@/lib/state-machine/transition";
import { getCurrentCreator } from "@/lib/auth/get-current-creator";
import { RepositoryError } from "./errors";
import {
  agreementInForce,
  isConfirmedBy,
  latestVersion,
  lockCommission,
  notFound,
  readAgreement,
  requireCreator,
  toJson,
} from "./shared";

type InvoiceRow = {
  kind: "deposit" | "balance";
  status: "draft" | "sent" | "paid" | "cancelled";
  payLink: string | null;
  paidAt: Date | null;
  createdAt: Date;
};

export type PaymentStatus = {
  status: "not_required" | "not_created" | InvoiceRow["status"];
  payLink: string | null;
  paidAt: string | null;
};

function paymentStatus(
  invoices: InvoiceRow[],
  kind: InvoiceRow["kind"],
  required: boolean,
): PaymentStatus {
  const invoice = invoices
    .filter((i) => i.kind === kind)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!invoice) {
    return {
      status: required ? "not_created" : "not_required",
      payLink: null,
      paidAt: null,
    };
  }
  return {
    status: invoice.status,
    payLink: invoice.payLink,
    paidAt: invoice.paidAt?.toISOString() ?? null,
  };
}

function paymentsOf(content: unknown, invoices: InvoiceRow[]) {
  const facts = readAgreementFacts(content);
  return {
    deposit: paymentStatus(invoices, "deposit", facts.depositType !== "none"),
    balance: paymentStatus(invoices, "balance", !facts.balanceIsZero),
  };
}

function summarize(agreement: Agreement) {
  return {
    title: agreement.title,
    serviceType: agreement.service_type,
    clientName:
      agreement.parties?.client?.display_name ??
      agreement.parties?.client?.handle ??
      null,
    total: agreement.price.total,
    currency: agreement.price.currency,
    depositAmount: agreement.deposit.amount ?? null,
    balanceAmount: agreement.balance_amount ?? null,
    deadline: agreement.deadline.date,
  };
}

export async function createCommission(input: {
  sourceDm: string;
  agreement: Agreement;
}) {
  const creator = await requireCreator();
  const agreement = withComputedAmounts(input.agreement);
  const hash = contentHash(agreement);

  const commission = await db.commission.create({
    data: {
      creatorId: creator.id,
      sourceDm: input.sourceDm,
      agreementVersions: {
        create: {
          version: 1,
          content: toJson(agreement),
          contentHash: hash,
          createdBy: "creator",
        },
      },
      events: {
        create: { type: "created", toState: "draft", actor: "creator" },
      },
    },
  });

  return { id: commission.id, version: 1, contentHash: hash };
}

export async function listCommissions() {
  const creator = await requireCreator();
  const commissions = await db.commission.findMany({
    where: { creatorId: creator.id },
    orderBy: { createdAt: "desc" },
    include: {
      agreementVersions: { include: { confirmations: true } },
      invoices: true,
    },
  });

  return commissions.map((commission) => {
    const latest = commission.agreementVersions.reduce((a, b) =>
      b.version > a.version ? b : a,
    );
    const inForce = agreementInForce(commission.agreementVersions) ?? latest;
    return {
      id: commission.id,
      state: commission.state,
      createdAt: commission.createdAt.toISOString(),
      updatedAt: commission.updatedAt.toISOString(),
      awaitingClient: latest.version !== inForce.version,
      ...summarize(readAgreement(inForce.content)),
      ...paymentsOf(inForce.content, commission.invoices),
    };
  });
}

export async function getCommission(id: string) {
  const creator = await requireCreator();
  const commission = await db.commission.findFirst({
    where: { id, creatorId: creator.id },
    include: {
      agreementVersions: {
        orderBy: { version: "asc" },
        include: { confirmations: true },
      },
      followUpDms: { orderBy: { createdAt: "asc" } },
      changeRequests: { orderBy: { createdAt: "asc" } },
      invoices: { orderBy: { createdAt: "asc" } },
      deliveries: { orderBy: { loggedAt: "asc" } },
      events: { orderBy: { at: "asc" } },
    },
  });
  if (!commission) return null;

  const versions = commission.agreementVersions;
  const inForce = agreementInForce(versions);
  const latest = versions[versions.length - 1];

  return {
    id: commission.id,
    state: commission.state,
    sourceDm: commission.sourceDm,
    clientToken: commission.clientToken,
    createdAt: commission.createdAt.toISOString(),
    updatedAt: commission.updatedAt.toISOString(),
    inForceVersion: inForce?.version ?? null,
    awaitingClient: !!inForce && inForce.version !== latest.version,
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      agreement: readAgreement(v.content),
      contentHash: v.contentHash,
      createdBy: v.createdBy,
      createdAt: v.createdAt.toISOString(),
      confirmations: v.confirmations.map((c) => ({
        party: c.party,
        contentHash: c.contentHash,
        confirmedAt: c.confirmedAt.toISOString(),
      })),
    })),
    followUpDms: commission.followUpDms.map((f) => ({
      id: f.id,
      agreementVersionId: f.agreementVersionId,
      message: f.message,
      createdAt: f.createdAt.toISOString(),
    })),
    changeRequests: commission.changeRequests.map((r) => ({
      id: r.id,
      version: r.version,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    })),
    invoices: commission.invoices.map((i) => ({
      id: i.id,
      kind: i.kind,
      status: i.status,
      paypalInvoiceId: i.paypalInvoiceId,
      amount: i.amount.toFixed(currencyExponent(i.currency)),
      currency: i.currency,
      dueDate: i.dueDate?.toISOString().slice(0, 10) ?? null,
      payLink: i.payLink,
      paidAt: i.paidAt?.toISOString() ?? null,
      lastRemindedAt: i.lastRemindedAt?.toISOString() ?? null,
    })),
    deliveries: commission.deliveries.map((d) => ({
      id: d.id,
      filename: d.filename,
      sha256: d.sha256,
      sizeBytes: d.sizeBytes,
      mimeType: d.mimeType,
      isFinal: d.isFinal,
      loggedAt: d.loggedAt.toISOString(),
    })),
    events: commission.events.map((e) => ({
      id: e.id,
      type: e.type,
      fromState: e.fromState,
      toState: e.toState,
      actor: e.actor,
      reason: e.reason,
      at: e.at.toISOString(),
    })),
  };
}

export async function sendToClient(input: {
  commissionId: string;
  versionHash: string;
}) {
  const creator = await requireCreator();
  const { commissionId } = input;

  const { steps, token } = await db.$transaction(async (tx) => {
    await lockCommission(tx, commissionId);
    const commission = await tx.commission.findFirst({
      where: { id: commissionId, creatorId: creator.id },
    });
    if (!commission) throw notFound();

    const latest = await latestVersion(tx, commissionId);
    if (latest.contentHash !== input.versionHash) {
      throw new RepositoryError(
        "stale_version",
        "A newer version exists. Review it before sending.",
      );
    }

    if (!isConfirmedBy(latest, "creator")) {
      await tx.confirmation.create({
        data: {
          commissionId,
          agreementVersionId: latest.id,
          party: "creator",
          contentHash: latest.contentHash,
        },
      });
    }

    const token =
      commission.clientToken ?? randomBytes(16).toString("base64url");
    await tx.commission.update({
      where: { id: commissionId },
      data: { clientToken: token },
    });

    return {
      token,
      steps: await applyTransition(tx, {
        commissionId,
        to: "negotiating",
        actor: "creator",
      }),
    };
  });

  await runEffects(db, commissionId, steps, effectHandlers);
  return { token };
}

export async function transitionCommission(input: {
  commissionId: string;
  to: CommissionState;
  reason?: string;
}) {
  const creator = await requireCreator();
  const owned = await db.commission.findFirst({
    where: { id: input.commissionId, creatorId: creator.id },
    select: { id: true },
  });
  if (!owned) throw notFound();

  return transition(db, { ...input, actor: "creator" }, effectHandlers);
}

export async function getCommissionStatus(
  id: string,
  clientToken: string | null,
) {
  const creator = clientToken ? null : await getCurrentCreator();
  const where = clientToken
    ? { id, clientToken }
    : creator
      ? { id, creatorId: creator.id }
      : null;
  if (!where) return null;

  const commission = await db.commission.findFirst({
    where,
    include: {
      agreementVersions: {
        orderBy: { version: "desc" },
        include: { confirmations: true },
      },
      invoices: true,
    },
  });
  if (!commission) return null;

  const versions = commission.agreementVersions;
  const inForce = agreementInForce(versions) ?? versions[0];

  return {
    state: commission.state,
    updatedAt: commission.updatedAt.toISOString(),
    awaitingClient: inForce.version !== versions[0].version,
    ...paymentsOf(inForce.content, commission.invoices),
  };
}
