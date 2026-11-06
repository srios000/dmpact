/**
 * Runs against the real Neon Object Storage bucket of the branch in .env.local.
 * Skipped unless STORAGE_TEST=1, so it never runs in CI.
 *
 *   STORAGE_TEST=1 pnpm vitest run src/lib/storage/deliveries.storage.test.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DeliveryStorage } from "./deliveries";

vi.mock("server-only", () => ({}));

const run = process.env.STORAGE_TEST === "1";
if (run && existsSync(".env.local")) process.loadEnvFile(".env.local");

describe.skipIf(!run)("delivery storage (Neon Object Storage)", () => {
  const commissionId = randomUUID();
  const uploadId = randomUUID();
  const body = Buffer.from(`delivery ${uploadId}`);
  let files: DeliveryStorage;
  let uploadKey: (commissionId: string, uploadId: string) => string;
  let source: string;
  let target: string;

  beforeAll(async () => {
    const storage = await import("./deliveries");
    files = storage.getDeliveryStorage()!;
    uploadKey = storage.uploadKey;
    source = storage.uploadKey(commissionId, uploadId);
    target = storage.deliveryKey(commissionId, randomUUID());
  });

  afterAll(async () => {
    await files.remove(source);
    await files.remove(target);
  });

  async function put(url: string, data: Buffer, type: string) {
    const response = await fetch(url, {
      method: "PUT",
      body: new Blob([new Uint8Array(data)]),
      headers: { "Content-Type": type },
    });
    return response.status;
  }

  it("takes the upload straight from the browser and enforces the signed size and type", async () => {
    const url = await files.presignUpload({
      key: source,
      mimeType: "image/png",
      sizeBytes: body.length,
    });

    expect(await put(url, Buffer.concat([body, body]), "image/png")).toBe(403);
    expect(await put(url, body, "text/html")).toBe(403);
    expect(await put(url, body, "image/png")).toBe(200);
  });

  it("copies, hashes and serves the stored file", async () => {
    await files.copy(source, target);
    await expect(files.inspect(target, 1024)).resolves.toEqual({
      sha256: createHash("sha256").update(body).digest("hex"),
      sizeBytes: body.length,
      mimeType: "image/png",
    });

    const response = await fetch(
      await files.presignDownload({
        key: target,
        filename: "final art.png",
        mimeType: "image/png",
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      `filename*=UTF-8''final%20art.png`,
    );
    expect(Buffer.from(await response.arrayBuffer()).equals(body)).toBe(true);
  });

  it("reports a missing upload as not found", async () => {
    const error = await files
      .copy(uploadKey(commissionId, randomUUID()), target)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ $metadata: { httpStatusCode: 404 } });
  });

  it("refuses to hash past the size limit", async () => {
    await expect(files.inspect(target, body.length - 1)).rejects.toThrow(
      /larger than the upload limit/,
    );
  });
});
