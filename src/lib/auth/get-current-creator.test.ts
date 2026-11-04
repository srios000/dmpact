import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getCurrentCreator } from "./get-current-creator";
import { auth } from "./server";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("./server", () => ({ auth: { getSession: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db: { creator: { upsert: vi.fn() } } }));

const getSession = vi.mocked(auth.getSession);
const upsert = vi.mocked(db.creator.upsert);

function session(data: unknown, error: unknown = null) {
  getSession.mockResolvedValue({ data, error } as never);
}

describe("getCurrentCreator", () => {
  beforeEach(() => {
    getSession.mockReset();
    upsert.mockReset();
  });

  it.each([
    ["no session", null, null],
    ["a session error", null, new Error("down")],
  ])("returns null on %s without touching the database", async (_n, d, e) => {
    session(d, e);
    expect(await getCurrentCreator()).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("finds the creator by the session's user id", async () => {
    const creator = {
      id: "c1",
      email: "a@test.dev",
      displayName: "A",
      paypalEmail: null,
    };
    session({ user: { id: "u1", email: "a@test.dev", name: "A" } });
    upsert.mockResolvedValue(creator as never);

    expect(await getCurrentCreator()).toEqual(creator);
    expect(upsert.mock.calls[0][0]).toMatchObject({
      where: { authUserId: "u1" },
      update: {},
      create: { authUserId: "u1", email: "a@test.dev", displayName: "A" },
    });
  });

  it("falls back to the email when the user has no name", async () => {
    session({ user: { id: "u2", email: "b@test.dev", name: "" } });
    upsert.mockResolvedValue({} as never);

    await getCurrentCreator();

    expect(upsert.mock.calls[0][0]).toMatchObject({
      create: { displayName: "b@test.dev" },
    });
  });
});
