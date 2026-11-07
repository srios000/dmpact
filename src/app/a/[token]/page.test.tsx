import { beforeEach, describe, expect, it, vi } from "vitest";
import { getClientAgreement } from "@/lib/repositories/agreement-repository";
import ClientAgreementPage from "./page";

vi.mock("@/lib/repositories/agreement-repository", () => ({
  getClientAgreement: vi.fn(),
}));
vi.mock("@/lib/repositories/delivery-repository", () => ({}));

const render = (token: string) =>
  ClientAgreementPage({
    params: Promise.resolve({ token }),
    searchParams: Promise.resolve({}),
  });

describe("/a/[token]", () => {
  beforeEach(() => vi.mocked(getClientAgreement).mockReset());

  it("responds 404 for an unknown token", async () => {
    vi.mocked(getClientAgreement).mockResolvedValue(null);

    await expect(render("a".repeat(22))).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
    expect(getClientAgreement).toHaveBeenCalledWith("a".repeat(22));
  });

  it("renders the agreement for a known token", async () => {
    vi.mocked(getClientAgreement).mockResolvedValue({
      agreement: { title: "Lyric video" },
      creatorName: "Test Creator",
      version: 2,
      state: "negotiating",
      deposit: { status: "not_created", payLink: null, paidAt: null },
      balance: { status: "not_created", payLink: null, paidAt: null },
    } as Awaited<ReturnType<typeof getClientAgreement>>);

    const page = await render("a".repeat(22));
    expect(page).toBeTruthy();
    expect(page.props).toMatchObject({
      token: "a".repeat(22),
      view: {
        agreement: { title: "Lyric video" },
        creatorName: "Test Creator",
        version: 2,
      },
    });
  });
});
