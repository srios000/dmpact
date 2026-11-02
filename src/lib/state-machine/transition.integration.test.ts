import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { contentHash } from "@/lib/schema/content-hash";
import { exampleAgreement } from "@/lib/schema/example-agreement";
import { TransitionError } from "./errors";
import type { CommissionState } from "./rules";
import { transition } from "./transition";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("transition (database)", () => {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  afterAll(() => db.$disconnect());

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      "TRUNCATE creators, commissions, agreement_versions, confirmations, invoices, deliveries, commission_events, change_requests, rate_cards RESTART IDENTITY CASCADE",
    );
  });

  async function seed(
    state: CommissionState,
    content: object = exampleAgreement,
  ) {
    const creator = await db.creator.create({
      data: {
        authUserId: crypto.randomUUID(),
        email: `${crypto.randomUUID()}@test.dev`,
        displayName: "Test",
      },
    });
    const commission = await db.commission.create({
      data: { creatorId: creator.id, sourceDm: "dm", state },
    });
    const hash = contentHash(content);
    const version = await db.agreementVersion.create({
      data: {
        commissionId: commission.id,
        version: 1,
        content,
        contentHash: hash,
        createdBy: "creator",
      },
    });
    return { id: commission.id, versionId: version.id, hash };
  }

  async function confirm(
    c: { id: string; versionId: string; hash: string },
    party: "creator" | "client",
  ) {
    await db.confirmation.create({
      data: {
        commissionId: c.id,
        agreementVersionId: c.versionId,
        party,
        contentHash: c.hash,
      },
    });
  }

  it("moves through the full flow and logs every step", async () => {
    const c = await seed("draft");
    const createDepositInvoice = vi.fn(async () => {});
    const createBalanceInvoice = vi.fn(async () => {});
    const handlers = { createDepositInvoice, createBalanceInvoice };

    await transition(db, {
      commissionId: c.id,
      to: "negotiating",
      actor: "creator",
    });
    await confirm(c, "creator");
    await confirm(c, "client");
    await transition(
      db,
      { commissionId: c.id, to: "agreed", actor: "client" },
      handlers,
    );
    await transition(db, {
      commissionId: c.id,
      to: "dp_paid",
      actor: "paypal",
    });
    await transition(db, {
      commissionId: c.id,
      to: "in_progress",
      actor: "creator",
    });
    await db.delivery.create({
      data: {
        commissionId: c.id,
        filename: "mix.wav",
        sha256: "a".repeat(64),
        sizeBytes: 10,
        mimeType: "audio/wav",
      },
    });
    await transition(
      db,
      { commissionId: c.id, to: "delivered", actor: "creator" },
      handlers,
    );
    await transition(db, {
      commissionId: c.id,
      to: "fully_paid",
      actor: "paypal",
    });

    expect(createDepositInvoice).toHaveBeenCalledWith(c.id);
    expect(createBalanceInvoice).toHaveBeenCalledWith(c.id);

    const commission = await db.commission.findUniqueOrThrow({
      where: { id: c.id },
    });
    expect(commission.state).toBe("fully_paid");

    const events = await db.commissionEvent.findMany({
      where: { commissionId: c.id },
      orderBy: { at: "asc" },
    });
    expect(events.map((e) => e.toState)).toEqual([
      "negotiating",
      "agreed",
      "dp_paid",
      "in_progress",
      "delivered",
      "fully_paid",
    ]);
  });

  it("leaves state and log untouched when a guard fails", async () => {
    const c = await seed("negotiating");
    await confirm(c, "creator");

    await expect(
      transition(db, { commissionId: c.id, to: "agreed", actor: "client" }),
    ).rejects.toMatchObject({ code: "guard_failed", status: 409 });

    const commission = await db.commission.findUniqueOrThrow({
      where: { id: c.id },
    });
    expect(commission.state).toBe("negotiating");
    expect(await db.commissionEvent.count()).toBe(0);
  });

  it("blocks a malformed agreement even with no blocker flags", async () => {
    const c = await seed("negotiating", { ambiguities: [] });
    await confirm(c, "creator");
    await confirm(c, "client");
    const createDepositInvoice = vi.fn(async () => {});

    await expect(
      transition(
        db,
        { commissionId: c.id, to: "agreed", actor: "client" },
        { createDepositInvoice },
      ),
    ).rejects.toMatchObject({ code: "guard_failed" });

    expect(createDepositInvoice).not.toHaveBeenCalled();
    const commission = await db.commission.findUniqueOrThrow({
      where: { id: c.id },
    });
    expect(commission.state).toBe("negotiating");
  });

  it("ignores confirmations of an older version", async () => {
    const c = await seed("negotiating");
    await confirm(c, "creator");
    await confirm(c, "client");
    const newer: object = { ...exampleAgreement, title: "Changed title" };
    await db.agreementVersion.create({
      data: {
        commissionId: c.id,
        version: 2,
        content: newer,
        contentHash: contentHash(newer),
        createdBy: "creator",
      },
    });

    await expect(
      transition(db, { commissionId: c.id, to: "agreed", actor: "client" }),
    ).rejects.toBeInstanceOf(TransitionError);
  });

  it("completes immediately when the balance is zero", async () => {
    const c = await seed("in_progress", {
      ...exampleAgreement,
      deposit: { type: "percent", percent: 100, fixed_amount: null },
    });
    await db.delivery.create({
      data: {
        commissionId: c.id,
        filename: "art.png",
        sha256: "b".repeat(64),
        sizeBytes: 10,
        mimeType: "image/png",
      },
    });

    const result = await transition(db, {
      commissionId: c.id,
      to: "delivered",
      actor: "creator",
    });

    expect(result).toMatchObject({
      from: "in_progress",
      to: "fully_paid",
      effects: [],
    });
    const events = await db.commissionEvent.findMany({
      where: { commissionId: c.id },
      orderBy: { at: "asc" },
    });
    expect(events.map((e) => [e.toState, e.actor])).toEqual([
      ["delivered", "creator"],
      ["fully_paid", "system"],
    ]);
  });

  it("keeps the new state and logs a failed side effect", async () => {
    const c = await seed("negotiating");
    await confirm(c, "creator");
    await confirm(c, "client");

    const result = await transition(
      db,
      { commissionId: c.id, to: "agreed", actor: "client" },
      {
        createDepositInvoice: async () => {
          throw new Error("PayPal is down");
        },
      },
    );

    expect(result.failedEffects).toEqual(["createDepositInvoice"]);
    const commission = await db.commission.findUniqueOrThrow({
      where: { id: c.id },
    });
    expect(commission.state).toBe("agreed");
    const failed = await db.commissionEvent.findFirstOrThrow({
      where: { commissionId: c.id, type: "effect_failed" },
    });
    expect(failed.meta).toEqual({ message: "PayPal is down" });
  });

  it("returns not_found for an unknown commission", async () => {
    await expect(
      transition(db, {
        commissionId: crypto.randomUUID(),
        to: "negotiating",
        actor: "creator",
      }),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
  });
});
