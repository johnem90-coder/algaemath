// Shared TypeScript interfaces for TEA (Techno-Economic Analysis)
// Reference: docs/TEA_DESIGN.md Section 2.7

// ── Configuration ──────────────────────────────────────────────

/** Flat typed config — flattened from default-config.json for computation */
export interface TEAConfig {
  // System inputs
  desired_output_tons_yr: number;
  active_days_yr: number;
  pond_size_acres: number;
  pond_depth_m: number;
  pond_lw_ratio: number;
  pond_spacing_col_m: number;
  pond_spacing_row_m: number;
  unit_lifetime_yrs: number;

  // Growth inputs
  effective_growth_rate_per_day: number;
  density_at_harvest_g_L: number;

  // Unit costs
  electricity_per_kWh: number;
  natural_gas_per_cuft: number;
  diesel_per_L: number;
  co2_per_ton: number;
  kno3_per_ton: number;
  dap_per_ton: number;
  micronutrient_per_ton: number;
  water_per_m3: number;
  labor_rate_per_hr: number;

  // Algae composition
  carbon_frac: number;
  nitrogen_frac: number;
  phosphorus_frac: number;
  micronutrient_frac: number;

  // Financial inputs
  federal_tax_rate: number;
  state_tax_rate: number;
  discount_rate: number;
  depreciation_method: "MACRS-7" | "straight-line";
  working_capital_fraction: number;
  salvage_value_fraction: number;

  // Overhead costs
  overhead_per_ton: number;

  // Process parameters
  evaporation_rate_mm_day: number;
  harvest_efficiency: number;
  harvest_hours_per_day: number;
  dryer_inlet_water_content: number;
  dryer_outlet_water_content: number;
  silo_buffer_days: number;

  // Inoculum
  inoculum_tiers: InoculumTier[];
  inoculation_target_months: number; // months to inoculate all production ponds

  // Currency
  land_price_per_acre: number;
}

export interface InoculumTier {
  name: string;
  size_fraction: number;
  cycle_days: number;
}

// ── Geometry ───────────────────────────────────────────────────

export interface PondGeometryTEA {
  // Single pond
  W: number; // Channel width (m)
  L_total: number; // Total racetrack length (m)
  SA: number; // Pond surface area (m²)
  perimeter: number; // Outer perimeter (m)
  V_pond_m3: number; // Culture volume per pond (m³)

  // System sizing
  n_ponds: number;
  Q_actual_tons_yr: number; // Actual production (may exceed target)
  V_system_m3: number; // Total culture volume (m³)

  // Land layout
  n_rows: number;
  n_cols: number;
  A_land_m2: number;
  A_land_acres: number;

  // Liner
  liner_area_per_pond_m2: number;
  liner_area_total_m2: number;
}

// ── Nutrient Balance ───────────────────────────────────────────

export interface NutrientBalance {
  // Daily demands
  co2_tons_day: number;
  kno3_tons_day: number;
  dap_tons_day: number;
  micro_tons_day: number;
  water_m3_day: number;

  // Water demand components (for equipment sizing)
  evap_m3_day: number;
  slurry_m3_day: number;

  // Annual demands
  co2_tons_yr: number;
  kno3_tons_yr: number;
  dap_tons_yr: number;
  micro_tons_yr: number;
  water_m3_yr: number;

  // CO₂ fixation (for reporting)
  co2_fixation_tons_yr: number;
}

// ── Equipment & Section Costs ──────────────────────────────────

export interface EquipmentItem {
  id: string; // 'INP-01', 'BIO-01', etc.
  name: string;
  type: string; // 'Cone Roof', 'Vortex Impeller', etc.
  function: string;
  unit_cost: number; // $/unit (in analysis year)
  units_required: number;
  total_purchase_cost: number;
  energy_type: "electricity" | "diesel" | "natural_gas" | "none";
  annual_energy_units: number; // kWh, L, or cuft
  annual_energy_cost: number;
  maintenance_rate: number; // 0.03, 0.05, or 0.07
  annual_maintenance_cost: number;
}

