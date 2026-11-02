import type { Agreement } from "@/lib/schema/agreement";
import { computeAmounts, type ComputedAmounts } from "./decimal";

function amountsOf({ price, deposit }: Agreement): ComputedAmounts | null {
  try {
    return computeAmounts(price.total, price.currency, deposit);
  } catch {
    return null;
  }
}

export function withComputedAmounts(agreement: Agreement): Agreement {
  const amounts = amountsOf(agreement);
  return {
    ...agreement,
    deposit: { ...agreement.deposit, amount: amounts?.deposit ?? null },
    balance_amount: amounts?.balance ?? null,
  };
}
