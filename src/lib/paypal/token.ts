import { z } from "zod";
import { toPayPalError } from "./errors";

const TokenResponse = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(), // seconds
});

export interface TokenProvider {
  /** Returns a valid access token, fetching a new one only when needed. */
  getToken(): Promise<string>;
  /** Drop the cached token (e.g. after a 401). */
  invalidate(): void;
}

export interface TokenProviderOptions {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  now?: () => number;
  /** Refresh this many ms before PayPal's expiry. Default 60 s. */
  refreshMarginMs?: number;
}

/**
 * OAuth 2.0 client-credentials token with in-memory caching.
 *
 * The cache lives per server instance. On Vercel each cold start fetches one new
 * token, which is fine: PayPal tokens last ~9 hours and requesting new ones is cheap.
 * Concurrent callers share one in-flight request.
 */
export function createTokenProvider(opts: TokenProviderOptions): TokenProvider {
  const doFetch = opts.fetch ?? fetch;
  const now = opts.now ?? Date.now;
  const margin = opts.refreshMarginMs ?? 60_000;

  let cached: { token: string; expiresAt: number } | null = null;
  let inFlight: Promise<string> | null = null;

  async function fetchToken(): Promise<string> {
    const basic = Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString(
      "base64",
    );
    const res = await doFetch(`${opts.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });
    if (!res.ok) throw await toPayPalError(res, "OAuth token request");
    const data = TokenResponse.parse(await res.json());
    cached = {
      token: data.access_token,
      expiresAt: now() + data.expires_in * 1000,
    };
    return data.access_token;
  }

  return {
    async getToken() {
      if (cached && now() < cached.expiresAt - margin) return cached.token;
      if (!inFlight) {
        inFlight = fetchToken().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
    invalidate() {
      cached = null;
    },
  };
}
