"use client";

import type { TEAResult } from "@/lib/technoeconomics/open-pond";
import { fmtDollarsLong } from "./formatters";

interface Props {
  result: TEAResult;
  onCellClick?: (sectionId: string, costCategory: string) => void;
  hoveredSection?: string | null;
  onHoverSection?: (sectionId: string | null) => void;
}

const SECTION_ORDER = ["inputs", "inoculum", "biomass", "harvesting", "drying"];

const COST_CATEGORIES = [
  "equipment_purchase",
  "install_engr_other",
  "capital_cost",
  "materials_cost",
  "energy_cost",
  "maintenance_cost",
  "labor_cost",
  "operating_cost",
] as const;

type CostCategory = (typeof COST_CATEGORIES)[number];

export function SectionsOverviewTable({ result, onCellClick, hoveredSection, onHoverSection }: Props) {
  const sections = SECTION_ORDER.map((id) => result.sections[id]);

  // Compute totals
  const totals = {
    equipment_purchase: 0,
    install_engr_other: 0,
    land: result.land_cost,
    capital_cost: result.land_cost,
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

  const clickable = onCellClick ? "cursor-pointer hover:bg-accent/10 transition-colors" : "";

  const handleClick = (sectionId: string, category: string) => {
    if (onCellClick) onCellClick(sectionId, category);
  };

  const renderCell = (
    sectionId: string,
    category: CostCategory,
    value: number,
    extraClass: string = ""
  ) => (
    <td
      className={`py-1.5 px-2 text-right ${extraClass} ${clickable}`}
      onClick={() => handleClick(sectionId, category)}
    >
      {fmtDollarsLong(value)}
    </td>
  );

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
          {/* Sub-headers — clickable for column-wide drill-down */}
          <tr className="border-b text-muted-foreground">
            <th
              className={`py-1.5 px-2 font-medium text-right text-xs border-l ${clickable}`}
              onClick={() => handleClick("all", "equipment_purchase")}
            >
              Equipment Purchase
            </th>
            <th
              className={`py-1.5 px-2 font-medium text-right text-xs ${clickable}`}
              onClick={() => handleClick("all", "install_engr_other")}
            >
              Install, Engr &amp; Other
            </th>
            <th
              className={`py-1.5 px-2 font-medium text-right text-xs font-semibold text-foreground ${clickable}`}
              onClick={() => handleClick("all", "capital_cost")}
            >
              Total CAPEX
            </th>
            <th
              className={`py-1.5 px-2 font-medium text-right text-xs border-l ${clickable}`}
              onClick={() => handleClick("all", "materials_cost")}
            >
              Materials / Inputs
            </th>
            <th
              className={`py-1.5 px-2 font-medium text-right text-xs ${clickable}`}
              onClick={() => handleClick("all", "energy_cost")}
            >
              Energy
            </th>
            <th
              className={`py-1.5 px-2 font-medium text-right text-xs ${clickable}`}
              onClick={() => handleClick("all", "maintenance_cost")}
            >
              Maintenance
            </th>
            <th
              className={`py-1.5 px-2 font-medium text-right text-xs ${clickable}`}
              onClick={() => handleClick("all", "labor_cost")}
            >
              Labor
            </th>
            <th
              className={`py-1.5 px-2 font-medium text-right text-xs font-semibold text-foreground ${clickable}`}
              onClick={() => handleClick("all", "operating_cost")}
            >
              Total OPEX
            </th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {sections.map((s) => (
            <tr
              key={s.section_id}
              className={`border-b border-dashed transition-colors ${hoveredSection === s.section_id ? "bg-blue-50/60" : ""}`}
              onMouseEnter={() => onHoverSection?.(s.section_id)}
              onMouseLeave={() => onHoverSection?.(null)}
            >
              <td
                className={`py-1.5 pr-4 font-sans text-sm ${clickable}`}
                onClick={() => handleClick(s.section_id, "all")}
              >
                {s.section_name}
              </td>
              {renderCell(s.section_id, "equipment_purchase", s.equipment_purchase, "border-l")}
              {renderCell(s.section_id, "install_engr_other", s.install_engr_other)}
              {renderCell(s.section_id, "capital_cost", s.capital_cost, "font-semibold")}
              {renderCell(s.section_id, "materials_cost", s.materials_cost, "border-l")}
              {renderCell(s.section_id, "energy_cost", s.energy_cost)}
              {renderCell(s.section_id, "maintenance_cost", s.maintenance_cost)}
              {renderCell(s.section_id, "labor_cost", s.labor_cost)}
              {renderCell(s.section_id, "operating_cost", s.operating_cost, "font-semibold")}
            </tr>
          ))}
          {/* Land row */}
          <tr className="border-b border-dashed">
            <td
              className={`py-1.5 pr-4 font-sans text-sm ${clickable}`}
              onClick={() => handleClick("land", "capital_cost")}
            >
              Land ({result.land_total_acres} acres)
            </td>
            <td className="py-1.5 px-2 text-right text-muted-foreground border-l">—</td>
            <td className="py-1.5 px-2 text-right text-muted-foreground">—</td>
            <td
              className={`py-1.5 px-2 text-right font-semibold ${clickable}`}
              onClick={() => handleClick("land", "capital_cost")}
            >
              {fmtDollarsLong(result.land_cost)}
            </td>
            <td className="py-1.5 px-2 text-right text-muted-foreground border-l">—</td>
            <td className="py-1.5 px-2 text-right text-muted-foreground">—</td>
            <td className="py-1.5 px-2 text-right text-muted-foreground">—</td>
            <td className="py-1.5 px-2 text-right text-muted-foreground">—</td>
            <td className="py-1.5 px-2 text-right text-muted-foreground">—</td>
          </tr>
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
