import { describe, expect, it } from "vitest";
import { parseEnv } from "./env-schema";

const valid = {
  DATABASE_URL: "postgresql://localhost/test",
  NEON_AUTH_BASE_URL: "https://auth.test.dev/neondb/auth",
  NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
  APP_BASE_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("accepts the required vars and treats empty optional ones as unset", () => {
    const env = parseEnv({ ...valid, CRON_SECRET: "" });
    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(env.CRON_SECRET).toBeUndefined();
  });

  it.each(Object.keys(valid))("fails when %s is missing", (name) => {
    expect(() => parseEnv({ ...valid, [name]: undefined })).toThrow(name);
  });

  it("fails on a short cookie secret", () => {
    expect(() =>
      parseEnv({ ...valid, NEON_AUTH_COOKIE_SECRET: "short" }),
    ).toThrow("NEON_AUTH_COOKIE_SECRET");
  });

  it("names the bad var without printing its value", () => {
    expect(() =>
      parseEnv({ ...valid, NEON_AUTH_COOKIE_SECRET: "hunter2" }),
    ).not.toThrow("hunter2");
    expect(() => parseEnv({ ...valid, NEON_AUTH_BASE_URL: "hunter2" })).toThrow(
      /^Missing or invalid env vars: NEON_AUTH_BASE_URL$/,
    );
  });
});
