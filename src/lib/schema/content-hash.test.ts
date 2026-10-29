import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalJson, contentHash } from "./content-hash";

describe("canonicalJson", () => {
  it("sorts object keys recursively", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    );
  });

  it("keeps array order", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });

  it("drops undefined but keeps null", () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe("contentHash", () => {
  it("is the sha256 hex of the canonical JSON", () => {
    const expected = createHash("sha256").update('{"a":1,"b":2}').digest("hex");
    expect(contentHash({ b: 2, a: 1 })).toBe(expected);
  });

  it("ignores key order", () => {
    expect(contentHash({ x: [1, { q: 1, p: 2 }], y: "z" })).toBe(
      contentHash({ y: "z", x: [1, { p: 2, q: 1 }] }),
    );
  });

  it("changes when a value changes", () => {
    expect(contentHash({ price: "150.00" })).not.toBe(
      contentHash({ price: "150.01" }),
    );
  });
});
