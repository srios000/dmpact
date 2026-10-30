/**
 * Money helpers on decimal strings ("150.00"). Amounts are handled as integer
 * minor units (cents) so no float math touches money.
 */

const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "HUF", "TWD"]);

export function currencyExponent(currency: string | null | undefined): number {
  return currency && ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
    ? 0
    : 2;
}

export function toMinor(amount: string, exponent: number): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) throw new Error(`Invalid money string: "${amount}"`);
  const whole = match[1];
  const fraction = match[2] ?? "";

  let minor: number;
  if (exponent === 0) {
    if (/[1-9]/.test(fraction)) {
      throw new Error(`Currency has no decimals, got "${amount}"`);
    }
    minor = Number(whole);
  } else {
    minor = Number(whole + fraction.padEnd(2, "0"));
  }
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`Amount too large: "${amount}"`);
  }
  return minor;
}

export function fromMinor(minor: number, exponent: number): string {
  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new Error(`Invalid minor amount: ${minor}`);
  }
  const digits = String(minor);
  if (exponent === 0) return digits;
  const padded = digits.padStart(3, "0");
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
}

/** Integer division of n by d, rounding half up. n and d are safe integers. */
function divRoundHalfUp(n: number, d: number): number {
  const remainder = n % d;
  const quotient = (n - remainder) / d;
  return remainder * 2 >= d ? quotient + 1 : quotient;
}

export type DepositTerms = {
  type: "percent" | "fixed" | "none";
  percent: number | null;
  fixed_amount: string | null;
};

export type ComputedAmounts = {
  deposit: string;
  /** null when the deposit exceeds the total. */
  balance: string | null;
  exceeds: boolean;
};

/**
 * Deposit and balance from total + deposit terms. Returns null when the terms
 * are incomplete (no total, percent type without a percent, ...).
 */
export function computeAmounts(
  total: string | null,
  currency: string | null,
  deposit: DepositTerms,
): ComputedAmounts | null {
  if (total === null) return null;
  const exponent = currencyExponent(currency);
  const totalMinor = toMinor(total, exponent);

  let depositMinor: number;
  if (deposit.type === "none") {
    depositMinor = 0;
  } else if (deposit.type === "percent") {
    if (deposit.percent === null) return null;
    const basisPoints = Math.round(deposit.percent * 100);
    const product = totalMinor * basisPoints;
    if (!Number.isSafeInteger(product)) return null;
    depositMinor = divRoundHalfUp(product, 10000);
  } else {
    if (deposit.fixed_amount === null) return null;
    depositMinor = toMinor(deposit.fixed_amount, exponent);
  }

  if (depositMinor > totalMinor) {
    return {
      deposit: fromMinor(depositMinor, exponent),
      balance: null,
      exceeds: true,
    };
  }
  return {
    deposit: fromMinor(depositMinor, exponent),
    balance: fromMinor(totalMinor - depositMinor, exponent),
    exceeds: false,
  };
}