/** Three-tier installation cost breakdown:
 *  1. Installation = equipment_purchase × installation factors (piping, electrical, etc.)
 *  2. Indirect = installation_total × indirect factors (engineering, construction)
 *  3. Other = (installation_total + indirect_total) × other factors (contractor, contingency) */
export interface InstallationBreakdown {
  // Tier 1: Installation (multiplied against equipment purchase)
  installation_factors: Record<string, number>; // factor name → dollar amount
  installation_total: number;

  // Tier 2: Indirect (multiplied against installation_total)
  indirect_factors: Record<string, number>;
  indirect_total: number;

  // Tier 3: Other (multiplied against installation_total + indirect_total)
  other_factors: Record<string, number>;
  other_total: number;

  // Grand total = installation + indirect + other
  grand_total: number;
}

export interface SectionCost {
  section_id: string;
  section_name: string;
  capital_cost: number; // $ (equipment_purchase + install/engr/other)
  equipment_purchase: number; // $
  install_engr_other: number; // $ (installation + indirect + other)
  installation_breakdown: InstallationBreakdown; // detailed breakdown
  operating_cost: number; // $/yr
  materials_cost: number; // $/yr
  energy_cost: number; // $/yr
  maintenance_cost: number; // $/yr
  labor_cost: number; // $/yr
  equipment: EquipmentItem[];
}

// ── Resource Consumption ───────────────────────────────────────

export interface ResourceConsumption {
  electricity_kWh_yr: number;
  diesel_L_yr: number;
  natural_gas_cuft_yr: number;
  water_m3_yr: number;
  co2_tons_yr: number;
  kno3_tons_yr: number;
  dap_tons_yr: number;
  co2_fixation_tons_yr: number;
}

// ── Financial Analysis ─────────────────────────────────────────

export interface AnnualCashFlow {
  year: number; // 0 = initial investment
  revenue: number;
  cogs: number;
  gross_profit: number;
  depreciation: number;
  taxable_income: number;
  taxes: number;
  net_income: number;
  free_cash_flow: number;
  cumulative_dcf: number; // Running NPV
}

export interface SensitivityRow {
  sale_price: number;
  revenue: number;
  gross_profit: number;
  net_income: number;
  net_profit_margin: number;
  npv: number;
}

export interface MBSPBreakdown {
  section_id: string;
  section_name: string;
  capex_per_ton: number; // Annualized
  opex_per_ton: number;
  total_per_ton: number;
  percent_of_mbsp: number;
}

export interface MBSPCategoryBreakdown {
  annualized_capex: number; // $/ton
  opex: number; // $/ton
  overhead: number; // $/ton
  total: number; // $/ton (= simplified MBSP)
}

export interface FinancialAnalysis {
  // Key metrics
  mbsp: number; // $/ton (NPV=0 price)
  npv: number; // $ at specified sale price & discount rate
  irr: number; // fraction (rate where NPV=0)
  payback_simple_years: number;
  payback_discounted_years: number;

  // Configuration used
  discount_rate: number;
  tax_rate: number;
  depreciation_method: string;
  unit_lifetime_years: number;

  // Annual cash flow schedule
  cash_flows: AnnualCashFlow[];

  // Sensitivity table
  sensitivity: SensitivityRow[];

  // MBSP breakdown
  mbsp_by_section: MBSPBreakdown[];
  mbsp_by_category: MBSPCategoryBreakdown;
}

// ── Top-Level Result ───────────────────────────────────────────

export interface TEAResult {
  // System sizing
  n_ponds: number;
  actual_production_tons_yr: number;
  land_area_acres: number;
  land_area_hectares: number;
  system_volume_m3: number;
  system_productivity_g_m2_day: number;

  // Cost totals
  total_capex: number; // $
  total_annual_opex: number; // $/yr
  total_annual_overhead: number; // $/yr
  total_annual_cost: number; // $/yr (OPEX + overhead)

  // Per-section breakdown
  sections: Record<string, SectionCost>;

  // Resource consumption
  resources: ResourceConsumption;

  // Geometry details
  geometry: PondGeometryTEA;

  // Nutrient balance
  nutrients: NutrientBalance;

  // Config used (for displaying input parameters)
  config: TEAConfig;

  // Financial analysis
  financials: FinancialAnalysis;
}
