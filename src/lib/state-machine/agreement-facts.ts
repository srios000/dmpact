import type { GuardContext } from "./rules";

export type AgreementFacts = Pick<
  GuardContext,
  "blockerCount" | "depositType" | "balanceIsZero"
>;

const DEPOSIT_TYPES = ["percent", "fixed", "none"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readAgreementFacts(content: unknown): AgreementFacts {
  const agreement = isRecord(content) ? content : {};

  const ambiguities = Array.isArray(agreement.ambiguities)
    ? agreement.ambiguities
    : [];
  const blockerCount = ambiguities.filter(
    (a) => isRecord(a) && a.severity === "blocker",
  ).length;

  const deposit = isRecord(agreement.deposit) ? agreement.deposit : {};
  const depositType = DEPOSIT_TYPES.find((t) => t === deposit.type) ?? null;

  const balanceIsZero =
    typeof agreement.balance_amount === "string" &&
    /^0+(\.0+)?$/.test(agreement.balance_amount);

  return { blockerCount, depositType, balanceIsZero };
}
