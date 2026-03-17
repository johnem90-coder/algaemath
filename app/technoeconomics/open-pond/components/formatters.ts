// Number formatting utilities for TEA display

/** Format dollar amounts: $X.XXM for millions, $X.XXK for thousands */
export function fmtDollars(n: number): string {
  if (Math.abs(n) >= 1e6) {
    return `$${(n / 1e6).toFixed(2)}M`;
  }
  if (Math.abs(n) >= 1e3) {
    return `$${(n / 1e3).toFixed(1)}K`;
  }
  return `$${n.toFixed(0)}`;
}

/** Format dollar amounts with full precision for tables */
export function fmtDollarsLong(n: number): string {
  if (n < 0) return `-$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** Format percentage (input as fraction, e.g. 0.10 → "10.0%") */
export function fmtPercent(n: number): string {
  if (!isFinite(n)) return "N/A";
  return `${(n * 100).toFixed(1)}%`;
}

/** Format tons with comma separators */
export function fmtTons(n: number): string {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} tons`;
}

/** Format number with comma separators and optional decimals */
export function fmtNumber(n: number, decimals: number = 0): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

/** Format years (e.g. "5.2 yrs") */
export function fmtYears(n: number): string {
  if (!isFinite(n) || n > 100) return "> 30 yrs";
  return `${n.toFixed(1)} yrs`;
}

/** Format $/ton */
export function fmtPerTon(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}/ton`;
}
