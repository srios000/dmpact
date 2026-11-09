import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { isDeliveryMimeType, MAX_DELIVERY_BYTES } from "@/lib/schema/delivery";
import { effectHandlers } from "@/lib/state-machine/effect-handlers";
import type { CommissionState, Effect } from "@/lib/state-machine/rules";
import {
  applyTransition,
  runEffects,
  type Step,
} from "@/lib/state-machine/transition";
import {
  deliveryKey,
  getDeliveryStorage,
  SIGNED_URL_TTL_SECONDS,
  StoredFileTooLargeError,
  uploadKey,
  type DeliveryStorage,
  type StoredFile,
} from "@/lib/storage/deliveries";
import { RepositoryError } from "./errors";
import {
  isClientToken,
  lockCommission,
  notFound,
  requireCreator,
} from "./shared";

export const UPLOAD_STATES: readonly CommissionState[] = [
  "in_progress",
  "delivered",
  "fully_paid",
];

function storage(): DeliveryStorage {
  const files = getDeliveryStorage();
  if (!files) {
    throw new RepositoryError(
      "storage_unavailable",
      "File storage isn't configured.",
    );
  }
  return files;
}

function assertCanUpload(state: CommissionState) {
  if (!UPLOAD_STATES.includes(state)) {
    throw new RepositoryError(
      "upload_not_allowed",
      "Start work on the commission before uploading a delivery.",
    );
  }
}

function expiresAt() {
  return new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
}

function isMissingObject(error: unknown) {
  if (!(error instanceof Error)) return false;
  const status = (error as { $metadata?: { httpStatusCode?: number } })
    .$metadata?.httpStatusCode;
  return (
    error.name === "NoSuchKey" || error.name === "NotFound" || status === 404
  );
}

async function ownedState(commissionId: string) {
  const creator = await requireCreator();
  const commission = await db.commission.findFirst({
    where: { id: commissionId, creatorId: creator.id },
    select: { state: true },
  });
  if (!commission) throw notFound();
  return commission.state;
}

async function inspectStored(
  files: DeliveryStorage,
  key: string,
): Promise<StoredFile & { mimeType: string }> {
  let stored: StoredFile;
  try {
    stored = await files.inspect(key, MAX_DELIVERY_BYTES);
  } catch (error) {
    if (error instanceof StoredFileTooLargeError) {
      throw new RepositoryError(
        "invalid_upload",
        "Files can be at most 25 MB.",
      );
    }
    throw error;
  }

  if (stored.sizeBytes === 0) {
    throw new RepositoryError("invalid_upload", "The uploaded file is empty.");
  }
  if (!isDeliveryMimeType(stored.mimeType)) {
    throw new RepositoryError(
      "invalid_upload",
      "This file type isn't allowed. Zip it and upload the .zip instead.",
    );
  }
  return { ...stored, mimeType: stored.mimeType };
}

export async function createDeliveryUpload(input: {
  commissionId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}) {
  assertCanUpload(await ownedState(input.commissionId));

  const uploadId: string = randomUUID();
  const url = await storage().presignUpload({
    key: uploadKey(input.commissionId, uploadId),
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  return {
    uploadId,
    url,
    method: "PUT" as const,
    headers: { "Content-Type": input.mimeType },
    expiresAt: expiresAt(),
  };
}

export async function recordDelivery(input: {
  commissionId: string;
  uploadId: string;
  filename: string;
  isFinal: boolean;
}) {
  const { commissionId } = input;
  assertCanUpload(await ownedState(commissionId));

  const files = storage();
  const source = uploadKey(commissionId, input.uploadId);
  const key = deliveryKey(commissionId, randomUUID());

  try {
    await files.copy(source, key);
  } catch (error) {
    if (isMissingObject(error)) {
      throw new RepositoryError(
        "invalid_upload",
        "The upload wasn't found. Upload the file again.",
      );
    }
    throw error;
  }

  let recorded: {
    delivery: Awaited<ReturnType<typeof db.delivery.create>>;
    state: CommissionState;
    steps: Step[];
  };
  try {
    const stored = await inspectStored(files, key);
    recorded = await db.$transaction(async (tx) => {
      await lockCommission(tx, commissionId);
      const { state } = await tx.commission.findUniqueOrThrow({
        where: { id: commissionId },
        select: { state: true },
      });
      assertCanUpload(state);

      const delivery = await tx.delivery.create({
        data: {
          commissionId,
          filename: input.filename,
          sha256: stored.sha256,
          sizeBytes: stored.sizeBytes,
          mimeType: stored.mimeType,
          storageKey: key,
          isFinal: input.isFinal,
        },
      });
      // One event per upload (revisions included) so the timeline and the
      // evidence pack show when each file was logged and its fingerprint.
      await tx.commissionEvent.create({
        data: {
          commissionId,
          type: "delivery_logged",
          actor: "creator",
          reason: `${delivery.isFinal ? "Final file" : "Preview"}: ${delivery.filename}`,
          at: delivery.loggedAt,
          meta: {
            deliveryId: delivery.id,
            filename: delivery.filename,
            sha256: delivery.sha256,
            sizeBytes: delivery.sizeBytes,
            mimeType: delivery.mimeType,
            isFinal: delivery.isFinal,
          },
        },
      });

      const steps =
        state === "in_progress"
          ? await applyTransition(tx, {
              commissionId,
              to: "delivered",
              actor: "creator",
            })
          : [];
      return {
        delivery,
        state: steps.length ? steps[steps.length - 1].to : state,
        steps,
      };
    });
  } catch (error) {
    const kept = await db.delivery.count({ where: { storageKey: key } });
    if (kept === 0) await files.remove(key).catch(() => undefined);
    throw error;
  }

  await files.remove(source).catch(() => undefined);

  let failedEffects: Effect[] = [];
  if (recorded.steps.length) {
    ({ failedEffects } = await runEffects(
      db,
      commissionId,
      recorded.steps,
      effectHandlers,
    ));
  }

  const { delivery } = recorded;
  return {
    delivery: {
      id: delivery.id,
      filename: delivery.filename,
      sha256: delivery.sha256,
      sizeBytes: delivery.sizeBytes,
      mimeType: delivery.mimeType,
      isFinal: delivery.isFinal,
      loggedAt: delivery.loggedAt.toISOString(),
    },
    state: recorded.state,
    failedEffects,
  };
}

export async function requestDeliveryDownload(input: {
  token: string;
  deliveryId: string;
  userAgent: string | null;
}) {
  const missing = new RepositoryError("not_found", "File not found.");
  if (!isClientToken(input.token)) throw missing;

  const commission = await db.commission.findUnique({
    where: { clientToken: input.token },
    select: { id: true, state: true },
  });
  if (!commission) throw missing;

  const delivery = await db.delivery.findFirst({
    where: {
      id: input.deliveryId,
      commissionId: commission.id,
      storageKey: { not: null },
    },
  });
  if (!delivery?.storageKey) throw missing;

  if (
    commission.state === "cancelled" ||
    (delivery.isFinal && commission.state !== "fully_paid")
  ) {
    throw new RepositoryError(
      "download_not_allowed",
      "The final file unlocks once the balance is paid.",
    );
  }

  const url = await storage().presignDownload({
    key: delivery.storageKey,
    filename: delivery.filename,
    mimeType: delivery.mimeType,
  });

  await db.deliveryDownload.create({
    data: {
      deliveryId: delivery.id,
      commissionId: commission.id,
      userAgent: input.userAgent?.slice(0, 500) || null,
    },
  });

  return {
    commissionId: commission.id,
    url,
    filename: delivery.filename,
    expiresAt: expiresAt(),
  };
}
