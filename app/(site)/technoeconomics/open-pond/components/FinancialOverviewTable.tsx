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

function RowGroup({ title, rows, isFirst }: { title: string; rows: Row[]; isFirst?: boolean }) {
  return (
    <>
      <tr>
        <td
          colSpan={2}
          className={`${isFirst ? "pt-0" : "pt-6"} pb-1 font-sans text-[10px] font-medium text-muted-foreground tracking-wider`}
        >
          {title}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.label} className="border-b border-dashed">
          <td className="py-1 pr-3 font-sans text-sm">{row.label}</td>
          <td className="py-1 text-right whitespace-nowrap">{row.value}</td>
        </tr>
      ))}
    </>
  );
}

export function FinancialOverviewTable({ result }: Props) {
  const cat = result.financials.mbsp_by_category;

  const scaleRows: Row[] = [
    { label: "Production Ponds", value: fmtNumber(result.n_ponds) },
    { label: "Annual Production", value: `${fmtNumber(result.actual_production_tons_yr, 0)} tons/yr` },
    { label: "Land Area", value: `${fmtNumber(result.land_total_acres, 0)} acres` },
    { label: "Productivity", value: `${fmtNumber(result.system_productivity_g_m2_day, 1)} g/m\u00B2/day` },
  ];

  const costRows: Row[] = [
    { label: "Total CAPEX", value: fmtDollars(result.total_capex) },
    { label: "Annual OPEX", value: fmtDollars(result.total_annual_cost) },
    { label: "CAPEX/ton (annualized)", value: fmtPerTon(cat.annualized_capex) },
    { label: "OPEX/ton", value: fmtPerTon(cat.opex + cat.overhead) },
  ];

  const finRows: Row[] = [
    { label: "MBSP", value: fmtPerTon(result.financials.mbsp) },
    { label: "MBSP/kg", value: `$${(result.financials.mbsp / 1000).toFixed(2)}/kg` },
  ];

  return (
    <table className="w-full text-sm border-collapse">
      <tbody className="font-mono text-xs">
        <RowGroup title="Project Scale" rows={scaleRows} isFirst />
        <RowGroup title="Capital & Operating" rows={costRows} />
        <RowGroup title="Key Metrics" rows={finRows} />
      </tbody>
    </table>
  );
}
