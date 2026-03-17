// Section: Inputs (Water Treatment & Delivery) — 10 equipment items
// Reference: docs/TEA_DESIGN.md Section 2.1

import type {
  TEAConfig,
  PondGeometryTEA,
  NutrientBalance,
  SectionCost,
  EquipmentItem,
} from "../../types";
import { electricityCost, dieselCost } from "../../common/energy";
import { computeInstallationCost } from "../../common/installation";
import { CO2_LIQUID_DENSITY_TONS_M3, GAL_TO_L } from "../../common/constants";
import {
  PUMP_CATALOG,
  TANK_CATALOG,
  FILTER_CATALOG,
  KNO3_HOPPER_CATALOG,
  DAP_HOPPER_CATALOG,
  MICRO_HOPPER_CATALOG,
  MIX_TANK_CATALOG,
  sizeTank,
  sizePumpByFlow,
  sizeFilter,
  sizeHopper,
  sizeMixTank,
} from "../../common/equipment-options";
import laborData from "../data/labor-roles.json";

export function computeInputsSection(
  config: TEAConfig,
  geometry: PondGeometryTEA,
  nutrients: NutrientBalance
): SectionCost {
  const equipment: EquipmentItem[] = [];
  const n_ponds = geometry.n_ponds;
  const active_days = config.active_days_yr;

  // ── INP-01: Tank 1 — Raw water storage ─────────────────────
  {
    const buffer_days = 3;
    const required_m3 = buffer_days * nutrients.water_m3_day;
    const { option, units } = sizeTank(required_m3, TANK_CATALOG);
    const total_cost = option.unit_cost * units;
    equipment.push({
      id: "INP-01", name: "Tank 1", type: "Cone Roof", function: "Raw water storage",
      unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: "none", annual_energy_units: 0, annual_energy_cost: 0,
      maintenance_rate: 0.03, annual_maintenance_cost: total_cost * 0.03,
    });
  }

  // ── INP-02: Pump 1 — Raw water transfer (diesel) ──────────
  {
    const evap_flow_Ls = (nutrients.evap_m3_day * 1000) / (24 * 3600);
    const min_flow_Ls = 2 * evap_flow_Ls;
    const daily_volume_L = nutrients.water_m3_day * 1000;
    const { option, units, run_hrs_day } = sizePumpByFlow(
      daily_volume_L, [4, 6, 8, 12], PUMP_CATALOG, 20, min_flow_Ls
    );
    const total_cost = option.unit_cost * units;
    const run_hrs_yr = run_hrs_day * active_days;
    const energy = option.energy_type === "diesel"
      ? dieselCost(option.power_kW, run_hrs_yr * units, config.diesel_per_L)
      : { liters: 0, cost: electricityCost(option.power_kW, run_hrs_yr * units, config.electricity_per_kWh).cost };
    equipment.push({
      id: "INP-02", name: "Pump 1", type: "Vortex Impeller", function: "Raw water transfer",
      unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: option.energy_type,
      annual_energy_units: option.energy_type === "diesel" ? energy.liters : 0,
      annual_energy_cost: energy.cost,
      maintenance_rate: 0.05, annual_maintenance_cost: total_cost * 0.05,
    });
  }

  // ── INP-03: Filter 1 — Ultrafiltration (electric) ─────────
  {
    const daily_water_gal = (nutrients.water_m3_day * 1000) / GAL_TO_L;
    const { option, units } = sizeFilter(daily_water_gal, FILTER_CATALOG);
    const total_cost = option.unit_cost * units;
    const run_hrs_yr = option.run_hrs_day * active_days;
    const e = electricityCost(option.power_kW, run_hrs_yr * units, config.electricity_per_kWh);
    equipment.push({
      id: "INP-03", name: "Filter 1", type: "Ultrafiltration", function: "Water purification",
      unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: "electricity", annual_energy_units: e.kWh, annual_energy_cost: e.cost,
      maintenance_rate: 0.07, annual_maintenance_cost: total_cost * 0.07,
    });
  }

  // ── INP-04: Tank 2s — Filtered water buffer ────────────────
  {
    const buffer_days = 2;
    const required_m3 = buffer_days * nutrients.water_m3_day;
    const { option, units } = sizeTank(required_m3, TANK_CATALOG);
    const total_cost = option.unit_cost * units;
    equipment.push({
      id: "INP-04", name: "Tank 2s", type: "Cone Roof", function: "Filtered water buffer",
      unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: "none", annual_energy_units: 0, annual_energy_cost: 0,
      maintenance_rate: 0.03, annual_maintenance_cost: total_cost * 0.03,
    });
  }

  // ── INP-05: Pump 2s — Tank 2 → ponds (diesel) ─────────────
  {
    const evap_flow_Ls = (nutrients.evap_m3_day * 1000) / (24 * 3600);
    const min_flow_Ls = 2 * evap_flow_Ls;
    const slurry_volume_L = nutrients.slurry_m3_day * 1000;
    const { option, units, run_hrs_day } = sizePumpByFlow(
      slurry_volume_L, [1, 2, 3, 4], PUMP_CATALOG, 20, min_flow_Ls
    );
    const total_cost = option.unit_cost * units;
    const run_hrs_yr = run_hrs_day * active_days;
    const d = dieselCost(option.power_kW, run_hrs_yr * units, config.diesel_per_L);
    equipment.push({
      id: "INP-05", name: "Pump 2s", type: "Diesel Pump", function: "Tank 2 → pond transfer",
      unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: option.energy_type, annual_energy_units: d.liters, annual_energy_cost: d.cost,
      maintenance_rate: 0.05, annual_maintenance_cost: total_cost * 0.05,
    });
  }

  // ── INP-06: Hopper 1s — KNO₃ storage ──────────────────────
  {
    const { option, units } = sizeHopper(nutrients.kno3_tons_day / n_ponds, 30, 2.11, n_ponds, KNO3_HOPPER_CATALOG);
    const total_cost = option.unit_cost * units;
    equipment.push({
      id: "INP-06", name: "Hopper 1s", type: "Dry Storage", function: "KNO₃ storage",
      unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: "none", annual_energy_units: 0, annual_energy_cost: 0,
      maintenance_rate: 0.03, annual_maintenance_cost: total_cost * 0.03,
    });
  }

  // ── INP-07: Hopper 2s — DAP storage ───────────────────────
  {
    const { option, units } = sizeHopper(nutrients.dap_tons_day / n_ponds, 30, 1.62, n_ponds, DAP_HOPPER_CATALOG);
    const total_cost = option.unit_cost * units;
    equipment.push({
      id: "INP-07", name: "Hopper 2s", type: "Dry Storage", function: "DAP storage",
      unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: "none", annual_energy_units: 0, annual_energy_cost: 0,
      maintenance_rate: 0.03, annual_maintenance_cost: total_cost * 0.03,
    });
  }

  // ── INP-08: Hopper 3s — Micronutrient storage ─────────────
  {
    const { option, units } = sizeHopper(nutrients.micro_tons_day / n_ponds, 30, 1.865, n_ponds, MICRO_HOPPER_CATALOG);
    const total_cost = option.unit_cost * units;
    equipment.push({
      id: "INP-08", name: "Hopper 3s", type: "Dry Storage", function: "Micronutrient storage",
      unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: "none", annual_energy_units: 0, annual_energy_cost: 0,
      maintenance_rate: 0.03, annual_maintenance_cost: total_cost * 0.03,
    });
  }

  // ── INP-09: Mix Tank 1s — Nutrient dissolving ─────────────
  {
    const { option, units } = sizeMixTank(n_ponds, MIX_TANK_CATALOG);
    const unit_cost = option.tank_cost + option.propeller_cost;
    const total_cost = unit_cost * units;
    const run_hrs_yr = active_days * 1;
    const e = electricityCost(option.power_kW, run_hrs_yr * units, config.electricity_per_kWh);
    equipment.push({
      id: "INP-09", name: "Mix Tank 1s", type: "Cone + Propeller", function: "Nutrient dissolving",
      unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: "electricity", annual_energy_units: e.kWh, annual_energy_cost: e.cost,
      maintenance_rate: 0.05, annual_maintenance_cost: total_cost * 0.05,
    });
  }

  // ── INP-10: CO₂ Tanks — Liquid CO₂ storage ────────────────
  {
    const buffer_days = 30;
    const required_m3 = (nutrients.co2_tons_day * buffer_days) / CO2_LIQUID_DENSITY_TONS_M3;
    const tank_capacity = 50;
    const units = Math.ceil(required_m3 / tank_capacity);
    const unit_cost = 50000;
    const total_cost = unit_cost * units;
    const power_kW = 0.37285;
    const run_hrs_yr = active_days * 30;
    const e = electricityCost(power_kW, run_hrs_yr * units, config.electricity_per_kWh);
    equipment.push({
      id: "INP-10", name: "CO₂ Tanks", type: "Pressure Vessel", function: "Liquid CO₂ storage",
      unit_cost, units_required: units, total_purchase_cost: total_cost,
      energy_type: "electricity", annual_energy_units: e.kWh, annual_energy_cost: e.cost,
      maintenance_rate: 0.03, annual_maintenance_cost: total_cost * 0.03,
    });
  }

  // ── Aggregation ────────────────────────────────────────────
  const equipment_purchase = equipment.reduce((s, e) => s + e.total_purchase_cost, 0);
  const installation_breakdown = computeInstallationCost(equipment_purchase, "inputs");

  const materials_cost =
    nutrients.co2_tons_yr * config.co2_per_ton +
    nutrients.kno3_tons_yr * config.kno3_per_ton +
    nutrients.dap_tons_yr * config.dap_per_ton +
    nutrients.micro_tons_yr * config.micronutrient_per_ton +
    nutrients.water_m3_yr * config.water_per_m3;

  const energy_cost = equipment.reduce((s, e) => s + e.annual_energy_cost, 0);
  const maintenance_cost = equipment.reduce((s, e) => s + e.annual_maintenance_cost, 0);
  const labor_cost = laborData.sections.inputs.total_annual_cost;
  const operating_cost = materials_cost + energy_cost + maintenance_cost + labor_cost;

  return {
    section_id: "inputs",
    section_name: "Inputs (Water Treatment & Delivery)",
    capital_cost: equipment_purchase + installation_breakdown.grand_total,
    equipment_purchase,
    install_engr_other: installation_breakdown.grand_total,
    installation_breakdown,
    operating_cost, materials_cost, energy_cost, maintenance_cost, labor_cost, equipment,
  };
}
