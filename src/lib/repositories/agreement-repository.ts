import "server-only";
import { db } from "@/lib/db";
import { withComputedAmounts } from "@/lib/money/agreement";
import { contentHash } from "@/lib/schema/content-hash";
import type { Agreement } from "@/lib/schema/agreement";
import {
  canClientConfirm,
  canClientRequestChanges,
  checkAgreementEdit,
} from "@/lib/state-machine/agreement-edits";
import { effectHandlers } from "@/lib/state-machine/effect-handlers";
import { applyTransition, runEffects } from "@/lib/state-machine/transition";
import { RepositoryError } from "./errors";
import {
  agreementInForce,
  isClientToken,
  isConfirmedBy,
  latestVersion,
  lockCommission,
  notFound,
  paymentsOf,
  readAgreement,
  requireCreator,
  toJson,
  utcToday,
  type Tx,
} from "./shared";

export async function saveAgreementVersion(input: {
  commissionId: string;
  agreement: Agreement;
  followUpDm?: string;
}) {
  const creator = await requireCreator();
  const { commissionId } = input;

  return db.$transaction(async (tx) => {
    await lockCommission(tx, commissionId);
    const commission = await tx.commission.findFirst({
      where: { id: commissionId, creatorId: creator.id },
      select: { state: true },
    });
    if (!commission) throw notFound();

    const latest = await latestVersion(tx, commissionId);
    const check = checkAgreementEdit({
      state: commission.state,
      current: readAgreement(latest.content),
      next: withComputedAmounts(input.agreement),
      today: utcToday(),
    });
    if (!check.ok) throw new RepositoryError(check.code, check.message);

    const hash = contentHash(check.agreement);
    const saved =
      hash === latest.contentHash
        ? latest
        : await tx.agreementVersion.create({
            data: {
              commissionId,
              version: latest.version + 1,
              content: toJson(check.agreement),
              contentHash: hash,
              createdBy: "creator",
            },
          });

    if (saved !== latest) {
      if (check.creatorConfirms) {
        await tx.confirmation.create({
          data: {
            commissionId,
            agreementVersionId: saved.id,
            party: "creator",
            contentHash: hash,
          },
        });
      }
      await tx.commissionEvent.create({
        data: {
          commissionId,
          type: "version_saved",
          actor: "creator",
          meta: { version: saved.version, contentHash: hash },
        },
      });
    }

    if (input.followUpDm) {
      await tx.followUpDm.create({
        data: {
          commissionId,
          agreementVersionId: saved.id,
          message: input.followUpDm,
        },
      });
    }

    return { version: saved.version, contentHash: hash };
  });
}

async function commissionForToken(tx: Tx, token: string) {
  if (!isClientToken(token)) throw notFound();
  const found = await tx.commission.findUnique({
    where: { clientToken: token },
    select: { id: true },
  });
  if (!found) throw notFound();

  await lockCommission(tx, found.id);
  const commission = await tx.commission.findUniqueOrThrow({
    where: { id: found.id },
    select: { id: true, state: true },
  });
  return commission;
}

export async function clientLinkExists(token: string): Promise<boolean> {
  if (!isClientToken(token)) return false;
  const found = await db.commission.findUnique({
    where: { clientToken: token },
    select: { id: true },
  });
  return !!found;
}

