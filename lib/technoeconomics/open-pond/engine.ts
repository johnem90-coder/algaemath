// Main TEA engine — orchestrates the full calculation chain
// Reference: docs/TEA_DESIGN.md Sections 1–2
//
// Usage: const result = runTEA();           // with defaults
//        const result = runTEA({ ... });    // with overrides

import type { TEAConfig, TEAResult, SectionCost } from "../types";
import { ACRES_TO_M2 } from "../common/constants";
import { computeTEAPondGeometry } from "../common/geometry";
import { computeNutrientBalance } from "../common/nutrient-balance";
import {
  computeTaxRate,
  computeCashFlows,
  computeNPV,
  computeIRR,
  computeMBSP,
  computePaybackSimple,
  computePaybackDiscounted,
  computeSensitivityTable,
  computeMBSPBreakdown,
  computeMBSPCategoryBreakdown,
  type CashFlowParams,
} from "../common/financials";
import { computeCostRollup, computeResourceTotals } from "./outputs";
import { computeInputsSection } from "./sections/inputs";
import { computeBiomassSection } from "./sections/biomass";
import { computeInoculumSection } from "./sections/inoculum";
import { computeHarvestingSection } from "./sections/harvesting";
import { computeDryingSection } from "./sections/drying";
import { DEFAULT_TEA_CONFIG } from "./config";

/**
 * Run the full TEA calculation. Pure function — config in, TEAResult out.
 * No side effects, no async, no I/O.
 */
export function runTEA(configOverrides?: Partial<TEAConfig>): TEAResult {
  // 1. Merge config
  const config: TEAConfig = configOverrides
    ? { ...DEFAULT_TEA_CONFIG, ...configOverrides }
    : DEFAULT_TEA_CONFIG;

  // 2. Geometry
  const geometry = computeTEAPondGeometry(config);

  // 3. Nutrient balance
  const nutrients = computeNutrientBalance(config, geometry);

  // 4. Section engines
  const sections: Record<string, SectionCost> = {
    inputs: computeInputsSection(config, geometry, nutrients),
    inoculum: computeInoculumSection(config, geometry),
    biomass: computeBiomassSection(config, geometry),
    harvesting: computeHarvestingSection(config, geometry, nutrients),
    drying: computeDryingSection(config, geometry),
  };

  // 5. Cost rollup
  const rollup = computeCostRollup(sections);
  const resources = computeResourceTotals(sections, nutrients);

  // 5b. Land cost — based on pond footprint + buffer
  const land_pond_footprint_acres = Math.ceil(geometry.A_land_acres);
  const land_total_acres = Math.ceil(land_pond_footprint_acres * (1 + config.land_buffer_fraction));
  const land_cost = land_total_acres * config.land_price_per_acre;
  const total_capex_with_land = rollup.total_capex + land_cost;

  // 6. Financial analysis
  const tax_rate = computeTaxRate(config.federal_tax_rate, config.state_tax_rate);
  const overhead_annual = config.overhead_per_ton * geometry.Q_actual_tons_yr;
  const aoc = rollup.total_opex + overhead_annual;

  const financialParams: Omit<CashFlowParams, "sale_price"> = {
    total_capex: total_capex_with_land,
    annual_opex: aoc,
    q_actual: geometry.Q_actual_tons_yr,
    discount_rate: config.discount_rate,
    tax_rate,
    lifetime: config.unit_lifetime_yrs,
    depreciation_method: config.depreciation_method,
    working_capital_fraction: config.working_capital_fraction,
    salvage_value_fraction: config.salvage_value_fraction,
  };

  // MBSP — sale price where NPV = 0
  const mbsp = computeMBSP(financialParams);

  // Cash flows at MBSP (for the cash flow schedule)
  const cash_flows = computeCashFlows({ ...financialParams, sale_price: mbsp });
  const npv = computeNPV(cash_flows); // should be ≈ 0 at MBSP

  // IRR at MBSP
  const irr = computeIRR(cash_flows);

  // Payback
  const tci = total_capex_with_land * (1 + config.working_capital_fraction);
  // For simple payback, use average annual FCF (years 1+)
  const annual_fcfs = cash_flows.filter((cf) => cf.year > 0).map((cf) => cf.free_cash_flow);
  const avg_annual_fcf = annual_fcfs.reduce((s, v) => s + v, 0) / annual_fcfs.length;
  const payback_simple = computePaybackSimple(tci, avg_annual_fcf);
  const payback_discounted = computePaybackDiscounted(cash_flows);

  // Sensitivity table
  const sensitivity = computeSensitivityTable(financialParams);

  // MBSP breakdowns
  const mbsp_by_section = computeMBSPBreakdown(sections, geometry.Q_actual_tons_yr, config.unit_lifetime_yrs, mbsp);
  // Add land as its own entry
  const land_capex_per_ton = land_cost / (geometry.Q_actual_tons_yr * config.unit_lifetime_yrs);
  mbsp_by_section.push({
    section_id: "land",
    section_name: `Land (${land_total_acres} acres)`,
    capex_per_ton: land_capex_per_ton,
    opex_per_ton: 0,
    total_per_ton: land_capex_per_ton,
    percent_of_mbsp: mbsp > 0 ? (land_capex_per_ton / mbsp) * 100 : 0,
  });
  const mbsp_by_category = computeMBSPCategoryBreakdown(
    total_capex_with_land,
    aoc,
    config.overhead_per_ton,
    geometry.Q_actual_tons_yr,
    config.unit_lifetime_yrs
  );

  // System productivity
  const system_productivity = (geometry.Q_actual_tons_yr * 1e6) / (geometry.A_land_m2 * config.active_days_yr);

  return {
    // System sizing
    n_ponds: geometry.n_ponds,
    actual_production_tons_yr: geometry.Q_actual_tons_yr,
    land_area_acres: geometry.A_land_acres,
    land_area_hectares: geometry.A_land_m2 / 10000,
    system_volume_m3: geometry.V_system_m3,
    system_productivity_g_m2_day: system_productivity,

    // Land
    land_pond_footprint_acres: land_pond_footprint_acres,
    land_total_acres,
    land_cost,

    // Cost totals
    total_capex: total_capex_with_land,
    total_annual_opex: rollup.total_opex,
    total_annual_overhead: overhead_annual,
    total_annual_cost: aoc,

    // Breakdowns
    sections,
    resources,
    geometry,
    nutrients,
    config,

    // Financials
    financials: {
      mbsp,
      npv,
      irr,
      payback_simple_years: payback_simple,
      payback_discounted_years: payback_discounted,
      discount_rate: config.discount_rate,
      tax_rate,
      depreciation_method: config.depreciation_method,
      unit_lifetime_years: config.unit_lifetime_yrs,
      cash_flows,
      sensitivity,
      mbsp_by_section,
      mbsp_by_category,
    },
  };
}
