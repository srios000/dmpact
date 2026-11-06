import { describe, expect, it, vi } from "vitest";
import {
  attachmentDisposition,
  deliveryKey,
  getDeliveryStorage,
  uploadKey,
} from "./deliveries";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    AWS_ENDPOINT_URL_S3: "https://br-test.storage.example.test",
    AWS_REGION: "ap-southeast-1",
    AWS_ACCESS_KEY_ID: "nak_test",
    AWS_SECRET_ACCESS_KEY: "nsk_test",
  },
}));

const commissionId = "6f1c1b62-6a56-4f38-9a0a-1f6f1d1e2a10";
const uploadId = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("delivery storage", () => {
  it("signs a direct-to-bucket PUT bound to the declared size and type", async () => {
    const storage = getDeliveryStorage();
    const url = new URL(
      await storage!.presignUpload({
        key: uploadKey(commissionId, uploadId),
        mimeType: "audio/wav",
        sizeBytes: 1234,
      }),
    );

    expect(url.origin).toBe("https://br-test.storage.example.test");
    expect(url.pathname).toBe(
      `/deliveries/commissions/${commissionId}/uploads/${uploadId}`,
    );
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(
      expect.arrayContaining(["content-length", "content-type", "host"]),
    );
    expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
    expect(url.searchParams.has("x-amz-sdk-checksum-algorithm")).toBe(false);
  });

  it("signs a download that saves under the original filename", async () => {
    const url = new URL(
      await getDeliveryStorage()!.presignDownload({
        key: deliveryKey(commissionId, uploadId),
        filename: "final mix.wav",
        mimeType: "audio/wav",
      }),
    );

    expect(url.pathname).toBe(
      `/deliveries/commissions/${commissionId}/deliveries/${uploadId}`,
    );
    expect(url.searchParams.get("response-content-disposition")).toBe(
      `attachment; filename="final mix.wav"; filename*=UTF-8''final%20mix.wav`,
    );
    expect(url.searchParams.get("response-content-type")).toBe("audio/wav");
  });

  it("keeps uploads and delivered files under separate prefixes", () => {
    expect(uploadKey(commissionId, uploadId)).not.toBe(
      deliveryKey(commissionId, uploadId),
    );
  });
});

describe("attachmentDisposition", () => {
  it("gives an ASCII fallback and the UTF-8 name", () => {
    expect(attachmentDisposition('ミックス "v2".wav')).toBe(
      `attachment; filename="____ _v2_.wav"; filename*=UTF-8''%E3%83%9F%E3%83%83%E3%82%AF%E3%82%B9%20%22v2%22.wav`,
    );
  });
});
