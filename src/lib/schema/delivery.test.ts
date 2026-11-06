import { describe, expect, it } from "vitest";
import {
  createDeliveryUploadSchema,
  deliveryDownloadSchema,
  MAX_DELIVERY_BYTES,
  recordDeliverySchema,
} from "./delivery";

const commissionId = "6f1c1b62-6a56-4f38-9a0a-1f6f1d1e2a10";
const upload = {
  commissionId,
  filename: "final-mix.wav",
  mimeType: "audio/wav",
  sizeBytes: 1024,
};

describe("createDeliveryUploadSchema", () => {
  it("accepts an allowed file up to 25 MB", () => {
    expect(createDeliveryUploadSchema.safeParse(upload).success).toBe(true);
    expect(
      createDeliveryUploadSchema.safeParse({
        ...upload,
        sizeBytes: MAX_DELIVERY_BYTES,
      }).success,
    ).toBe(true);
  });

  it("rejects files over 25 MB", () => {
    const result = createDeliveryUploadSchema.safeParse({
      ...upload,
      sizeBytes: MAX_DELIVERY_BYTES + 1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Files can be at most 25 MB.");
  });

  it("rejects empty files", () => {
    expect(
      createDeliveryUploadSchema.safeParse({ ...upload, sizeBytes: 0 }).success,
    ).toBe(false);
  });

  it.each(["application/x-msdownload", "text/html", "image/svg+xml", ""])(
    "rejects %j, which isn't on the allow-list",
    (mimeType) => {
      expect(
        createDeliveryUploadSchema.safeParse({ ...upload, mimeType }).success,
      ).toBe(false);
    },
  );

  it.each(["../secret.wav", "a/b.png", "bad\nname.png", "", "x".repeat(256)])(
    "rejects the filename %j",
    (filename) => {
      expect(
        createDeliveryUploadSchema.safeParse({ ...upload, filename }).success,
      ).toBe(false);
    },
  );

  it("keeps non-ASCII filenames", () => {
    const result = createDeliveryUploadSchema.safeParse({
      ...upload,
      filename: "ミックス 最終.wav",
    });
    expect(result.data?.filename).toBe("ミックス 最終.wav");
  });
});

describe("recordDeliverySchema", () => {
  it("needs an upload id and whether the file is final", () => {
    const uploadId = "0f8fad5b-d9cb-469f-a165-70867728950e";
    expect(
      recordDeliverySchema.safeParse({
        commissionId,
        uploadId,
        filename: "a.png",
        isFinal: true,
      }).success,
    ).toBe(true);
    expect(
      recordDeliverySchema.safeParse({
        commissionId,
        uploadId: "commissions/x/uploads/y",
        filename: "a.png",
        isFinal: true,
      }).success,
    ).toBe(false);
    expect(
      recordDeliverySchema.safeParse({ commissionId, uploadId, filename: "a" })
        .success,
    ).toBe(false);
  });
});

describe("deliveryDownloadSchema", () => {
  it("needs a client token and a delivery id", () => {
    const deliveryId = "0f8fad5b-d9cb-469f-a165-70867728950e";
    expect(
      deliveryDownloadSchema.safeParse({ token: "a".repeat(22), deliveryId })
        .success,
    ).toBe(true);
    expect(
      deliveryDownloadSchema.safeParse({ token: "short", deliveryId }).success,
    ).toBe(false);
  });
});
