export const COMMISSION_STATES = [
  "draft",
  "negotiating",
  "agreed",
  "dp_paid",
  "in_progress",
  "delivered",
  "fully_paid",
  "cancelled",
] as const;

export type CommissionState = (typeof COMMISSION_STATES)[number];
export type Actor = "creator" | "client" | "paypal" | "system";
export type Effect =
  "createDepositInvoice" | "createBalanceInvoice" | "cancelOpenInvoices";

export type GuardContext = {
  hasAgreement: boolean;
  agreementValid: boolean;
  blockerCount: number;
  confirmedBy: { creator: boolean; client: boolean };
  depositType: "percent" | "fixed" | "none" | null;
  hasClientEmail: boolean;
  balanceIsZero: boolean;
  deliveryCount: number;
};

export type TransitionErrorCode =
  "not_allowed" | "actor_not_allowed" | "guard_failed";

export type CheckResult =
  | { ok: true; effects: Effect[]; followUp?: CommissionState }
  | { ok: false; code: TransitionErrorCode; message: string };

type Guard = (ctx: GuardContext) => string | null;

type Rule = {
  from: CommissionState;
  to: CommissionState;
  actors: Actor[];
  guards?: Guard[];
  effects?: (ctx: GuardContext) => Effect[];
  followUp?: (ctx: GuardContext) => CommissionState | undefined;
};

const hasAgreement: Guard = (ctx) =>
  ctx.hasAgreement ? null : "The commission has no agreement yet.";

const noBlockers: Guard = (ctx) =>
  ctx.blockerCount === 0
    ? null
    : `${ctx.blockerCount} blocker ambiguities must be resolved first.`;

const validAgreement: Guard = (ctx) =>
  ctx.agreementValid
    ? null
    : "The agreement is invalid or its price and deposit are incomplete.";

const bothConfirmed: Guard = (ctx) =>
  ctx.confirmedBy.creator && ctx.confirmedBy.client
    ? null
    : "Creator and client must both confirm the current agreement version.";

const clientEmailForDeposit: Guard = (ctx) => {
  if (ctx.hasClientEmail) return null;
  if (ctx.depositType !== "none") {
    return "Add the client's PayPal email to the agreement so the deposit invoice can be sent.";
  }
  if (!ctx.balanceIsZero) {
    return "Add the client's PayPal email to the agreement so the balance invoice can be sent.";
  }
  return null;
};

const clientEmailForBalance: Guard = (ctx) =>
  ctx.balanceIsZero || ctx.hasClientEmail
    ? null
    : "Add the client's PayPal email to the agreement so the balance invoice can be sent.";

const depositRequired: Guard = (ctx) =>
  ctx.depositType === "percent" || ctx.depositType === "fixed"
    ? null
    : "This commission has no deposit.";

const noDeposit: Guard = (ctx) =>
  ctx.depositType === "none" ? null : "The deposit must be paid first.";

const hasDelivery: Guard = (ctx) =>
  ctx.deliveryCount > 0 ? null : "Log a delivery first.";

const balanceIsZero: Guard = (ctx) =>
  ctx.balanceIsZero ? null : "The balance must be paid through PayPal.";

const RULES: Rule[] = [
  {
    from: "draft",
    to: "negotiating",
    actors: ["creator"],
    guards: [hasAgreement, noBlockers, validAgreement],
  },
  {
    from: "negotiating",
    to: "agreed",
    actors: ["creator", "client"],
    guards: [
      hasAgreement,
      noBlockers,
      validAgreement,
      bothConfirmed,
      clientEmailForDeposit,
    ],
    effects: (ctx) =>
      ctx.depositType === "none" ? [] : ["createDepositInvoice"],
  },
  {
    from: "agreed",
    to: "dp_paid",
    actors: ["paypal"],
    guards: [depositRequired],
  },
  {
    from: "agreed",
    to: "in_progress",
    actors: ["creator"],
    guards: [noDeposit],
  },
  { from: "dp_paid", to: "in_progress", actors: ["creator"] },
  {
    from: "in_progress",
    to: "delivered",
    actors: ["creator"],
    guards: [hasDelivery, validAgreement, clientEmailForBalance],
    effects: (ctx) => (ctx.balanceIsZero ? [] : ["createBalanceInvoice"]),
    followUp: (ctx) => (ctx.balanceIsZero ? "fully_paid" : undefined),
  },
  { from: "delivered", to: "fully_paid", actors: ["paypal"] },
  {
    from: "delivered",
    to: "fully_paid",
    actors: ["system"],
    guards: [balanceIsZero],
  },
  {
    from: "draft",
    to: "cancelled",
    actors: ["creator"],
    effects: () => ["cancelOpenInvoices"],
  },
  {
    from: "negotiating",
    to: "cancelled",
    actors: ["creator"],
    effects: () => ["cancelOpenInvoices"],
  },
  {
    from: "agreed",
    to: "cancelled",
    actors: ["creator"],
    effects: () => ["cancelOpenInvoices"],
  },
];

export function checkTransition(
  from: CommissionState,
  to: CommissionState,
  actor: Actor,
  ctx: GuardContext,
): CheckResult {
  const candidates = RULES.filter((r) => r.from === from && r.to === to);
  if (candidates.length === 0) {
    return {
      ok: false,
      code: "not_allowed",
      message: `Cannot move from ${from} to ${to}.`,
    };
  }

  const rule = candidates.find((r) => r.actors.includes(actor));
  if (!rule) {
    return {
      ok: false,
      code: "actor_not_allowed",
      message: `${actor} cannot move a commission from ${from} to ${to}.`,
    };
  }

  for (const guard of rule.guards ?? []) {
    const failure = guard(ctx);
    if (failure) return { ok: false, code: "guard_failed", message: failure };
  }

  return {
    ok: true,
    effects: rule.effects?.(ctx) ?? [],
    followUp: rule.followUp?.(ctx),
  };
}
