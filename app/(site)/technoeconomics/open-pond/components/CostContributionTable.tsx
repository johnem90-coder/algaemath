"use client";

import type { TEAResult } from "@/lib/technoeconomics/open-pond";

interface Props {
  result: TEAResult;
}

export function CostContributionTable({ result }: Props) {
  const rows = result.financials.mbsp_by_section;

  const totals = rows.reduce(
    (acc, row) => ({
      capex: acc.capex + row.capex_per_ton,
      opex: acc.opex + row.opex_per_ton,
      total: acc.total + row.total_per_ton,
      pct: acc.pct + row.percent_of_mbsp,
    }),
    { capex: 0, opex: 0, total: 0, pct: 0 }
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Section</th>
            <th className="py-2 pr-4 font-medium text-right">CAPEX $/ton</th>
            <th className="py-2 pr-4 font-medium text-right">OPEX $/ton</th>
            <th className="py-2 pr-4 font-medium text-right">Total $/ton</th>
            <th className="py-2 font-medium text-right">% of MBSP</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {rows.map((row) => (
            <tr key={row.section_id} className="border-b border-dashed">
              <td className="py-1.5 pr-4 font-sans text-sm">{row.section_name}</td>
              <td className="py-1.5 pr-4 text-right">
                ${row.capex_per_ton.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </td>
              <td className="py-1.5 pr-4 text-right">
                ${row.opex_per_ton.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </td>
              <td className="py-1.5 pr-4 text-right">
                ${row.total_per_ton.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </td>
              <td className="py-1.5 text-right">
                {row.percent_of_mbsp.toFixed(1)}%
              </td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold">
            <td className="py-2 pr-4 font-sans text-sm">Total</td>
            <td className="py-2 pr-4 text-right">
              ${totals.capex.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </td>
            <td className="py-2 pr-4 text-right">
              ${totals.opex.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </td>
            <td className="py-2 pr-4 text-right">
              ${totals.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </td>
            <td className="py-2 text-right">
              {totals.pct.toFixed(1)}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
