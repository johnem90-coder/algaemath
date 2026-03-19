"use client";

import type { TEAResult } from "@/lib/technoeconomics/open-pond";
import { fmtDollars, fmtPercent, fmtYears, fmtPerTon, fmtNumber } from "./formatters";

interface Props {
  result: TEAResult;
}

interface KPICard {
  label: string;
  value: string;
  sublabel?: string;
}

export function SystemSummaryCards({ result }: Props) {
  const cards: KPICard[] = [
    {
      label: "Production Ponds",
      value: fmtNumber(result.n_ponds),
      sublabel: `${fmtNumber(result.actual_production_tons_yr, 0)} tons/yr actual`,
    },
    {
      label: "Land Area",
      value: `${fmtNumber(result.land_total_acres, 0)} acres`,
      sublabel: `${fmtNumber(result.land_pond_footprint_acres, 0)} pond footprint + 20% buffer · ${fmtDollars(result.land_cost)}`,
    },
    {
      label: "Total CAPEX",
      value: fmtDollars(result.total_capex),
      sublabel: "Total capital investment",
    },
    {
      label: "Annual OPEX",
      value: fmtDollars(result.total_annual_cost),
      sublabel: "Including overhead",
    },
    {
      label: "MBSP",
      value: fmtPerTon(result.financials.mbsp),
      sublabel: "Minimum selling price (DCF)",
    },
    {
      label: "IRR at MBSP",
      value: fmtPercent(result.financials.irr),
      sublabel: `Discount rate: ${fmtPercent(result.financials.discount_rate)}`,
    },
    {
      label: "Simple Payback",
      value: fmtYears(result.financials.payback_simple_years),
      sublabel: "At MBSP sale price",
    },
    {
      label: "System Volume",
      value: `${fmtNumber(result.system_volume_m3, 0)} m\u00B3`,
      sublabel: `${fmtNumber(result.system_productivity_g_m2_day, 1)} g/m\u00B2/day`,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border px-4 py-3 space-y-0.5"
        >
          <p className="text-xs text-muted-foreground font-medium tracking-wide">
            {card.label}
          </p>
          <p className="text-lg font-semibold tracking-tight font-mono">
            {card.value}
          </p>
          {card.sublabel && (
            <p className="text-[11px] text-muted-foreground">
              {card.sublabel}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
