// Cost rollup and resource aggregation
// Reference: docs/TEA_DESIGN.md Section 2.6

import type { SectionCost, ResourceConsumption, NutrientBalance } from "../types";

/** Sum CAPEX and OPEX across all sections */
export function computeCostRollup(sections: Record<string, SectionCost>): {
  total_capex: number;
  total_opex: number;
  total_materials: number;
  total_energy: number;
  total_maintenance: number;
  total_labor: number;
} {
  let total_capex = 0;
  let total_opex = 0;
  let total_materials = 0;
  let total_energy = 0;
  let total_maintenance = 0;
  let total_labor = 0;

  for (const s of Object.values(sections)) {
    total_capex += s.capital_cost;
    total_opex += s.operating_cost;
    total_materials += s.materials_cost;
    total_energy += s.energy_cost;
    total_maintenance += s.maintenance_cost;
    total_labor += s.labor_cost;
  }

  return { total_capex, total_opex, total_materials, total_energy, total_maintenance, total_labor };
}

/** Aggregate resource consumption across sections and nutrient balance */
export function computeResourceTotals(
  sections: Record<string, SectionCost>,
  nutrients: NutrientBalance
): ResourceConsumption {
  let electricity_kWh_yr = 0;
  let diesel_L_yr = 0;
  let natural_gas_cuft_yr = 0;

  for (const s of Object.values(sections)) {
    for (const eq of s.equipment) {
      switch (eq.energy_type) {
        case "electricity":
          electricity_kWh_yr += eq.annual_energy_units;
          break;
        case "diesel":
          diesel_L_yr += eq.annual_energy_units;
          break;
        case "natural_gas":
          natural_gas_cuft_yr += eq.annual_energy_units;
          break;
      }
    }
  }

  return {
    electricity_kWh_yr,
    diesel_L_yr,
    natural_gas_cuft_yr,
    water_m3_yr: nutrients.water_m3_yr,
    co2_tons_yr: nutrients.co2_tons_yr,
    kno3_tons_yr: nutrients.kno3_tons_yr,
    dap_tons_yr: nutrients.dap_tons_yr,
    co2_fixation_tons_yr: nutrients.co2_fixation_tons_yr,
  };
}
