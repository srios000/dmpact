import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentCreator } from "@/lib/auth/get-current-creator";
import { db } from "@/lib/db";
import { DEFAULT_RATE_CARD } from "@/lib/schema/rate-card";
import { getRateCard, saveRateCard } from "./rate-card-repository";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/get-current-creator", () => ({
  getCurrentCreator: vi.fn(),
}));
vi.mock("@/lib/db", async () => {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@/generated/prisma/client");
  return {
    db: new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.TEST_DATABASE_URL,
      }),
    }),
  };
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("rate card (database)", () => {
  afterAll(() => db.$disconnect());

  async function signIn() {
    const creator = await db.creator.create({
      data: {
        authUserId: crypto.randomUUID(),
        email: `${crypto.randomUUID()}@test.dev`,
        displayName: "Test Creator",
      },
    });
    vi.mocked(getCurrentCreator).mockResolvedValue({
      id: creator.id,
      email: creator.email,
      displayName: creator.displayName,
      paypalEmail: null,
    });
    return creator;
  }

  beforeEach(async () => {
    await signIn();
  });

  it("falls back to the default rate card", async () => {
    expect(await getRateCard()).toEqual({
      rate_card: DEFAULT_RATE_CARD,
      mismatch_threshold_pct: 20,
      is_default: true,
    });
  });

  it("stores a rate card per creator", async () => {
    const rate_card = {
      ...DEFAULT_RATE_CARD,
      services: { ...DEFAULT_RATE_CARD.services, illustration: "180.00" },
    };
    await saveRateCard({ rate_card, mismatch_threshold_pct: 30 });
    expect(await getRateCard()).toEqual({
      rate_card,
      mismatch_threshold_pct: 30,
      is_default: false,
    });

    await signIn();
    expect((await getRateCard()).is_default).toBe(true);
  });

  it("falls back when the stored rates don't match the schema", async () => {
    const creator = await signIn();
    await db.rateCard.create({
      data: {
        creatorId: creator.id,
        rates: { services: { chibiIcon: "80.00" } },
      },
    });
    expect((await getRateCard()).rate_card).toEqual(DEFAULT_RATE_CARD);
  });
});
