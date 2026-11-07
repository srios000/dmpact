import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RepositoryError } from "@/lib/repositories/errors";
import { getEvidencePack } from "@/lib/repositories/evidence-repository";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import { GET } from "./route";

vi.mock("@/lib/repositories/evidence-repository", () => ({
  getEvidencePack: vi.fn(),
}));

const id = "019a5c3e-7b4d-7e2a-9c1f-3d2b1a0f9e8c";
const call = (commissionId: string) =>
  GET(new Request("http://test.dev"), {
    params: Promise.resolve({ id: commissionId }),
  });

describe("GET /api/commissions/[id]/evidence", () => {
  beforeEach(() => {
    vi.mocked(getEvidencePack).mockReset();
  });

  it("returns the evidence pack as a PDF download", async () => {
    vi.mocked(getEvidencePack).mockResolvedValue({
      generatedAt: "2026-11-20T09:15:00Z",
      commission: {
        id,
        state: "delivered",
        createdAt: "2026-11-02T03:00:00Z",
        creatorName: "Mira Sound",
        clientToken: null,
      },
      agreement: {
        version: 1,
        contentHash: "a".repeat(64),
        confirmedByBoth: true,
        content: exampleAgreement,
      },
      confirmations: [],
      invoices: [],
      deliveries: [],
      downloads: [],
      events: [],
      sourceDm: "dm",
      followUpDms: [],
    });

    const response = await call(id);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="dmpact-evidence-3d2b1a0f9e8c.pdf"',
    );
    const doc = await PDFDocument.load(await response.arrayBuffer());
    expect(doc.getPageCount()).toBeGreaterThan(0);
    expect(getEvidencePack).toHaveBeenCalledWith(id);
  });

  it("returns 404 for a malformed id or someone else's commission", async () => {
    expect((await call("nope")).status).toBe(404);
    vi.mocked(getEvidencePack).mockRejectedValue(
      new RepositoryError("not_found", "Commission not found."),
    );
    expect((await call(id)).status).toBe(404);
  });

  it("returns 401 when signed out", async () => {
    vi.mocked(getEvidencePack).mockRejectedValue(
      new RepositoryError("unauthorized", "Sign in first."),
    );
    expect((await call(id)).status).toBe(401);
  });
});
