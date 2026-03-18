"use client";

import type { TEAResult } from "@/lib/technoeconomics/open-pond";

interface Props {
  result: TEAResult;
}

export function MBSPBreakdownTable({ result }: Props) {
  const cat = result.financials.mbsp_by_category;

  const rows = [
    { label: "Annualized CAPEX", value: cat.annualized_capex },
    { label: "Operating Cost (OPEX)", value: cat.opex },
    { label: "Overhead", value: cat.overhead },
  ];

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Category</th>
              <th className="py-2 pr-4 font-medium text-right">$/ton</th>
              <th className="py-2 font-medium text-right">% of Total</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-dashed">
                <td className="py-1.5 pr-4">{row.label}</td>
                <td className="py-1.5 pr-4 text-right">
                  ${row.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </td>
                <td className="py-1.5 text-right">
                  {((row.value / cat.total) * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1.5 pr-4">Simplified MBSP</td>
              <td className="py-1.5 pr-4 text-right">
                ${cat.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </td>
              <td className="py-1.5 text-right">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Simplified MBSP (CAPEX/lifetime + OPEX) differs from DCF-derived MBSP ($
        {result.financials.mbsp.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        /ton) because it does not account for time-value of money or depreciation tax shields.
      </p>
    </div>
  );
}
