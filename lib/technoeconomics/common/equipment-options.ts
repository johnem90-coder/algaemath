// Shared equipment size option catalogs
// Used by all sections for constraint-based sizing

import { tankCost2022 } from "./cost-escalation";

// ── Types ──────────────────────────────────────────────────────

export interface TankSizeOption {
  capacity_m3: number;
  unit_cost: number;
}

export interface PumpSizeOption {
  label: string;
  available_flow_Ls: number;
  power_kW: number;
  unit_cost: number;
  energy_type: "diesel" | "electricity";
}

export interface FilterSizeOption {
  capacity_GPD: number;
  power_kW: number;
  unit_cost: number;
  run_hrs_day: number;
}

export interface HopperSizeOption {
  capacity_gal: number;
  unit_cost: number;
}

export interface MixTankSizeOption {
  capacity_gal: number;
  tank_cost: number;
  propeller_cost: number;
  power_kW: number;
}

export interface SludgePumpSizeOption {
  label: string;
  available_m3_hr: number;
  power_kW: number;
  unit_cost: number;
}

// ── Pump Catalog (unified, all sections) ───────────────────────
// Ordered smallest → largest flow

// Water pumps only — slurry/sludge pumps are a separate category (see drying section)
export const PUMP_CATALOG: PumpSizeOption[] = [
  { label: "Centrifugal (electric)", available_flow_Ls: 1.5, power_kW: 1.3, unit_cost: 637.44, energy_type: "electricity" },
  { label: "Twin Impeller (diesel)", available_flow_Ls: 5.0, power_kW: 4.84705, unit_cost: 1133.23, energy_type: "diesel" },
  { label: "Small Diesel", available_flow_Ls: 26.67, power_kW: 7.457, unit_cost: 1204.06, energy_type: "diesel" },
  { label: "Large Diesel", available_flow_Ls: 41.67, power_kW: 8.2027, unit_cost: 1345.71, energy_type: "diesel" },
];

// ── Tank Catalog ───────────────────────────────────────────────
// Ordered smallest → largest capacity

export const TANK_CATALOG: TankSizeOption[] = [
  { capacity_m3: 700, unit_cost: tankCost2022(700) },
  { capacity_m3: 2000, unit_cost: tankCost2022(2000) },
  { capacity_m3: 4000, unit_cost: tankCost2022(4000) },
];

// ── Filter Catalog ─────────────────────────────────────────────

export const FILTER_CATALOG: FilterSizeOption[] = [
  { capacity_GPD: 40000, power_kW: 6.0, unit_cost: 44345, run_hrs_day: 20 },
];

// ── Sludge Pump Catalog (biomass slurry — separate from water pumps) ──

export const SLUDGE_PUMP_CATALOG: SludgePumpSizeOption[] = [
  { label: "Sludge Pump 20 m³/hr", available_m3_hr: 20, power_kW: 15.0, unit_cost: 1000 },
];

// ── Hopper Catalogs ────────────────────────────────────────────

export const KNO3_HOPPER_CATALOG: HopperSizeOption[] = [
  { capacity_gal: 80, unit_cost: 280 },
  { capacity_gal: 160, unit_cost: 504 },
];

export const DAP_HOPPER_CATALOG: HopperSizeOption[] = [
  { capacity_gal: 8, unit_cost: 65 },
  { capacity_gal: 15, unit_cost: 117 },
];

export const MICRO_HOPPER_CATALOG: HopperSizeOption[] = [
  { capacity_gal: 2, unit_cost: 35 },
  { capacity_gal: 3.5, unit_cost: 57.33 },
];

// ── Mix Tank Catalog ───────────────────────────────────────────

export const MIX_TANK_CATALOG: MixTankSizeOption[] = [
  { capacity_gal: 510, tank_cost: 890, propeller_cost: 577.19, power_kW: 0.37285 },
];

// ── Sizing Functions ───────────────────────────────────────────

/** Pick the best tank: largest that keeps units ≤ max_units. */
export function sizeTank(
  required_m3: number,
  options: TankSizeOption[] = TANK_CATALOG,
  max_units: number = 50
): { option: TankSizeOption; units: number } {
  for (const opt of [...options].reverse()) {
    const units = Math.ceil(required_m3 / opt.capacity_m3);
    if (units <= max_units) return { option: opt, units };
  }
  const fallback = options[options.length - 1];
  return { option: fallback, units: Math.ceil(required_m3 / fallback.capacity_m3) };
}

