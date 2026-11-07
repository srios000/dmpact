import { describe, expect, it } from "vitest";
import { createTokenProvider } from "./token";

function fakeFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const base = {
  baseUrl: "https://api-m.sandbox.paypal.com",
  clientId: "id",
  clientSecret: "secret",
};

describe("createTokenProvider", () => {
  it("sends basic auth and caches the token until expiry", async () => {
    let t = 0;
    const f = fakeFetch([
      { status: 200, body: { access_token: "A", expires_in: 3600 } },
      { status: 200, body: { access_token: "B", expires_in: 3600 } },
    ]);
    const p = createTokenProvider({ ...base, fetch: f.fn, now: () => t });

    expect(await p.getToken()).toBe("A");
    expect(await p.getToken()).toBe("A");
    expect(f.calls.length).toBe(1);
    const headers = f.calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("id:secret").toString("base64")}`,
    );

    t = 3600_000 - 30_000; // inside the 60 s refresh margin
    expect(await p.getToken()).toBe("B");
    expect(f.calls.length).toBe(2);
  });

  it("shares one request between concurrent callers", async () => {
    const f = fakeFetch([
      { status: 200, body: { access_token: "A", expires_in: 3600 } },
    ]);
    const p = createTokenProvider({ ...base, fetch: f.fn });
    const tokens = await Promise.all([
      p.getToken(),
      p.getToken(),
      p.getToken(),
    ]);
    expect(tokens).toEqual(["A", "A", "A"]);
    expect(f.calls.length).toBe(1);
  });

  it("refetches after invalidate()", async () => {
    const f = fakeFetch([
      { status: 200, body: { access_token: "A", expires_in: 3600 } },
      { status: 200, body: { access_token: "B", expires_in: 3600 } },
    ]);
    const p = createTokenProvider({ ...base, fetch: f.fn });
    await p.getToken();
    p.invalidate();
    expect(await p.getToken()).toBe("B");
  });

  it("throws a readable error on invalid_client", async () => {
    const f = fakeFetch([
      {
        status: 401,
        body: {
          error: "invalid_client",
          error_description: "Client Authentication failed",
        },
      },
    ]);
    const p = createTokenProvider({ ...base, fetch: f.fn });
    await expect(p.getToken()).rejects.toThrow(/invalid_client/);
  });
});
