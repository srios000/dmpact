import { computeAmounts } from "@/lib/money/decimal";
import { agreementSchema, type Agreement } from "@/lib/schema/agreement";
import type { GuardContext } from "./rules";

export type AgreementFacts = Pick<
  GuardContext,
  "agreementValid" | "blockerCount" | "depositType" | "balanceIsZero"
>;

function amountsOf({ price, deposit }: Agreement) {
  if (price.currency === null) return null;
  try {
    const amounts = computeAmounts(price.total, price.currency, deposit);
    return amounts && !amounts.exceeds ? amounts : null;
  } catch {
    return null;
  }
}

export function readAgreementFacts(content: unknown): AgreementFacts {
  const parsed = agreementSchema.safeParse(content);
  if (!parsed.success) {
    return {
      agreementValid: false,
      blockerCount: 0,
      depositType: null,
      balanceIsZero: false,
    };
  }

  const amounts = amountsOf(parsed.data);

  return {
    agreementValid: amounts !== null,
    blockerCount: parsed.data.ambiguities.filter(
      (a) => a.severity === "blocker",
    ).length,
    depositType: parsed.data.deposit.type,
    balanceIsZero:
      amounts !== null && /^0+(\.0+)?$/.test(amounts.balance ?? ""),
  };
}
