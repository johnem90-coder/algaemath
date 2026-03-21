// Section: Harvesting (Dewatering) — 6 equipment items
// Reference: docs/TEA_DESIGN.md Section 2.4

import type {
  TEAConfig,
  PondGeometryTEA,
  NutrientBalance,
  SectionCost,
  EquipmentItem,
  LaborRole,
} from "../../types";
import { electricityCost, dieselCost } from "../../common/energy";
import { computeInstallationCost } from "../../common/installation";
import {
  PUMP_CATALOG,
  TANK_CATALOG,
  sizePumpByFlow,
  sizeTank,
} from "../../common/equipment-options";

export function computeHarvestingSection(
  config: TEAConfig,
  geometry: PondGeometryTEA,
  _nutrients: NutrientBalance
): SectionCost {
  const equipment: EquipmentItem[] = [];
  const active_days = config.active_days_yr;
  const harvest_hrs = config.harvest_hours_per_day;
  const eta_chain = config.eta_pump * config.eta_drive * config.eta_motor;

  // Process parameters
  const n_harvest_systems = geometry.n_cols; // typically 1–2
  const V_transfer_daily = geometry.V_system_m3 * config.effective_growth_rate_per_day; // m³/day
  const inlet_flow_per_system = V_transfer_daily / n_harvest_systems; // m³/day
  const inlet_flow_m3_hr = inlet_flow_per_system / harvest_hrs; // m³/hr

  // ── HAR-01: Pump 3s — Pond → Filter 2 (flow-rate sized) ──
  {
    const volume_per_system_L = inlet_flow_per_system * 1000;
    const { option, units: units_per_sys, run_hrs_day } = sizePumpByFlow(
      volume_per_system_L, [harvest_hrs], PUMP_CATALOG, 20
    );
    const units = units_per_sys * n_harvest_systems;
    const total_cost = option.unit_cost * units;
    const run_hrs_yr = run_hrs_day * active_days;
    const energy = option.energy_type === "diesel"
      ? dieselCost(option.power_kW, run_hrs_yr * units, config.diesel_per_L, eta_chain)
      : { liters: 0, cost: electricityCost(option.power_kW, run_hrs_yr * units, config.electricity_per_kWh).cost };
    equipment.push({
      id: "HAR-01", name: "Pump 3s", type: option.label, function: "Culture transfer to filters",
      unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: option.energy_type,
      annual_energy_units: option.energy_type === "diesel" ? energy.liters : 0,
      annual_energy_cost: energy.cost,
      maintenance_rate: config.maintenance_rate_mechanical, annual_maintenance_cost: total_cost * config.maintenance_rate_mechanical,
    });
  }

  // ── HAR-02: Filter 2s — Slant Screen (electric) ───────────
  {
    const available_m3_hr = 30;
    const units_per_system = Math.ceil(inlet_flow_m3_hr / available_m3_hr);
    const units = units_per_system * n_harvest_systems;
    const unit_cost = 3000;
    const total_cost = unit_cost * units;
    const power_kW = 2.2;
    const run_hrs_yr = units * harvest_hrs * active_days;
    const e = electricityCost(power_kW, run_hrs_yr, config.electricity_per_kWh);
    equipment.push({
      id: "HAR-02", name: "Filter 2s", type: "Slant Screen", function: "Primary biomass separation",
      unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: "electricity", annual_energy_units: e.kWh, annual_energy_cost: e.cost,
      maintenance_rate: config.maintenance_rate_passive, annual_maintenance_cost: total_cost * config.maintenance_rate_passive,
    });
  }

  // ── HAR-03: Filter 3s — Shaker Screen (matched to Filter 2) ──
  {
    const units = equipment[1].units_required;
    const unit_cost = 3000;
    const total_cost = unit_cost * units;
    const power_kW = 0.75;
    const run_hrs_yr = units * harvest_hrs * active_days;
    const e = electricityCost(power_kW, run_hrs_yr, config.electricity_per_kWh);
    equipment.push({
      id: "HAR-03", name: "Filter 3s", type: "Shaker Screen", function: "Biomass chunk breakup",
      unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: "electricity", annual_energy_units: e.kWh, annual_energy_cost: e.cost,
      maintenance_rate: config.maintenance_rate_mechanical, annual_maintenance_cost: total_cost * config.maintenance_rate_mechanical,
    });
  }

  // ── HAR-04: Filter 4s — Vacuum Belt (electric) ────────────
  {
    const post_filter3_flow = inlet_flow_m3_hr * (1 - config.filter3_efficiency);
    const available_m3_hr = 30;
    const units_per_system = Math.ceil(post_filter3_flow / available_m3_hr);
    const units = Math.max(1, units_per_system) * n_harvest_systems;
    const unit_cost = 30000;
    const total_cost = unit_cost * units;
    const power_kW = 2.6;
    const run_hrs_yr = units * harvest_hrs * active_days;
    const e = electricityCost(power_kW, run_hrs_yr, config.electricity_per_kWh);
    equipment.push({
      id: "HAR-04", name: "Filter 4s", type: "Vacuum Belt", function: "Wash & dewater biomass",
      unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: "electricity", annual_energy_units: e.kWh, annual_energy_cost: e.cost,
      maintenance_rate: config.maintenance_rate_membrane, annual_maintenance_cost: total_cost * config.maintenance_rate_membrane,
    });
  }

  // ── HAR-05: Tank 3s — Filtrate holding (sized with tank catalog) ──
  {
    const filtrate_daily = V_transfer_daily * config.harvest_efficiency; // m³/day
    const required_m3 = (filtrate_daily * config.filtrate_tank_buffer_days) / n_harvest_systems;
    const { option: tank_opt, units: units_per_sys } = sizeTank(required_m3, TANK_CATALOG);
    const units = units_per_sys * n_harvest_systems;
    const total_cost = tank_opt.unit_cost * units;
    equipment.push({
      id: "HAR-05", name: "Tank 3s", type: "Cone Roof", function: "Filtrate holding",
      unit_cost: tank_opt.unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: "none", annual_energy_units: 0, annual_energy_cost: 0,
      maintenance_rate: config.maintenance_rate_passive, annual_maintenance_cost: total_cost * config.maintenance_rate_passive,
    });
  }

  // ── HAR-06: Pump 4s — Return water to ponds (flow-rate sized) ──
  {
    const filtrate_daily_L = V_transfer_daily * config.harvest_efficiency * 1000; // L/day
    const filtrate_per_system_L = filtrate_daily_L / n_harvest_systems;
    const { option, units: units_per_sys, run_hrs_day } = sizePumpByFlow(
      filtrate_per_system_L, [harvest_hrs], PUMP_CATALOG, 20
    );
    const units = units_per_sys * n_harvest_systems;
    const total_cost = option.unit_cost * units;
    const run_hrs_yr = run_hrs_day * active_days;
    const energy = option.energy_type === "diesel"
      ? dieselCost(option.power_kW, run_hrs_yr * units, config.diesel_per_L, eta_chain)
      : { liters: 0, cost: electricityCost(option.power_kW, run_hrs_yr * units, config.electricity_per_kWh).cost };
    equipment.push({
      id: "HAR-06", name: "Pump 4s", type: option.label, function: "Return filtered water to ponds",
      unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: option.energy_type,
      annual_energy_units: option.energy_type === "diesel" ? energy.liters : 0,
      annual_energy_cost: energy.cost,
      maintenance_rate: config.maintenance_rate_mechanical, annual_maintenance_cost: total_cost * config.maintenance_rate_mechanical,
    });
  }

  // ── Aggregation ────────────────────────────────────────────
  const equipment_purchase = equipment.reduce((s, e) => s + e.total_purchase_cost, 0);
  const installation_breakdown = computeInstallationCost(equipment_purchase, "harvesting");

  const energy_cost = equipment.reduce((s, e) => s + e.annual_energy_cost, 0);
  const maintenance_cost = equipment.reduce((s, e) => s + e.annual_maintenance_cost, 0);
  const labor_cost = config.labor.harvesting.reduce((s: number, r: LaborRole) => s + r.headcount * r.annual_salary, 0);
  const materials_cost = 0;
  const operating_cost = materials_cost + energy_cost + maintenance_cost + labor_cost;

  return {
    section_id: "harvesting",
    section_name: "Harvesting (Dewatering)",
    capital_cost: equipment_purchase + installation_breakdown.grand_total,
    equipment_purchase,
    install_engr_other: installation_breakdown.grand_total,
    installation_breakdown,
    operating_cost, materials_cost, energy_cost, maintenance_cost, labor_cost, equipment,
  };
}
