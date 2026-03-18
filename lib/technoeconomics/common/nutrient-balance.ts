// Nutrient stoichiometry and water demand
// Reference: docs/TEA_DESIGN.md Section 1.3

import type { TEAConfig, PondGeometryTEA, NutrientBalance } from "../types";
import {
  MW_CO2,
  AW_C,
  AW_N,
  AW_P,
  MW_KNO3,
  MW_DAP,
  ACRES_TO_M2,
} from "./constants";

/**
 * Compute stoichiometric nutrient demand and water balance.
 *
 * For each element: molecule_demand (g/g BM) = element_frac × (MW_source / AW_element) / η_uptake
 * Then scale to daily and annual.
 */
export function computeNutrientBalance(
  config: TEAConfig,
  geometry: PondGeometryTEA
): NutrientBalance {
  const Q_actual = geometry.Q_actual_tons_yr;
  const Q_per_day = Q_actual / config.active_days_yr; // tons/day

  // ── CO₂ demand ─────────────────────────────────────────────
  const co2_demand_g_per_g = (config.carbon_frac * (MW_CO2 / AW_C)) / config.co2_uptake_efficiency;
  const co2_daily = Q_per_day * co2_demand_g_per_g; // tons/day
  const co2_annual = co2_daily * config.active_days_yr;

  // ── KNO₃ demand ────────────────────────────────────────────
  const kno3_demand_g_per_g = (config.nitrogen_frac * (MW_KNO3 / AW_N)) / config.n_uptake_efficiency;
  const kno3_daily = Q_per_day * kno3_demand_g_per_g;
  const kno3_annual = kno3_daily * config.active_days_yr;

  // ── DAP demand ─────────────────────────────────────────────
  const dap_demand_g_per_g = (config.phosphorus_frac * (MW_DAP / AW_P)) / config.p_uptake_efficiency;
  const dap_daily = Q_per_day * dap_demand_g_per_g;
  const dap_annual = dap_daily * config.active_days_yr;

  // ── Micronutrient demand ───────────────────────────────────
  const micro_daily = Q_per_day * config.micronutrient_frac;
  const micro_annual = micro_daily * config.active_days_yr;

  // ── Water demand ───────────────────────────────────────────
  const A_pond_total_m2 = geometry.n_ponds * config.pond_size_acres * ACRES_TO_M2;

  // Evaporation: mm/day over total pond area
  const V_evap_daily = (config.evaporation_rate_mm_day * A_pond_total_m2) / 1000; // m³/day

  // Harvest transfer volume
  const V_transfer_daily = geometry.V_system_m3 * config.effective_growth_rate_per_day; // m³/day

  // Harvest return water loss (slurry not returned)
  const V_slurry_daily = V_transfer_daily * (1 - config.harvest_efficiency); // m³/day

  const water_daily = V_evap_daily + V_slurry_daily; // m³/day
  const water_annual = water_daily * config.active_days_yr; // m³/yr

  // ── CO₂ fixation (for reporting) ───────────────────────────
  const tons_C_yr = Q_actual * config.carbon_frac; // tons C/yr
  const co2_fixation = tons_C_yr * (MW_CO2 / AW_C); // tons CO₂ fixed/yr

  return {
    co2_tons_day: co2_daily,
    kno3_tons_day: kno3_daily,
    dap_tons_day: dap_daily,
    micro_tons_day: micro_daily,
    water_m3_day: water_daily,
    evap_m3_day: V_evap_daily,
    slurry_m3_day: V_slurry_daily,

    co2_tons_yr: co2_annual,
    kno3_tons_yr: kno3_annual,
    dap_tons_yr: dap_annual,
    micro_tons_yr: micro_annual,
    water_m3_yr: water_annual,

    co2_fixation_tons_yr: co2_fixation,
  };
}
