import { SUPPORTED_CURRENCIES } from "@/lib/ai/extract/post-checks";
import { currencyExponent } from "@/lib/money/decimal";

/**
 * Formats an amount for the PayPal Invoicing API. Money math stays in
 * `lib/money`; this only validates and normalizes what we send.
 *
 *   toPayPalValue("75", "USD")       -> "75.00"
 *   toPayPalValue("15000.00", "JPY") -> "15000"
 *   toPayPalValue("15000.5", "JPY")  -> throws (JPY has no decimals)
 *   toPayPalValue("10", "IDR")       -> throws (PayPal can't invoice IDR)
 */
export function toPayPalValue(amount: string, currency: string): string {
  if (!SUPPORTED_CURRENCIES.has(currency)) {
    throw new Error(`Currency ${currency} is not supported by PayPal`);
  }
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match) {
    throw new Error(
      `Invalid amount "${amount}": expected a decimal string like "75.00"`,
    );
  }
  const whole = match[1].replace(/^0+(?=\d)/, "");
  const fraction = match[2] ?? "";

  let value: string;
  if (currencyExponent(currency) === 0) {
    if (/[1-9]/.test(fraction)) {
      throw new Error(
        `Invalid amount "${amount}": ${currency} does not allow decimals`,
      );
    }
    value = whole;
  } else {
    if (/[1-9]/.test(fraction.slice(2))) {
      throw new Error(
        `Invalid amount "${amount}": ${currency} allows at most 2 decimals`,
      );
    }
    value = `${whole}.${fraction.slice(0, 2).padEnd(2, "0")}`;
  }

  if (!/[1-9]/.test(value)) {
    throw new Error(`Invalid amount "${amount}": must be greater than zero`);
  }
  return value;
}
