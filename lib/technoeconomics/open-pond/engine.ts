// Main TEA engine — orchestrates the full calculation chain
// Reference: docs/TEA_DESIGN.md Sections 1–2
//
// Usage: const result = runTEA();           // with defaults
//        const result = runTEA({ ... });    // with overrides

import type { TEAConfig, TEAResult, SectionCost, EquipmentItem, InstallationBreakdown, LaborRole } from "../types";
import { computeTEAPondGeometry } from "../common/geometry";
import { computeNutrientBalance } from "../common/nutrient-balance";
import { computeConstructionTimeline } from "../common/construction";
import { computeLabor } from "../common/labor";
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

  // 4. Compute land acres (needed for dynamic labor)
  const land_pond_footprint_acres = Math.ceil(geometry.A_land_acres);
  const land_total_acres = Math.ceil(land_pond_footprint_acres * (1 + config.land_buffer_fraction));

  // 4b. Dynamic labor — scales with facility size
  const dynamicLabor = computeLabor(geometry.n_ponds, land_total_acres);
  const configWithLabor: TEAConfig = { ...config, labor: dynamicLabor as TEAConfig["labor"] };

  // 5. Section engines (use config with dynamic labor)
  const sections: Record<string, SectionCost> = {
    inputs: computeInputsSection(configWithLabor, geometry, nutrients),
    inoculum: computeInoculumSection(configWithLabor, geometry),
    biomass: computeBiomassSection(configWithLabor, geometry),
    harvesting: computeHarvestingSection(configWithLabor, geometry, nutrients),
    drying: computeDryingSection(configWithLabor, geometry),
  };

  // 6. Cost rollup
  const rollup = computeCostRollup(sections);
  const resources = computeResourceTotals(sections, nutrients);

  // 6b. Land as a proper section — equipment (purchase), maintenance (yard), labor
  const land_cost = land_total_acres * config.land_price_per_acre;
  const land_maintenance = land_cost * config.land_maintenance_rate;
  const land_labor_cost = dynamicLabor.land.reduce((s: number, r: LaborRole) => s + r.headcount * r.annual_salary, 0);
  const land_equipment: EquipmentItem[] = [{
    id: "LND-01", name: `Land (${land_total_acres} acres)`, type: "Real Estate",
    function: `${land_pond_footprint_acres} acre footprint + ${Math.round(config.land_buffer_fraction * 100)}% buffer`,
    unit_cost: config.land_price_per_acre, units_required: land_total_acres,
    total_purchase_cost: land_cost,
    energy_type: "none", annual_energy_units: 0, annual_energy_cost: 0,
    maintenance_rate: config.land_maintenance_rate,
    annual_maintenance_cost: land_maintenance,
  }];
  const land_operating = land_maintenance + land_labor_cost;
  const emptyInstallation: InstallationBreakdown = {
    installation_factors: {}, installation_total: 0,
    indirect_factors: {}, indirect_total: 0,
    other_factors: {}, other_total: 0, grand_total: 0,
  };
  sections.land = {
    section_id: "land", section_name: "Land",
    capital_cost: land_cost, equipment_purchase: land_cost,
    install_engr_other: 0, installation_breakdown: emptyInstallation,
    operating_cost: land_operating, materials_cost: 0,
    energy_cost: 0, maintenance_cost: land_maintenance,
    labor_cost: land_labor_cost, equipment: land_equipment,
  };

  // Re-compute rollup now that land is a section
  const fullRollup = computeCostRollup(sections);
  const total_capex_with_land = fullRollup.total_capex;

  // 5c. Construction timeline — staged batches with build + test
  const construction = computeConstructionTimeline(geometry.n_ponds, config);

  // 6. Financial analysis
  const tax_rate = computeTaxRate(config.federal_tax_rate, config.state_tax_rate);
  const overhead_annual = config.overhead_per_ton * geometry.Q_actual_tons_yr;
  const aoc = fullRollup.total_opex + overhead_annual;

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
    construction,
    n_ponds: geometry.n_ponds,
    overhead_per_ton: config.overhead_per_ton,
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
  // For simple payback, use average annual FCF from steady-state years (full production)
  const steady_state_fcfs = cash_flows
    .filter((cf) => cf.year > 0 && cf.production_fraction >= 1)
    .map((cf) => cf.free_cash_flow);
  const avg_annual_fcf = steady_state_fcfs.length > 0
    ? steady_state_fcfs.reduce((s, v) => s + v, 0) / steady_state_fcfs.length
    : cash_flows.filter((cf) => cf.year > 0).map((cf) => cf.free_cash_flow).reduce((s, v) => s + v, 0) / (cash_flows.length - 1);
  const payback_simple = computePaybackSimple(tci, avg_annual_fcf);
  const payback_discounted = computePaybackDiscounted(cash_flows);

  // Capital intensity — CAPEX per unit of annual production capacity
  const capital_intensity = total_capex_with_land / geometry.Q_actual_tons_yr;

  // Sensitivity table
  const sensitivity = computeSensitivityTable(financialParams, undefined, mbsp);

  // MBSP breakdowns
  const mbsp_by_section = computeMBSPBreakdown(sections, geometry.Q_actual_tons_yr, config.unit_lifetime_yrs, mbsp);
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
    total_annual_opex: fullRollup.total_opex,
    total_annual_overhead: overhead_annual,
    total_annual_cost: aoc,

    // Breakdowns
    sections,
    resources,
    geometry,
    nutrients,
    config: configWithLabor,

    // Construction
    construction,

    // Financials
    financials: {
      mbsp,
      npv,
      irr,
      payback_simple_years: payback_simple,
      payback_discounted_years: payback_discounted,
      capital_intensity,
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
