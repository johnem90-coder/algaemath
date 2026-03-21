"use client";

import { useState } from "react";
import type { TEAResult } from "@/lib/technoeconomics/open-pond";
import { fmtDollarsLong } from "./formatters";

interface Props {
  result: TEAResult;
  onCellClick?: (sectionId: string, costCategory: string) => void;
  hoveredSection?: string | null;
  activeSection?: string | null;
  activeEquipmentNodeId?: string | null;
  onHoverSection?: (sectionId: string | null) => void;
  /** When true (panel open), hide total columns and compress widths */
  compact?: boolean;
}

const SECTION_ORDER = ["inputs", "inoculum", "biomass", "harvesting", "drying", "land"];

const SECTION_LABELS: Record<string, string> = {
  inputs: "Inputs",
  inoculum: "Inoculum",
  biomass: "Biomass",
  harvesting: "Harvesting",
  drying: "Drying",
  land: "Land",
};

type CostCategory =
  | "equipment_purchase"
  | "install_engr_other"
  | "capital_cost"
  | "materials_cost"
  | "energy_cost"
  | "maintenance_cost"
  | "labor_cost"
  | "operating_cost";

export function SectionsOverviewTable({
  result,
  onCellClick,
  hoveredSection,
  activeSection,
  activeEquipmentNodeId,
  onHoverSection,
  compact = false,
}: Props) {
  const sections = SECTION_ORDER.map((id) => result.sections[id]);

  // Resolve which section the active equipment belongs to
  const equipmentSectionId = activeEquipmentNodeId
    ? SECTION_ORDER.find((sid) =>
        result.sections[sid]?.equipment.some((e) => e.diagramNodeId === activeEquipmentNodeId)
      ) ?? null
    : null;

  // A section is highlighted if hovered, or if it's the active section/equipment's section
  const highlightedSectionId = hoveredSection || equipmentSectionId || activeSection || null;

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

  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const clickable = onCellClick ? "cursor-pointer" : "";

  const handleClick = (sectionId: string, category: string) => {
    if (onCellClick) onCellClick(sectionId, category);
  };

  const cellClass = (sectionId: string, category: CostCategory, extra: string = "") => {
    const rowHl = highlightedSectionId === sectionId;
    const colHl = hoveredCategory === category;
    const hl = rowHl || colHl;
    return `py-1.5 px-2 text-right transition-colors ${extra} ${clickable} ${
      hl ? "bg-gray-100/80" : "hover:bg-gray-50/60"
    }`;
  };

  const headerClass = (category: string, extra: string = "") => {
    const colHl = hoveredCategory === category;
    return `py-1.5 px-2 font-medium text-right text-xs ${extra} ${clickable} ${
      colHl ? "bg-gray-100/80" : "hover:bg-gray-50/60"
    }`;
  };

  const renderCell = (
    sectionId: string,
    category: CostCategory,
    value: number,
    extra: string = ""
  ) => (
    <td
      className={cellClass(sectionId, category, extra)}
      onClick={() => handleClick(sectionId, category)}
    >
      {fmtDollarsLong(value)}
    </td>
  );

  // In compact mode, hide Total CAPEX and Total OPEX columns
  const showTotals = !compact;

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm border-collapse">
        <thead>
          {/* Top-level group headers */}
          <tr className="border-b">
            <th className="py-2 px-3 font-medium text-left" rowSpan={2}>
              Section
            </th>
            <th
              className="py-1 px-2 font-medium text-center border-b border-l"
              colSpan={showTotals ? 3 : 2}
            >
              Capital Costs
            </th>
            <th
              className="py-1 px-2 font-medium text-center border-b border-l"
              colSpan={showTotals ? 5 : 4}
            >
              Operating Costs ($/yr)
            </th>
          </tr>
          {/* Sub-headers — clickable for column-wide drill-down, hoverable for column highlight */}
          <tr className="border-b text-muted-foreground" onMouseLeave={() => setHoveredCategory(null)}>
            <th
              className={headerClass("equipment_purchase", "border-l")}
              onMouseEnter={() => setHoveredCategory("equipment_purchase")}
              onClick={() => handleClick("all", "equipment_purchase")}
            >
              Equipment
            </th>
            <th
              className={headerClass("install_engr_other")}
              onMouseEnter={() => setHoveredCategory("install_engr_other")}
              onClick={() => handleClick("all", "install_engr_other")}
            >
              Install &amp; Engr
            </th>
            {showTotals && (
              <th
                className={headerClass("capital_cost", "font-semibold text-foreground")}
                onMouseEnter={() => setHoveredCategory("capital_cost")}
                onClick={() => handleClick("all", "capital_cost")}
              >
                CAPEX
              </th>
            )}
            <th
              className={headerClass("materials_cost", "border-l")}
              onMouseEnter={() => setHoveredCategory("materials_cost")}
              onClick={() => handleClick("all", "materials_cost")}
            >
              Materials
            </th>
            <th
              className={headerClass("energy_cost")}
              onMouseEnter={() => setHoveredCategory("energy_cost")}
              onClick={() => handleClick("all", "energy_cost")}
            >
              Energy
            </th>
            <th
              className={headerClass("maintenance_cost")}
              onMouseEnter={() => setHoveredCategory("maintenance_cost")}
              onClick={() => handleClick("all", "maintenance_cost")}
            >
              Maint.
            </th>
            <th
              className={headerClass("labor_cost")}
              onMouseEnter={() => setHoveredCategory("labor_cost")}
              onClick={() => handleClick("all", "labor_cost")}
            >
              Labor
            </th>
            {showTotals && (
              <th
                className={headerClass("operating_cost", "font-semibold text-foreground")}
                onMouseEnter={() => setHoveredCategory("operating_cost")}
                onClick={() => handleClick("all", "operating_cost")}
              >
                OPEX
              </th>
            )}
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {sections.map((s) => {
            const isHighlighted = highlightedSectionId === s.section_id;
            return (
              <tr
                key={s.section_id}
                className={`border-b border-dashed transition-colors ${
                  isHighlighted ? "bg-gray-100/80" : ""
                }`}
                onMouseEnter={() => onHoverSection?.(s.section_id)}
                onMouseLeave={() => onHoverSection?.(null)}
              >
                <td
                  className={`py-1.5 px-3 font-sans text-sm ${clickable} ${
                    isHighlighted ? "font-medium" : ""
                  }`}
                  onClick={() => handleClick(s.section_id, "all")}
                >
                  {SECTION_LABELS[s.section_id] ?? s.section_name}
                </td>
                {renderCell(s.section_id, "equipment_purchase", s.equipment_purchase, "border-l")}
                {renderCell(s.section_id, "install_engr_other", s.install_engr_other)}
                {showTotals && renderCell(s.section_id, "capital_cost", s.capital_cost, "font-semibold")}
                {renderCell(s.section_id, "materials_cost", s.materials_cost, "border-l")}
                {renderCell(s.section_id, "energy_cost", s.energy_cost)}
                {renderCell(s.section_id, "maintenance_cost", s.maintenance_cost)}
                {renderCell(s.section_id, "labor_cost", s.labor_cost)}
                {showTotals && renderCell(s.section_id, "operating_cost", s.operating_cost, "font-semibold")}
              </tr>
            );
          })}
          {/* Totals row */}
          <tr className="border-t-2 font-semibold">
            <td className="py-2 px-3 font-sans text-sm">Total</td>
            <td className={`py-2 px-2 text-right border-l transition-colors ${hoveredCategory === "equipment_purchase" ? "bg-gray-100/80" : ""}`}>
              {fmtDollarsLong(totals.equipment_purchase)}
            </td>
            <td className={`py-2 px-2 text-right transition-colors ${hoveredCategory === "install_engr_other" ? "bg-gray-100/80" : ""}`}>
              {fmtDollarsLong(totals.install_engr_other)}
            </td>
            {showTotals && (
              <td className={`py-2 px-2 text-right transition-colors ${hoveredCategory === "capital_cost" ? "bg-gray-100/80" : ""}`}>
                {fmtDollarsLong(totals.capital_cost)}
              </td>
            )}
            <td className={`py-2 px-2 text-right border-l transition-colors ${hoveredCategory === "materials_cost" ? "bg-gray-100/80" : ""}`}>
              {fmtDollarsLong(totals.materials_cost)}
            </td>
            <td className={`py-2 px-2 text-right transition-colors ${hoveredCategory === "energy_cost" ? "bg-gray-100/80" : ""}`}>
              {fmtDollarsLong(totals.energy_cost)}
            </td>
            <td className={`py-2 px-2 text-right transition-colors ${hoveredCategory === "maintenance_cost" ? "bg-gray-100/80" : ""}`}>
              {fmtDollarsLong(totals.maintenance_cost)}
            </td>
            <td className={`py-2 px-2 text-right transition-colors ${hoveredCategory === "labor_cost" ? "bg-gray-100/80" : ""}`}>
              {fmtDollarsLong(totals.labor_cost)}
            </td>
            {showTotals && (
              <td className={`py-2 px-2 text-right transition-colors ${hoveredCategory === "operating_cost" ? "bg-gray-100/80" : ""}`}>
                {fmtDollarsLong(totals.operating_cost)}
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
