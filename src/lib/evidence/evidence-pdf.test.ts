import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import {
  formatStamp,
  renderEvidencePdf,
  type EvidencePack,
} from "./evidence-pdf";

const hash = "9f2c1e7a4b8d3f6051e2a9c7d4b1f08e3a6c5d2e1f0a9b8c7d6e5f4a3b2c1d0e";

function pack(overrides: Partial<EvidencePack> = {}): EvidencePack {
  return {
    generatedAt: "2026-11-20T09:15:00Z",
    commission: {
      id: "019a5c3e-7b4d-7e2a-9c1f-3d2b1a0f9e8c",
      state: "fully_paid",
      createdAt: "2026-11-02T03:00:00Z",
      creatorName: "Mira Sound",
      clientToken: "token",
    },
    agreement: {
      version: 2,
      contentHash: hash,
      confirmedByBoth: true,
      content: exampleAgreement,
    },
    confirmations: [
      {
        party: "client",
        version: 2,
        contentHash: hash,
        confirmedAt: "2026-11-03T05:42:00Z",
      },
    ],
    invoices: [
      {
        kind: "deposit",
        status: "paid",
        paypalInvoiceId: "INV2-7XQK-AB3D-9L2M-PQ8R",
        amount: "75.00",
        currency: "USD",
        dueDate: "2026-11-06",
        createdAt: "2026-11-03T05:42:05Z",
        paidAt: "2026-11-03T06:01:00Z",
      },
    ],
    deliveries: [
      {
        filename: "final.zip",
        sha256: hash,
        sizeBytes: 18_400_000,
        mimeType: "application/zip",
        isFinal: true,
        loggedAt: "2026-11-18T10:00:00Z",
      },
    ],
    downloads: [
      {
        filename: "final.zip",
        sha256: hash,
        requestedAt: "2026-11-19T01:35:00Z",
        userAgent: "Chrome",
      },
    ],
    events: [
      {
        at: "2026-11-03T05:42:00Z",
        type: "transition",
        actor: "client",
        fromState: "negotiating",
        toState: "agreed",
        reason: null,
      },
    ],
    sourceDm: "can u mix + master my song? budget 150 USD",
    followUpDms: [],
    ...overrides,
  };
}

describe("renderEvidencePdf", () => {
  it("produces a valid PDF with metadata", async () => {
    const bytes = await renderEvidencePdf(pack());
    const doc = await PDFDocument.load(bytes);

    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toBe(
      "Evidence pack - Original song mix & master — 'Starfall'",
    );
    expect(doc.getSubject()).toBe(
      "Commission 019a5c3e-7b4d-7e2a-9c1f-3d2b1a0f9e8c",
    );
  });

  it("doesn't fail on emoji or non-Latin text", async () => {
    const bytes = await renderEvidencePdf(
      pack({
        sourceDm: "debut soon 🌟 日本語のメッセージ\r\n\tthanks!",
        followUpDms: [{ message: "🙏", createdAt: "2026-11-02T04:00:00Z" }],
      }),
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
  });

  it("handles an empty commission", async () => {
    const bytes = await renderEvidencePdf(
      pack({
        agreement: null,
        confirmations: [],
        invoices: [],
        deliveries: [],
        downloads: [],
        events: [],
        sourceDm: "",
      }),
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("adds pages for long histories", async () => {
    const events = Array.from({ length: 120 }, (_, i) => ({
      at: "2026-11-03T05:42:00Z",
      type: "delivery_logged",
      actor: "creator",
      fromState: null,
      toState: null,
      reason: `Preview: file-${i}.png`,
    }));
    const bytes = await renderEvidencePdf(pack({ events }));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(2);
  });
});

describe("formatStamp", () => {
  it("formats in UTC", () => {
    expect(formatStamp("2026-11-03T05:42:00Z")).toBe("3 Nov 2026, 05:42 UTC");
    expect(formatStamp(null)).toBe("-");
  });
});
