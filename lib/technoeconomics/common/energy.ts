// Energy cost calculations
// Reference: docs/TEA_DESIGN.md Section 1.7

import { MJ_PER_KWH, MJ_PER_L_DIESEL } from "./constants";

/** Electricity cost for an equipment item */
export function electricityCost(
  power_kW: number,
  run_hrs_yr: number,
  price_per_kWh: number
): { kWh: number; cost: number } {
  const kWh = power_kW * run_hrs_yr;
  return { kWh, cost: kWh * price_per_kWh };
}

/** Diesel fuel cost for pump with diesel drivetrain.
 *  eta_diesel_chain = η_pump × η_drive × η_motor (typically ~0.23275) */
export function dieselCost(
  power_kW: number,
  run_hrs_yr: number,
  price_per_L: number,
  eta_diesel_chain: number
): { liters: number; cost: number } {
  const energy_MJ = power_kW * run_hrs_yr * (MJ_PER_KWH / eta_diesel_chain);
  const liters = energy_MJ / MJ_PER_L_DIESEL;
  return { liters, cost: liters * price_per_L };
}

/** Natural gas cost given annual consumption in cuft */
export function naturalGasCost(
  cuft_yr: number,
  price_per_cuft: number
): number {
  return cuft_yr * price_per_cuft;
}
