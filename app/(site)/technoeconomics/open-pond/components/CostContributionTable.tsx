"use client";

import type { TEAResult } from "@/lib/technoeconomics/open-pond";

interface Props {
  result: TEAResult;
}

function fmt(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function CostContributionTable({ result }: Props) {
  const rows = result.financials.mbsp_by_section;
  const mbsp = result.financials.mbsp;
  const overheadPerTon = result.config.overhead_per_ton;

  // Sum all undiscounted costs (sections + overhead) to normalize percentages
  const sectionCapex = rows.reduce((s, r) => s + r.capex_per_ton, 0);
  const sectionOpex = rows.reduce((s, r) => s + r.opex_per_ton, 0);
  const totalUndiscounted = sectionCapex + sectionOpex + overheadPerTon;

  // The difference between MBSP and undiscounted total is the financial adjustment
  // (taxes, depreciation, working capital, construction staging effects)
  const financeAdjustment = mbsp - totalUndiscounted;

  // Compute percentage of MBSP for each row
  const pct = (val: number) => mbsp > 0 ? (val / mbsp) * 100 : 0;

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-1">
        Cost Contribution
      </h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1.5 pr-1 font-medium text-xs">Section</th>
            <th className="py-1.5 pr-1 font-medium text-xs text-right">CAPEX</th>
            <th className="py-1.5 pr-1 font-medium text-xs text-right">OPEX</th>
            <th className="py-1.5 pr-1 font-medium text-xs text-right">Total</th>
            <th className="py-1.5 font-medium text-xs text-right">%</th>
          </tr>
        </thead>
        <tbody className="font-mono text-[11px]">
          {rows.map((row) => (
            <tr key={row.section_id} className="border-b border-dashed">
              <td className="py-1 pr-1 font-sans text-xs">{row.section_name}</td>
              <td className="py-1 pr-1 text-right text-muted-foreground">{fmt(row.capex_per_ton)}</td>
              <td className="py-1 pr-1 text-right text-muted-foreground">{fmt(row.opex_per_ton)}</td>
              <td className="py-1 pr-1 text-right">{fmt(row.total_per_ton)}</td>
              <td className="py-1 text-right text-muted-foreground">{pct(row.total_per_ton).toFixed(1)}%</td>
            </tr>
          ))}
          {/* Overhead */}
          <tr className="border-b border-dashed">
            <td className="py-1 pr-1 font-sans text-xs">Overhead</td>
            <td className="py-1 pr-1 text-right text-muted-foreground">—</td>
            <td className="py-1 pr-1 text-right text-muted-foreground">{fmt(overheadPerTon)}</td>
            <td className="py-1 pr-1 text-right">{fmt(overheadPerTon)}</td>
            <td className="py-1 text-right text-muted-foreground">{pct(overheadPerTon).toFixed(1)}%</td>
          </tr>
          {/* Financial adjustment (taxes, depreciation, working capital) */}
          {Math.abs(financeAdjustment) > 1 && (
            <tr className="border-b border-dashed">
              <td className="py-1 pr-1 font-sans text-xs text-muted-foreground">Taxes &amp; Finance</td>
              <td className="py-1 pr-1 text-right text-muted-foreground">—</td>
              <td className="py-1 pr-1 text-right text-muted-foreground">—</td>
              <td className="py-1 pr-1 text-right">{fmt(financeAdjustment)}</td>
              <td className="py-1 text-right text-muted-foreground">{pct(financeAdjustment).toFixed(1)}%</td>
            </tr>
          )}
          {/* Total = MBSP */}
          <tr className="border-t-2 font-semibold">
            <td className="py-1.5 pr-1 font-sans text-xs">MBSP</td>
            <td className="py-1.5 pr-1 text-right text-muted-foreground">{fmt(sectionCapex)}</td>
            <td className="py-1.5 pr-1 text-right text-muted-foreground">{fmt(sectionOpex + overheadPerTon)}</td>
            <td className="py-1.5 pr-1 text-right">{fmt(mbsp)}</td>
            <td className="py-1.5 text-right text-muted-foreground">100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