export async function getClientAgreement(token: string) {
  if (!isClientToken(token)) return null;
  const commission = await db.commission.findUnique({
    where: { clientToken: token },
    include: {
      creator: { select: { displayName: true } },
      deliveries: { orderBy: { loggedAt: "asc" } },
      invoices: true,
      agreementVersions: {
        orderBy: { version: "desc" },
        include: { confirmations: true },
      },
    },
  });
  if (!commission) return null;

  const versions = commission.agreementVersions;
  const latest = versions[0];
  const inForce = agreementInForce(versions);
  const content = readAgreement(latest.content);
  const agreement = {
    service_type: content.service_type,
    service_other: content.service_other,
    title: content.title,
    deliverables: content.deliverables,
    price: content.price,
    deposit: content.deposit,
    balance_amount: content.balance_amount,
    deadline: content.deadline,
    revisions: content.revisions,
    usage_rights: content.usage_rights,
    parties: content.parties,
  };
  const clientConfirmed = isConfirmedBy(latest, "client");

  return {
    commissionId: commission.id,
    state: commission.state,
    updatedAt: commission.updatedAt.toISOString(),
    creatorName: commission.creator.displayName,
    version: latest.version,
    versionHash: latest.contentHash,
    agreement,
    clientConfirmed,
    awaitingClient: !clientConfirmed && canClientConfirm(commission.state),
    ...paymentsOf((inForce ?? latest).content, commission.invoices),
    deadlineInForce:
      inForce && inForce.version !== latest.version
        ? readAgreement(inForce.content).deadline
        : null,
    finalFiles:
      commission.state === "fully_paid"
        ? commission.deliveries
            .filter((delivery) => delivery.isFinal)
            .map((delivery) => ({
              id: delivery.id,
              filename: delivery.filename,
              sizeBytes: delivery.sizeBytes,
            }))
        : [],
  };
}

export async function confirmAgreement(input: {
  token: string;
  versionHash: string;
}) {
  const { commissionId, state, steps } = await db.$transaction(async (tx) => {
    const commission = await commissionForToken(tx, input.token);
    const latest = await latestVersion(tx, commission.id);
    if (latest.contentHash !== input.versionHash) {
      throw new RepositoryError(
        "stale_version",
        "The agreement changed. Review the latest version.",
      );
    }

    if (!canClientConfirm(commission.state)) {
      if (isConfirmedBy(latest, "client")) {
        return {
          commissionId: commission.id,
          state: commission.state,
          steps: [],
        };
      }
      throw new RepositoryError(
        "edit_not_allowed",
        `The agreement can't be confirmed once the commission is ${commission.state}.`,
      );
    }

    if (!isConfirmedBy(latest, "client")) {
      await tx.confirmation.create({
        data: {
          commissionId: commission.id,
          agreementVersionId: latest.id,
          party: "client",
          contentHash: latest.contentHash,
        },
      });
      await tx.commissionEvent.create({
        data: {
          commissionId: commission.id,
          type: "client_confirmed",
          actor: "client",
          meta: { version: latest.version, contentHash: latest.contentHash },
        },
      });
    }

    const steps =
      commission.state === "negotiating"
        ? await applyTransition(tx, {
            commissionId: commission.id,
            to: "agreed",
            actor: "client",
          })
        : [];

    return {
      commissionId: commission.id,
      state: steps.at(-1)?.to ?? commission.state,
      steps,
    };
  });

  const { failedEffects } = steps.length
    ? await runEffects(db, commissionId, steps, effectHandlers)
    : { failedEffects: [] };

  return { commissionId, state, failedEffects };
}

export async function requestChanges(input: {
  token: string;
  message: string;
}) {
  return db.$transaction(async (tx) => {
    const commission = await commissionForToken(tx, input.token);
    const latest = await latestVersion(tx, commission.id);

    if (
      !canClientRequestChanges(
        commission.state,
        !isConfirmedBy(latest, "client"),
      )
    ) {
      throw new RepositoryError(
        "edit_not_allowed",
        `Changes can't be requested once the commission is ${commission.state}.`,
      );
    }

    const request = await tx.changeRequest.create({
      data: {
        commissionId: commission.id,
        version: latest.version,
        message: input.message,
      },
    });
    await tx.commissionEvent.create({
      data: {
        commissionId: commission.id,
        type: "change_requested",
        actor: "client",
        meta: { version: latest.version, changeRequestId: request.id },
      },
    });

    return { commissionId: commission.id, version: latest.version };
  });
}
