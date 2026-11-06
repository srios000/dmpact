import "server-only";
import { createHash } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

export const DELIVERIES_BUCKET = "deliveries";
export const SIGNED_URL_TTL_SECONDS = 300;

export class StoredFileTooLargeError extends Error {
  constructor() {
    super("The stored file is larger than the upload limit.");
    this.name = "StoredFileTooLargeError";
  }
}

export type StoredFile = {
  sha256: string;
  sizeBytes: number;
  mimeType: string | null;
};

export type DeliveryStorage = {
  presignUpload(input: {
    key: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<string>;
  copy(fromKey: string, toKey: string): Promise<void>;
  inspect(key: string, maxBytes: number): Promise<StoredFile>;
  remove(key: string): Promise<void>;
  presignDownload(input: {
    key: string;
    filename: string;
    mimeType: string;
  }): Promise<string>;
};

export function uploadKey(commissionId: string, uploadId: string) {
  return `commissions/${commissionId}/uploads/${uploadId}`;
}

export function deliveryKey(commissionId: string, fileId: string) {
  return `commissions/${commissionId}/deliveries/${fileId}`;
}

export function attachmentDisposition(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function createClient(): S3Client | null {
  const {
    AWS_ENDPOINT_URL_S3: endpoint,
    AWS_REGION: region,
    AWS_ACCESS_KEY_ID: accessKeyId,
    AWS_SECRET_ACCESS_KEY: secretAccessKey,
  } = env;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey) return null;

  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

function s3Storage(s3: S3Client): DeliveryStorage {
  const Bucket = DELIVERIES_BUCKET;

  return {
    presignUpload: ({ key, mimeType, sizeBytes }) =>
      getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket,
          Key: key,
          ContentType: mimeType,
          ContentLength: sizeBytes,
        }),
        {
          expiresIn: SIGNED_URL_TTL_SECONDS,
          signableHeaders: new Set(["content-type", "content-length"]),
        },
      ),

    async copy(fromKey, toKey) {
      await s3.send(
        new CopyObjectCommand({
          Bucket,
          Key: toKey,
          CopySource: `${Bucket}/${fromKey}`,
        }),
      );
    },

    async inspect(key, maxBytes) {
      const object = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
      if ((object.ContentLength ?? 0) > maxBytes) {
        throw new StoredFileTooLargeError();
      }

      const hash = createHash("sha256");
      let sizeBytes = 0;
      for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
        sizeBytes += chunk.byteLength;
        if (sizeBytes > maxBytes) throw new StoredFileTooLargeError();
        hash.update(chunk);
      }

      return {
        sha256: hash.digest("hex"),
        sizeBytes,
        mimeType: object.ContentType ?? null,
      };
    },

    async remove(key) {
      await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },

    presignDownload: ({ key, filename, mimeType }) =>
      getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket,
          Key: key,
          ResponseContentDisposition: attachmentDisposition(filename),
          ResponseContentType: mimeType,
        }),
        { expiresIn: SIGNED_URL_TTL_SECONDS },
      ),
  };
}

let cached: DeliveryStorage | null | undefined;

export function getDeliveryStorage(): DeliveryStorage | null {
  if (cached === undefined) {
    const client = createClient();
    cached = client ? s3Storage(client) : null;
  }
  return cached;
}
