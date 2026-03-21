"use client";

import type { TEAResult } from "@/lib/technoeconomics/open-pond";
import { fmtDollars, fmtNumber, fmtPerTon } from "./formatters";

interface Props {
  result: TEAResult;
}

interface Row {
  label: string;
  value: string;
}

function MiniTable({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1.5 pr-4 font-medium text-xs">Parameter</th>
            <th className="py-1.5 font-medium text-xs text-right">Value</th>
          </tr>
        </thead>
        <tbody className="font-mono text-[11px]">
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-dashed">
              <td className="py-1 pr-4 font-sans text-xs">{row.label}</td>
              <td className="py-1 text-right whitespace-nowrap">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FinancialOverviewTable({ result }: Props) {
  const scaleRows: Row[] = [
    { label: "Production Ponds", value: fmtNumber(result.n_ponds) },
    { label: "Annual Production", value: `${fmtNumber(result.actual_production_tons_yr, 0)} tons/yr` },
    { label: "Land Area", value: `${fmtNumber(result.land_total_acres, 0)} acres` },
    { label: "Productivity", value: `${fmtNumber(result.system_productivity_g_m2_day, 1)} g/m\u00B2/day` },
  ];

  const costRows: Row[] = [
    { label: "Total CAPEX", value: fmtDollars(result.total_capex) },
    { label: "Annual OPEX", value: fmtDollars(result.total_annual_cost) },
  ];

  const finRows: Row[] = [
    { label: "MBSP", value: fmtPerTon(result.financials.mbsp) },
  ];

  return (
    <div className="space-y-4">
      <MiniTable title="Project Scale" rows={scaleRows} />
      <MiniTable title="Capital & Operating" rows={costRows} />
      <MiniTable title="Key Metrics" rows={finRows} />
    </div>
  );
}
