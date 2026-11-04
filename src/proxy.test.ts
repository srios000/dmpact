import { NextRequest, NextResponse } from "next/server";
import {
  getRewrittenUrl,
  isRewrite,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientLinkExists } from "@/lib/repositories/agreement-repository";
import proxy, { config } from "./proxy";

const { requireCreator } = vi.hoisted(() => ({ requireCreator: vi.fn() }));

vi.mock("@/lib/auth/server", () => ({
  auth: { middleware: () => requireCreator },
}));
vi.mock("@/lib/repositories/agreement-repository", () => ({
  clientLinkExists: vi.fn(),
}));

const token = "a".repeat(22);
const call = (path: string) =>
  proxy(new NextRequest(new URL(path, "http://test.dev")));

describe("proxy", () => {
  beforeEach(() => {
    vi.mocked(clientLinkExists).mockReset();
    requireCreator.mockReset().mockResolvedValue(NextResponse.next());
  });

  it("runs on client links without asking for a login", async () => {
    expect(unstable_doesMiddlewareMatch({ config, url: `/a/${token}` })).toBe(
      true,
    );
    vi.mocked(clientLinkExists).mockResolvedValue(true);

    const response = await call(`/a/${token}`);

    expect(clientLinkExists).toHaveBeenCalledWith(token);
    expect(isRewrite(response)).toBe(false);
    expect(requireCreator).not.toHaveBeenCalled();
  });

  it("serves the 404 page for an unknown or malformed token", async () => {
    vi.mocked(clientLinkExists).mockResolvedValue(false);

    for (const path of [`/a/${token}`, "/a/short"]) {
      const response = await call(path);
      expect(isRewrite(response)).toBe(true);
      expect(getRewrittenUrl(response)).toBe(
        "http://test.dev/a/link-not-found",
      );
    }
    expect(requireCreator).not.toHaveBeenCalled();
  });

  it("still guards creator pages", async () => {
    await call("/commissions");
    expect(requireCreator).toHaveBeenCalled();
    expect(clientLinkExists).not.toHaveBeenCalled();
  });
});
