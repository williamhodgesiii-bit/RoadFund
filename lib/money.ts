const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** $1,234.56 */
export function money(cents: number): string {
  return usd.format(cents / 100);
}

/** $1,235 when the amount is whole dollars, otherwise $1,234.56 */
export function moneyShort(cents: number): string {
  return cents % 100 === 0 ? usdWhole.format(cents / 100) : usd.format(cents / 100);
}

/** Parses "$1,200", "1200.5", "1,200.50" into cents. Returns null when it isn't a number. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "" || !/^-?\d*\.?\d*$/.test(cleaned) || cleaned === "." || cleaned === "-") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Cents to an editable string: 123456 -> "1234.56", 120000 -> "1200" */
export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/**
 * Splits `total` cents across weights so the parts add up to exactly `total`
 * (largest-remainder method). Ties go to the earlier entry so results are stable.
 * All-zero weights fall back to an equal split.
 */
export function allocate(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  const basis = sum > 0 ? clean : clean.map(() => 1);
  const basisSum = sum > 0 ? sum : basis.length;

  const exact = basis.map((w) => (total * w) / basisSum);
  const floors = exact.map((x) => Math.floor(x));
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  return floors;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function pct(part: number, whole: number, digits = 1): string {
  if (whole <= 0) return "0%";
  const value = (part / whole) * 100;
  return `${value.toFixed(digits).replace(/\.0+$/, "")}%`;
}
