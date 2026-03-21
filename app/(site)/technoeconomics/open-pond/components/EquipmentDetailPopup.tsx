"use client";

import { useEffect, useRef } from "react";
import type { TEAResult, EquipmentItem } from "@/lib/technoeconomics/types";
import { fmtDollarsLong, fmtNumber } from "./formatters";

interface Props {
  diagramNodeId: string;
  result: TEAResult;
  onClose: () => void;
}

function findEquipmentByNodeId(result: TEAResult, nodeId: string): {
  item: EquipmentItem;
  sectionId: string;
  sectionName: string;
} | null {
  for (const section of Object.values(result.sections)) {
    for (const item of section.equipment) {
      if (item.diagramNodeId === nodeId) {
        return { item, sectionId: section.section_id, sectionName: section.section_name };
      }
    }
  }
  return null;
}

function energyLabel(type: string): string {
  switch (type) {
    case "electricity": return "kWh/yr";
    case "diesel": return "L/yr";
    case "natural_gas": return "cuft/yr";
    default: return "";
  }
}

export function EquipmentDetailPopup({ diagramNodeId, result, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const match = findEquipmentByNodeId(result, diagramNodeId);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (!match) return null;

  const { item, sectionName } = match;
  const totalCapex = item.total_purchase_cost;
  const totalOpex = item.annual_energy_cost + item.annual_maintenance_cost;

  return (
    <div
      ref={panelRef}
      className="absolute z-50 bg-white border rounded-lg shadow-xl max-w-sm w-full"
      style={{ top: 8, right: 8 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b bg-gray-50 rounded-t-lg">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{item.name}</h3>
          <p className="text-[11px] text-gray-500">{sectionName}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-2"
        >
          &times;
        </button>
      </div>

      {/* Equipment details */}
      <div className="px-4 py-3 space-y-3 text-xs">
        {/* Identity */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <Row label="ID" value={item.id} />
          <Row label="Type" value={item.type} />
          <Row label="Function" value={item.function} />
        </div>

        {/* CAPEX */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
            Capital Cost
          </div>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-dashed">
                <td className="py-0.5 text-gray-600">Unit cost</td>
                <td className="py-0.5 text-right font-mono">{fmtDollarsLong(item.unit_cost)}</td>
              </tr>
              <tr className="border-b border-dashed">
                <td className="py-0.5 text-gray-600">Units required</td>
                <td className="py-0.5 text-right font-mono">{fmtNumber(item.units_required)}</td>
              </tr>
              <tr className="font-medium">
                <td className="py-0.5">Equipment purchase</td>
                <td className="py-0.5 text-right font-mono">{fmtDollarsLong(totalCapex)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* OPEX */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
            Annual Operating Cost
          </div>
          <table className="w-full text-xs">
            <tbody>
              {item.energy_type !== "none" && (
                <>
                  <tr className="border-b border-dashed">
                    <td className="py-0.5 text-gray-600">Energy type</td>
                    <td className="py-0.5 text-right font-mono capitalize">{item.energy_type.replace("_", " ")}</td>
                  </tr>
                  <tr className="border-b border-dashed">
                    <td className="py-0.5 text-gray-600">Annual consumption</td>
                    <td className="py-0.5 text-right font-mono">
                      {fmtNumber(item.annual_energy_units, 0)} {energyLabel(item.energy_type)}
                    </td>
                  </tr>
                  <tr className="border-b border-dashed">
                    <td className="py-0.5 text-gray-600">Energy cost</td>
                    <td className="py-0.5 text-right font-mono">{fmtDollarsLong(item.annual_energy_cost)}/yr</td>
                  </tr>
                </>
              )}
              <tr className="border-b border-dashed">
                <td className="py-0.5 text-gray-600">
                  Maintenance ({(item.maintenance_rate * 100).toFixed(0)}%)
                </td>
                <td className="py-0.5 text-right font-mono">{fmtDollarsLong(item.annual_maintenance_cost)}/yr</td>
              </tr>
              <tr className="font-medium">
                <td className="py-0.5">Total OPEX</td>
                <td className="py-0.5 text-right font-mono">{fmtDollarsLong(totalOpex)}/yr</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-span-2 flex justify-between border-b border-dashed py-0.5">
      <span className="text-gray-600">{label}</span>
      <span className="font-mono text-gray-900 text-right">{value}</span>
    </div>
  );
}
