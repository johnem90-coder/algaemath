// Stream type definitions for diagram-driven TEA engine
// Each edge in the diagram carries a streamType that tells the engine
// what material flows between equipment and at what rate.

import type { TEAConfig, PondGeometryTEA, NutrientBalance } from "../types";

// ── Stream Type IDs ──────────────────────────────────────────────

export type StreamTypeId =
  | "raw-water"
  | "filtered-water"
  | "nutrient-solution"
  | "co2-supply"
  | "kno3-supply"
  | "dap-supply"
  | "micro-supply"
  | "culture"
  | "biomass-slurry"
  | "filtrate-return"
  | "dry-product"
  | "inoculum";

// ── Stream metadata ──────────────────────────────────────────────

export interface StreamTypeDef {
  id: StreamTypeId;
  label: string;
  unit: string;
}

export const STREAM_TYPES: StreamTypeDef[] = [
  { id: "raw-water", label: "Raw Water", unit: "m³/day" },
  { id: "filtered-water", label: "Filtered Water", unit: "m³/day" },
  { id: "nutrient-solution", label: "Nutrient Solution", unit: "m³/day" },
  { id: "co2-supply", label: "CO₂ Supply", unit: "tons/day" },
  { id: "kno3-supply", label: "KNO₃ Supply", unit: "tons/day" },
  { id: "dap-supply", label: "DAP Supply", unit: "tons/day" },
  { id: "micro-supply", label: "Micronutrient Supply", unit: "tons/day" },
  { id: "culture", label: "Algae Culture", unit: "m³/day" },
  { id: "biomass-slurry", label: "Biomass Slurry", unit: "m³/day" },
  { id: "filtrate-return", label: "Filtrate Return", unit: "m³/day" },
  { id: "dry-product", label: "Dry Product", unit: "tons/day" },
  { id: "inoculum", label: "Inoculum", unit: "-" },
];

// ── Compute global flow rates ────────────────────────────────────
// These are pre-computed from config/geometry/nutrients and mapped
// to edges via their streamType. Equipment sizing functions use the
// incoming flow from their connected edges.

export function computeGlobalFlows(
  config: TEAConfig,
  geometry: PondGeometryTEA,
  nutrients: NutrientBalance
): Map<StreamTypeId, number> {
  const V_transfer_daily = geometry.V_system_m3 * config.effective_growth_rate_per_day;
  const daily_production_tons = geometry.Q_actual_tons_yr / config.active_days_yr;
  const daily_wet_input_tons = daily_production_tons / (1 - config.dryer_inlet_water_content);

  return new Map<StreamTypeId, number>([
    ["raw-water", nutrients.water_m3_day],
    ["filtered-water", nutrients.water_m3_day],
    ["nutrient-solution", nutrients.slurry_m3_day],
    ["co2-supply", nutrients.co2_tons_day],
    ["kno3-supply", nutrients.kno3_tons_day],
    ["dap-supply", nutrients.dap_tons_day],
    ["micro-supply", nutrients.micro_tons_day],
    ["culture", V_transfer_daily],
    ["biomass-slurry", V_transfer_daily * (1 - config.filter3_efficiency)],
    ["filtrate-return", V_transfer_daily * config.harvest_efficiency],
    ["dry-product", daily_production_tons],
    ["inoculum", 0],
  ]);
}
