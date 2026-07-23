/** Platform billing currency — USD only. Plan prices stored in cents (Stripe-compatible). */
export const BILLING_CURRENCY = "USD" as const;

/** Format plan price stored in cents → "$29" */
export function formatPriceCents(cents: number): string {
  const dollars = cents / 100;
  if (Number.isInteger(dollars)) return `$${dollars.toLocaleString("en-US")}`;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format ad spend / amounts in whole USD → "$1,234" */
export function formatUsd(amount: number): string {
  if (amount >= 1000) return `$${Math.round(amount).toLocaleString("en-US")}`;
  if (Number.isInteger(amount)) return `$${amount.toLocaleString("en-US")}`;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * @param unit `"plan"` = value in USD cents (subscription prices, MRR). `"USD"` = dollar amount (ad spend).
 */
export function fmtMoney(v: number, unit: "USD" | "plan" = "USD"): string {
  return unit === "plan" ? formatPriceCents(v) : formatUsd(v);
}
