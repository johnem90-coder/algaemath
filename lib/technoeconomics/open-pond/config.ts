// Default TEA configuration — flattens default-config.json into typed TEAConfig
// Reference: docs/TEA_DESIGN.md Section 1.1

import type { TEAConfig } from "../types";
import defaultConfigJson from "./data/default-config.json";

/**
 * Parse the nested JSON config into a flat TEAConfig object for computation.
 */
export function getDefaultTEAConfig(): TEAConfig {
  const d = defaultConfigJson;
  return {
    // System inputs
    desired_output_tons_yr: d.system_inputs.desired_output_tons_yr.value,
    active_days_yr: d.system_inputs.active_days_yr.value,
    pond_size_acres: d.system_inputs.pond_size_acres.value,
    pond_depth_m: d.system_inputs.pond_depth_m.value,
    pond_lw_ratio: d.system_inputs.pond_lw_ratio.value,
    pond_spacing_col_m: d.system_inputs.pond_spacing_col_m.value,
    pond_spacing_row_m: d.system_inputs.pond_spacing_row_m.value,
    unit_lifetime_yrs: d.system_inputs.unit_lifetime_yrs.value,

    // Growth inputs
    effective_growth_rate_per_day: d.growth_inputs.effective_growth_rate_per_day.value,
    density_at_harvest_g_L: d.growth_inputs.density_at_harvest_g_L.value,

    // Unit costs
    electricity_per_kWh: d.unit_costs.electricity_per_kWh.value,
    natural_gas_per_cuft: d.unit_costs.natural_gas_per_cuft.value,
    diesel_per_L: d.unit_costs.diesel_per_L.value,
    co2_per_ton: d.unit_costs.co2_per_ton.value,
    kno3_per_ton: d.unit_costs.kno3_per_ton.value,
    dap_per_ton: d.unit_costs.dap_per_ton.value,
    micronutrient_per_ton: d.unit_costs.micronutrient_per_ton.value,
    water_per_m3: d.unit_costs.water_per_m3.value,
    labor_rate_per_hr: d.unit_costs.labor_rate_per_hr.value,

    // Algae composition
    carbon_frac: d.algae_composition.carbon_frac.value,
    nitrogen_frac: d.algae_composition.nitrogen_frac.value,
    phosphorus_frac: d.algae_composition.phosphorus_frac.value,
    micronutrient_frac: d.algae_composition.micronutrient_frac.value,

    // Financial inputs
    federal_tax_rate: d.financial_inputs.federal_tax_rate.value,
    state_tax_rate: d.financial_inputs.state_tax_rate.value,
    discount_rate: d.financial_inputs.discount_rate.value,
    depreciation_method: d.financial_inputs.depreciation_method.value as "MACRS-7" | "straight-line",
    working_capital_fraction: d.financial_inputs.working_capital_fraction.value,
    salvage_value_fraction: d.financial_inputs.salvage_value_fraction.value,

    // Overhead
    overhead_per_ton: d.overhead_costs.total_per_ton.value,

    // Diesel drivetrain efficiency
    eta_pump: d.diesel_drivetrain.eta_pump.value,
    eta_drive: d.diesel_drivetrain.eta_drive.value,
    eta_motor: d.diesel_drivetrain.eta_motor.value,

    // Uptake efficiencies
    co2_uptake_efficiency: d.uptake_efficiencies.co2.value,
    n_uptake_efficiency: d.uptake_efficiencies.nitrogen.value,
    p_uptake_efficiency: d.uptake_efficiencies.phosphorus.value,

    // Maintenance rates
    maintenance_rate_passive: d.maintenance_rates.passive.value,
    maintenance_rate_mechanical: d.maintenance_rates.mechanical.value,
    maintenance_rate_membrane: d.maintenance_rates.membrane.value,

    // Process parameters
    evaporation_rate_mm_day: d.process_parameters.evaporation_rate_mm_day.value,
    harvest_efficiency: d.process_parameters.harvest_efficiency.value,
    harvest_hours_per_day: d.process_parameters.harvest_hours_per_day.value,
    dryer_inlet_water_content: d.process_parameters.dryer_inlet_water_content.value,
    dryer_outlet_water_content: d.process_parameters.dryer_outlet_water_content.value,
    dryer_efficiency: d.process_parameters.dryer_efficiency.value,
    dryer_operating_factor: d.process_parameters.dryer_operating_factor.value,
    silo_buffer_days: d.process_parameters.silo_buffer_days.value,
    filter3_efficiency: d.process_parameters.filter3_efficiency.value,

    // Buffer days
    tank1_buffer_days: d.buffer_days.tank1_raw_water.value,
    tank2_buffer_days: d.buffer_days.tank2_filtered_water.value,
    co2_tank_buffer_days: d.buffer_days.co2_tanks.value,
    hopper_buffer_days: d.buffer_days.hoppers.value,
    filtrate_tank_buffer_days: d.buffer_days.filtrate_tank.value,

    // Labor
    labor: {
      inputs: d.labor.inputs,
      inoculum: d.labor.inoculum,
      biomass: d.labor.biomass,
      harvesting: d.labor.harvesting,
      drying: d.labor.drying,
      land: d.labor.land,
    },

    // Inoculum
    inoculum_tiers: d.inoculum.tiers,
    inoculation_target_months: d.inoculum.target_months.value,

    // Land
    land_price_per_acre: (d.land.catalog.find((l: { location: string }) => l.location === d.land.selected_location) ?? d.land.catalog[0]).cost_per_acre,
    land_buffer_fraction: d.land.buffer_fraction,
    land_maintenance_rate: d.land.maintenance_rate,
    land_catalog: d.land.catalog,

    // Construction & ramp-up
    max_ponds_per_batch: d.construction.max_ponds_per_batch.value,
    pond_build_weeks: d.construction.pond_build_weeks.value,
    batch_test_weeks: d.construction.batch_test_weeks.value,
  };
}

export const DEFAULT_TEA_CONFIG: TEAConfig = Object.freeze(getDefaultTEAConfig()) as TEAConfig;
