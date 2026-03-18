"use client";

import type { TEAResult } from "@/lib/technoeconomics/open-pond";
import { fmtDollarsLong } from "./formatters";

interface Props {
  result: TEAResult;
}

const SECTION_ORDER = ["inputs", "inoculum", "biomass", "harvesting", "drying"];

export function SectionsOverviewTable({ result }: Props) {
  const sections = SECTION_ORDER.map((id) => result.sections[id]);

  // Compute totals
  const totals = {
    equipment_purchase: 0,
    install_engr_other: 0,
    capital_cost: 0,
    materials_cost: 0,
    energy_cost: 0,
    maintenance_cost: 0,
    labor_cost: 0,
    operating_cost: 0,
  };
  for (const s of sections) {
    totals.equipment_purchase += s.equipment_purchase;
    totals.install_engr_other += s.install_engr_other;
    totals.capital_cost += s.capital_cost;
    totals.materials_cost += s.materials_cost;
    totals.energy_cost += s.energy_cost;
    totals.maintenance_cost += s.maintenance_cost;
    totals.labor_cost += s.labor_cost;
    totals.operating_cost += s.operating_cost;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          {/* Top-level group headers */}
          <tr className="border-b">
            <th className="py-2 pr-4 font-medium text-left" rowSpan={2}>
              Section
            </th>
            <th
              className="py-1 px-2 font-medium text-center border-b border-l"
              colSpan={3}
            >
              Capital Costs
            </th>
            <th
              className="py-1 px-2 font-medium text-center border-b border-l"
              colSpan={5}
            >
              Operating Costs ($/yr)
            </th>
          </tr>
          {/* Sub-headers */}
          <tr className="border-b text-muted-foreground">
            <th className="py-1.5 px-2 font-medium text-right text-xs border-l">
              Equipment Purchase
            </th>
            <th className="py-1.5 px-2 font-medium text-right text-xs">
              Install, Engr &amp; Other
            </th>
            <th className="py-1.5 px-2 font-medium text-right text-xs font-semibold text-foreground">
              Total CAPEX
            </th>
            <th className="py-1.5 px-2 font-medium text-right text-xs border-l">
              Materials / Inputs
            </th>
            <th className="py-1.5 px-2 font-medium text-right text-xs">
              Energy
            </th>
            <th className="py-1.5 px-2 font-medium text-right text-xs">
              Maintenance
            </th>
            <th className="py-1.5 px-2 font-medium text-right text-xs">
              Labor
            </th>
            <th className="py-1.5 px-2 font-medium text-right text-xs font-semibold text-foreground">
              Total OPEX
            </th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {sections.map((s) => (
            <tr key={s.section_id} className="border-b border-dashed">
              <td className="py-1.5 pr-4 font-sans text-sm">
                {s.section_name}
              </td>
              <td className="py-1.5 px-2 text-right border-l">
                {fmtDollarsLong(s.equipment_purchase)}
              </td>
              <td className="py-1.5 px-2 text-right">
                {fmtDollarsLong(s.install_engr_other)}
              </td>
              <td className="py-1.5 px-2 text-right font-semibold">
                {fmtDollarsLong(s.capital_cost)}
              </td>
              <td className="py-1.5 px-2 text-right border-l">
                {fmtDollarsLong(s.materials_cost)}
              </td>
              <td className="py-1.5 px-2 text-right">
                {fmtDollarsLong(s.energy_cost)}
              </td>
              <td className="py-1.5 px-2 text-right">
                {fmtDollarsLong(s.maintenance_cost)}
              </td>
              <td className="py-1.5 px-2 text-right">
                {fmtDollarsLong(s.labor_cost)}
              </td>
              <td className="py-1.5 px-2 text-right font-semibold">
                {fmtDollarsLong(s.operating_cost)}
              </td>
            </tr>
          ))}
          {/* Totals row */}
          <tr className="border-t-2 font-semibold">
            <td className="py-2 pr-4 font-sans text-sm">Total</td>
            <td className="py-2 px-2 text-right border-l">
              {fmtDollarsLong(totals.equipment_purchase)}
            </td>
            <td className="py-2 px-2 text-right">
              {fmtDollarsLong(totals.install_engr_other)}
            </td>
            <td className="py-2 px-2 text-right">
              {fmtDollarsLong(totals.capital_cost)}
            </td>
            <td className="py-2 px-2 text-right border-l">
              {fmtDollarsLong(totals.materials_cost)}
            </td>
            <td className="py-2 px-2 text-right">
              {fmtDollarsLong(totals.energy_cost)}
            </td>
            <td className="py-2 px-2 text-right">
              {fmtDollarsLong(totals.maintenance_cost)}
            </td>
            <td className="py-2 px-2 text-right">
              {fmtDollarsLong(totals.labor_cost)}
            </td>
            <td className="py-2 px-2 text-right">
              {fmtDollarsLong(totals.operating_cost)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
