"use client";

import { useState } from "react";
import type { TEAResult } from "@/lib/technoeconomics/open-pond";
import { fmtDollarsLong } from "./formatters";

interface Props {
  result: TEAResult;
}

export function CashFlowTable({ result }: Props) {
  const [expanded, setExpanded] = useState(false);
  const flows = result.financials.cash_flows;

  // Show summary rows when collapsed, full table when expanded
  const SUMMARY_YEARS = [0, 1, 2, 5, 10, 15, 20, 25, 30];
  const displayRows = expanded
    ? flows
    : flows.filter((cf) => SUMMARY_YEARS.includes(cf.year));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Year</th>
              <th className="py-2 pr-3 font-medium text-right">Revenue</th>
              <th className="py-2 pr-3 font-medium text-right">COGS</th>
              <th className="py-2 pr-3 font-medium text-right">Gross Profit</th>
              <th className="py-2 pr-3 font-medium text-right">Depreciation</th>
              <th className="py-2 pr-3 font-medium text-right">Taxes</th>
              <th className="py-2 pr-3 font-medium text-right">Net Income</th>
              <th className="py-2 pr-3 font-medium text-right">FCF</th>
              <th className="py-2 font-medium text-right">Cumul. DCF</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {displayRows.map((cf) => {
              const isNeg = cf.cumulative_dcf < 0;
              return (
                <tr
                  key={cf.year}
                  className={`border-b border-dashed ${cf.year === 0 ? "bg-muted/30" : ""}`}
                >
                  <td className="py-1.5 pr-3 font-sans text-sm font-medium">
                    {cf.year}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {cf.year === 0 ? "—" : fmtDollarsLong(cf.revenue)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {cf.year === 0 ? "—" : fmtDollarsLong(cf.cogs)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {cf.year === 0 ? "—" : fmtDollarsLong(cf.gross_profit)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {fmtDollarsLong(cf.depreciation)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {fmtDollarsLong(cf.taxes)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {cf.year === 0 ? "—" : fmtDollarsLong(cf.net_income)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {fmtDollarsLong(cf.free_cash_flow)}
                  </td>
                  <td
                    className={`py-1.5 text-right ${isNeg ? "text-red-600 dark:text-red-400" : ""}`}
                  >
                    {fmtDollarsLong(cf.cumulative_dcf)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? "Show summary rows" : `Show all ${flows.length} years`}
      </button>
    </div>
  );
}