/** Pick best pump + run time combo. Tries run_hrs (ascending) × pump sizes (ascending).
 *  Picks first combo with units ≤ max_units. */
export function sizePumpByFlow(
  required_volume_L: number,
  run_hrs_options: number[],
  options: PumpSizeOption[] = PUMP_CATALOG,
  max_units: number = 20,
  min_flow_Ls: number = 0
): { option: PumpSizeOption; units: number; run_hrs_day: number } {
  for (const run_hrs of run_hrs_options) {
    const volume_flow_Ls = required_volume_L / (run_hrs * 3600);
    const required_flow = Math.max(min_flow_Ls, volume_flow_Ls);
    for (const opt of options) {
      const units = Math.ceil(required_flow / opt.available_flow_Ls);
      if (units <= max_units) return { option: opt, units, run_hrs_day: run_hrs };
    }
  }
  const fallback = options[options.length - 1];
  const run_hrs = run_hrs_options[run_hrs_options.length - 1];
  const required_flow = Math.max(min_flow_Ls, required_volume_L / (run_hrs * 3600));
  return {
    option: fallback,
    units: Math.ceil(required_flow / fallback.available_flow_Ls),
    run_hrs_day: run_hrs,
  };
}

/** Pick best filter where units ≤ max_units. */
export function sizeFilter(
  required_GPD: number,
  options: FilterSizeOption[] = FILTER_CATALOG,
  max_units: number = 100
): { option: FilterSizeOption; units: number } {
  for (const opt of options) {
    const units = Math.ceil(required_GPD / opt.capacity_GPD);
    if (units <= max_units) return { option: opt, units };
  }
  const fallback = options[options.length - 1];
  return { option: fallback, units: Math.ceil(required_GPD / fallback.capacity_GPD) };
}

/** Pick hopper: try 2-ponds-per-hopper, fall back to 1-per-pond. */
export function sizeHopper(
  daily_demand_per_pond_tons: number,
  buffer_days: number,
  material_density_tons_m3: number,
  n_ponds: number,
  options: HopperSizeOption[]
): { option: HopperSizeOption; units: number; ponds_per_hopper: number } {
  const GAL_TO_L = 3.78541;
  const demand_2_ponds_gal =
    (daily_demand_per_pond_tons * 2 * buffer_days * 1000) / (material_density_tons_m3 * GAL_TO_L);

  for (const opt of options) {
    if (demand_2_ponds_gal <= opt.capacity_gal) {
      return { option: opt, units: Math.ceil(n_ponds / 2), ponds_per_hopper: 2 };
    }
  }

  const demand_1_pond_gal =
    (daily_demand_per_pond_tons * 1 * buffer_days * 1000) / (material_density_tons_m3 * GAL_TO_L);
  for (const opt of options) {
    if (demand_1_pond_gal <= opt.capacity_gal) {
      return { option: opt, units: n_ponds, ponds_per_hopper: 1 };
    }
  }

  const fallback = options[options.length - 1];
  return { option: fallback, units: n_ponds, ponds_per_hopper: 1 };
}

/** Pick mix tank: 1 per 2 ponds. */
export function sizeMixTank(
  n_ponds: number,
  options: MixTankSizeOption[] = MIX_TANK_CATALOG
): { option: MixTankSizeOption; units: number } {
  const opt = options[0];
  return { option: opt, units: Math.ceil(n_ponds / 2) };
}

/** Pick sludge pump: smallest pump where units ≤ max_units for the required flow. */
export function sizeSludgePump(
  required_m3_hr: number,
  options: SludgePumpSizeOption[] = SLUDGE_PUMP_CATALOG,
  max_units: number = 20
): { option: SludgePumpSizeOption; units: number } {
  for (const opt of options) {
    const units = Math.ceil(required_m3_hr / opt.available_m3_hr);
    if (units <= max_units) return { option: opt, units };
  }
  const fallback = options[options.length - 1];
  return { option: fallback, units: Math.ceil(required_m3_hr / fallback.available_m3_hr) };
}
