"use client";

import type { TEAResult } from "@/lib/technoeconomics/open-pond";
import { fmtDollarsLong, fmtPercent } from "./formatters";

interface Props {
  result: TEAResult;
}

export function SensitivityTable({ result }: Props) {
  const rows = result.financials.sensitivity;
  const mbsp = result.financials.mbsp;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Sale Price ($/ton)</th>
            <th className="py-2 pr-4 font-medium text-right">Revenue</th>
            <th className="py-2 pr-4 font-medium text-right">Gross Profit</th>
            <th className="py-2 pr-4 font-medium text-right">Net Income (Yr 1)</th>
            <th className="py-2 pr-4 font-medium text-right">Net Margin</th>
            <th className="py-2 font-medium text-right">NPV</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {rows.map((row) => {
            const isNearMBSP =
              Math.abs(row.sale_price - mbsp) <=
              Math.min(...rows.map((r) => Math.abs(r.sale_price - mbsp))) + 1;
            return (
              <tr
                key={row.sale_price}
                className={`border-b border-dashed ${
                  isNearMBSP
                    ? "bg-[hsl(var(--accent-science-muted))]"
                    : ""
                }`}
              >
                <td className="py-1.5 pr-4 font-sans text-sm">
                  ${row.sale_price.toLocaleString("en-US")}
                  {isNearMBSP && (
                    <span className="ml-2 text-[10px] text-[hsl(var(--accent-science))] font-medium">
                      MBSP
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-4 text-right">
                  {fmtDollarsLong(row.revenue)}
                </td>
                <td className="py-1.5 pr-4 text-right">
                  {fmtDollarsLong(row.gross_profit)}
                </td>
                <td className="py-1.5 pr-4 text-right">
                  {fmtDollarsLong(row.net_income)}
                </td>
                <td className="py-1.5 pr-4 text-right">
                  {fmtPercent(row.net_profit_margin)}
                </td>
                <td
                  className={`py-1.5 text-right ${
                    row.npv < 0
                      ? "text-red-600 dark:text-red-400"
                      : ""
                  }`}
                >
                  {fmtDollarsLong(row.npv)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        Row highlighted nearest MBSP (${mbsp.toLocaleString("en-US", { maximumFractionDigits: 0 })}/ton) — the sale price where NPV = 0.
      </p>
    </div>
  );
}
