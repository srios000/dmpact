import { z } from "zod";
import { clientTokenSchema, commissionIdSchema } from "./commission-forms";

export const MAX_DELIVERY_BYTES = 25 * 1024 * 1024;
export const MAX_FILENAME_CHARS = 255;

export const DELIVERY_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/vnd.adobe.photoshop",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mpeg",
  "audio/flac",
  "audio/x-flac",
  "audio/mp4",
  "audio/x-m4a",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export type DeliveryMimeType = (typeof DELIVERY_MIME_TYPES)[number];

export function isDeliveryMimeType(value: unknown): value is DeliveryMimeType {
  return (DELIVERY_MIME_TYPES as readonly unknown[]).includes(value);
}

const filenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_FILENAME_CHARS)
  .refine((name) => !/[\\/\p{Cc}]/u.test(name), "Filename has invalid characters");

export const createDeliveryUploadSchema = z.strictObject({
  commissionId: commissionIdSchema,
  filename: filenameSchema,
  mimeType: z.enum(DELIVERY_MIME_TYPES, {
    error: "This file type isn't allowed. Zip it and upload the .zip instead.",
  }),
  sizeBytes: z
    .number()
    .int()
    .min(1, "The file is empty.")
    .max(MAX_DELIVERY_BYTES, "Files can be at most 25 MB."),
});

export const recordDeliverySchema = z.strictObject({
  commissionId: commissionIdSchema,
  uploadId: z.uuid(),
  filename: filenameSchema,
  isFinal: z.boolean(),
});

export const deliveryDownloadSchema = z.strictObject({
  token: clientTokenSchema,
  deliveryId: z.uuid(),
});

export type CreateDeliveryUploadInput = Omit<
  z.input<typeof createDeliveryUploadSchema>,
  "mimeType"
> & { mimeType: string };
export type RecordDeliveryInput = z.input<typeof recordDeliverySchema>;
export type DeliveryDownloadInput = z.input<typeof deliveryDownloadSchema>;
