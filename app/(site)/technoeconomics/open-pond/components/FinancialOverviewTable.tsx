"use client";

import type { TEAResult } from "@/lib/technoeconomics/open-pond";
import { fmtDollars, fmtPercent, fmtPerTon, fmtYears } from "./formatters";

interface Props {
  result: TEAResult;
  salePricePerKg: number;
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

type SensRows = TEAResult["financials"]["sensitivity"];

/** Linear interpolation of a numeric field from sensitivity rows at the given sale price ($/ton). */
function interpolate(rows: SensRows, salePricePerTon: number, field: keyof SensRows[number] & string): number {
  const sorted = [...rows].sort((a, b) => a.sale_price - b.sale_price);
  const below = [...sorted].reverse().find((r) => r.sale_price <= salePricePerTon);
  const above = sorted.find((r) => r.sale_price > salePricePerTon);
  if (!below) return (above?.[field] as number) ?? 0;
  if (!above) return below[field] as number;
  const t = (salePricePerTon - below.sale_price) / (above.sale_price - below.sale_price);
  return (below[field] as number) + t * ((above[field] as number) - (below[field] as number));
}

export function FinancialOverviewTable({ result, salePricePerKg }: Props) {
  const salePricePerTon = salePricePerKg * 1000;
  const q = result.actual_production_tons_yr;
  const annualRevenue = salePricePerTon * q;
  const annualProfit = annualRevenue - result.total_annual_cost;
  const irr = interpolate(result.financials.sensitivity, salePricePerTon, "irr");
  const paybackYears = interpolate(result.financials.sensitivity, salePricePerTon, "payback_simple_years");

  const costRows: Row[] = [
    { label: "Total CAPEX", value: fmtDollars(result.total_capex) },
    { label: "Annual OPEX", value: fmtDollars(result.total_annual_cost) },
    { label: "Annual Revenue", value: fmtDollars(annualRevenue) },
    { label: "Annual Profit", value: fmtDollars(annualProfit) },
  ];

  const finRows: Row[] = [
    { label: "MBSP", value: fmtPerTon(result.financials.mbsp) },
    { label: "Sale Price", value: fmtPerTon(salePricePerTon) },
    { label: "IRR", value: fmtPercent(irr) },
    { label: "Simple Payback", value: fmtYears(paybackYears) },
    { label: "Capital Intensity", value: `${fmtPerTon(result.financials.capital_intensity)}/yr` },
  ];

  return (
    <div className="space-y-4">
      <MiniTable title="Capital & Operating" rows={costRows} />
      <MiniTable title="Key Metrics" rows={finRows} />
    </div>
  );
}
