// Section: Drying (Final Processing) — 3 equipment items
// Reference: docs/TEA_DESIGN.md Section 2.5

import type { TEAConfig, PondGeometryTEA, SectionCost, EquipmentItem } from "../../types";
import { sprayDryerCost2022 } from "../../common/cost-escalation";
import { electricityCost, naturalGasCost } from "../../common/energy";
import { computeInstallationCost } from "../../common/installation";
import {
  HEAT_REQUIRED_MJ_PER_TON_WATER,
  DRYER_EFFICIENCY,
  DRYER_OPERATING_FACTOR,
  MJ_PER_CUFT_NATURAL_GAS,
} from "../../common/constants";
import { SLUDGE_PUMP_CATALOG, sizeSludgePump } from "../../common/equipment-options";
import laborData from "../data/labor-roles.json";

export function computeDryingSection(
  config: TEAConfig,
  geometry: PondGeometryTEA
): SectionCost {
  const equipment: EquipmentItem[] = [];
  const active_days = config.active_days_yr;
  const harvest_hrs = config.harvest_hours_per_day;

  // Process parameters
  const daily_production_tons = geometry.Q_actual_tons_yr / active_days;
  const water_in = config.dryer_inlet_water_content; // 0.75
  const water_out = config.dryer_outlet_water_content; // 0.05

  // Inlet biomass flow (wet basis): production is on dry basis
  // If outlet is 5% water, then dry fraction = 0.95
  // Daily dry biomass = daily_production_tons
  // Daily wet output = daily_production / 0.95
  // Daily wet input = daily_production / (1 - water_in) = daily_production / 0.25
  const daily_wet_input_tons = daily_production_tons / (1 - water_in);
  const daily_water_evap_tons = daily_wet_input_tons - daily_production_tons / (1 - water_out);

  // Evaporation rate in kg/hr during harvest window
  const evap_rate_kg_hr = (daily_water_evap_tons * 1000) / harvest_hrs;

  // Number of drying systems = number of harvest systems
  const n_drying_systems = geometry.n_cols;

  // ── DRY-01: Pump 5s — Slurry transfer (electric) ──────────
  // Uses sludge pump catalog — separate from water pumps (thick biomass paste)
  {
    const slurry_flow_m3_hr = daily_wet_input_tons / n_drying_systems / harvest_hrs; // tons/hr ≈ m³/hr per system
    const { option, units: units_per_sys } = sizeSludgePump(slurry_flow_m3_hr, SLUDGE_PUMP_CATALOG);
    const units = units_per_sys * n_drying_systems;
    const total_cost = option.unit_cost * units;
    const run_hrs_yr = units * harvest_hrs * active_days;
    const e = electricityCost(option.power_kW, run_hrs_yr, config.electricity_per_kWh);
    equipment.push({
      id: "DRY-01",
      name: "Pump 5s",
      type: option.label,
      function: "Slurry transfer to dryer",
      unit_cost: option.unit_cost,
      units_required: units,
      total_purchase_cost: total_cost,
      energy_type: "electricity",
      annual_energy_units: e.kWh,
      annual_energy_cost: e.cost,
      maintenance_rate: 0.05,
      annual_maintenance_cost: total_cost * 0.05,
    });
  }

  // ── DRY-02: Dryer 1 — Spray dryer (natural gas) ──────────
  {
    const units = n_drying_systems;
    const evap_per_dryer = evap_rate_kg_hr / units;
    const unit_cost = sprayDryerCost2022(evap_per_dryer);
    const total_cost = unit_cost * units;

    // Natural gas energy calculation
    // Heat required = 2260 MJ per ton of water evaporated
    // Annual water evaporated = daily_water_evap_tons * active_days
    const annual_water_evap_tons = daily_water_evap_tons * active_days;
    const heat_required_MJ = annual_water_evap_tons * HEAT_REQUIRED_MJ_PER_TON_WATER;
    const heat_input_MJ = (heat_required_MJ / DRYER_EFFICIENCY) * DRYER_OPERATING_FACTOR;
    const annual_gas_cuft = heat_input_MJ / MJ_PER_CUFT_NATURAL_GAS;
    const gas_cost = naturalGasCost(annual_gas_cuft, config.natural_gas_per_cuft);

    equipment.push({
      id: "DRY-02",
      name: "Dryer 1",
      type: "Spray Dryer",
      function: "Evaporate water from slurry to dry powder",
      unit_cost,
      units_required: units,
      total_purchase_cost: total_cost,
      energy_type: "natural_gas",
      annual_energy_units: annual_gas_cuft,
      annual_energy_cost: gas_cost,
      maintenance_rate: 0.07,
      annual_maintenance_cost: total_cost * 0.07,
    });
  }

  // ── DRY-03: Silo 1 — Dry bulk storage ─────────────────────
  {
    const units = n_drying_systems;
    const unit_cost = 10000;
    const total_cost = unit_cost * units;
    equipment.push({
      id: "DRY-03",
      name: "Silo 1",
      type: "Dry Bulk Storage",
      function: "Finished product storage",
      unit_cost,
      units_required: units,
      total_purchase_cost: total_cost,
      energy_type: "none",
      annual_energy_units: 0,
      annual_energy_cost: 0,
      maintenance_rate: 0.03,
      annual_maintenance_cost: total_cost * 0.03,
    });
  }

  // ── Aggregation ────────────────────────────────────────────
  const equipment_purchase = equipment.reduce((s, e) => s + e.total_purchase_cost, 0);
  const installation_breakdown = computeInstallationCost(equipment_purchase, "drying");

  const energy_cost = equipment.reduce((s, e) => s + e.annual_energy_cost, 0);
  const maintenance_cost = equipment.reduce((s, e) => s + e.annual_maintenance_cost, 0);
  const labor_cost = laborData.sections.drying.total_annual_cost;
  const materials_cost = 0;
  const operating_cost = materials_cost + energy_cost + maintenance_cost + labor_cost;

  return {
    section_id: "drying",
    section_name: "Drying (Final Processing)",
    capital_cost: equipment_purchase + installation_breakdown.grand_total,
    equipment_purchase,
    install_engr_other: installation_breakdown.grand_total,
    installation_breakdown,
    operating_cost,
    materials_cost,
    energy_cost,
    maintenance_cost,
    labor_cost,
    equipment,
  };
}
