import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { readAgreementFacts } from "./agreement-facts";
import { TransitionError } from "./errors";
import {
  checkTransition,
  type Actor,
  type CommissionState,
  type Effect,
  type GuardContext,
} from "./rules";

export type EffectHandlers = Partial<
  Record<Effect, (commissionId: string) => Promise<void>>
>;

export type TransitionInput = {
  commissionId: string;
  to: CommissionState;
  actor: Actor;
  reason?: string;
};

export type TransitionResult = {
  from: CommissionState;
  to: CommissionState;
  effects: Effect[];
  failedEffects: Effect[];
};

export type Step = {
  from: CommissionState;
  to: CommissionState;
  effects: Effect[];
};

export async function loadGuardContext(
  tx: Prisma.TransactionClient,
  commissionId: string,
): Promise<GuardContext> {
  const [latest, deliveryCount] = await Promise.all([
    tx.agreementVersion.findFirst({
      where: { commissionId },
      orderBy: { version: "desc" },
      include: { confirmations: true },
    }),
    tx.delivery.count({ where: { commissionId } }),
  ]);

  const confirmed = (party: "creator" | "client") =>
    !!latest?.confirmations.some(
      (c) => c.party === party && c.contentHash === latest.contentHash,
    );

  return {
    hasAgreement: !!latest,
    ...readAgreementFacts(latest?.content),
    confirmedBy: { creator: confirmed("creator"), client: confirmed("client") },
    deliveryCount,
  };
}

export async function applyTransition(
  tx: Prisma.TransactionClient,
  input: TransitionInput,
): Promise<Step[]> {
  const { commissionId } = input;
  const applied: Step[] = [];
  let target: CommissionState | undefined = input.to;
  let actor = input.actor;
  let reason = input.reason;

  while (target) {
    const commission = await tx.commission.findUnique({
      where: { id: commissionId },
      select: { state: true },
    });
    if (!commission) {
      throw new TransitionError("not_found", "Commission not found.");
    }

    const from = commission.state;
    const check = checkTransition(
      from,
      target,
      actor,
      await loadGuardContext(tx, commissionId),
    );
    if (!check.ok) throw new TransitionError(check.code, check.message);

    const { count } = await tx.commission.updateMany({
      where: { id: commissionId, state: from },
      data: { state: target },
    });
    if (count !== 1) {
      throw new TransitionError(
        "conflict",
        "The commission changed during the update. Try again.",
      );
    }

    await tx.commissionEvent.create({
      data: {
        commissionId,
        type: "transition",
        fromState: from,
        toState: target,
        actor,
        reason,
        meta: check.effects.length ? { effects: check.effects } : undefined,
      },
    });

    applied.push({ from, to: target, effects: check.effects });
    target = check.followUp;
    actor = "system";
    reason = "Balance is zero.";
  }

  return applied;
}

export async function transition(
  db: PrismaClient,
  input: TransitionInput,
  handlers: EffectHandlers = {},
): Promise<TransitionResult> {
  const steps = await db.$transaction((tx) => applyTransition(tx, input));
  return runEffects(db, input.commissionId, steps, handlers);
}

export async function runEffects(
  db: PrismaClient,
  commissionId: string,
  steps: Step[],
  handlers: EffectHandlers = {},
): Promise<TransitionResult> {
  const effects = steps.flatMap((s) => s.effects);
  const failedEffects: Effect[] = [];

  for (const effect of effects) {
    const handler = handlers[effect];
    if (!handler) continue;
    try {
      await handler(commissionId);
    } catch (error) {
      failedEffects.push(effect);
      await db.commissionEvent.create({
        data: {
          commissionId,
          type: "effect_failed",
          actor: "system",
          reason: effect,
          meta: {
            message: error instanceof Error ? error.message : String(error),
          },
        },
      });
    }
  }

  return {
    from: steps[0].from,
    to: steps[steps.length - 1].to,
    effects,
    failedEffects,
  };
}
