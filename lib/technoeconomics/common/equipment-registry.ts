// Equipment Type Registry — centralized catalog mapping equipment type IDs
// to their sizing functions, cost models, energy models, and maintenance classes.
//
// Each node in the diagram carries an equipmentTypeId referencing an entry here.
// The diagram-driven engine looks up the type and calls the sizing function.

import type { TEAConfig, PondGeometryTEA, NutrientBalance, EquipmentItem } from "../types";
import type { StreamTypeId } from "./stream-types";
import { electricityCost, dieselCost, naturalGasCost } from "./energy";
import {
  PUMP_CATALOG,
  TANK_CATALOG,
  FILTER_CATALOG,
  KNO3_HOPPER_CATALOG,
  DAP_HOPPER_CATALOG,
  MICRO_HOPPER_CATALOG,
  MIX_TANK_CATALOG,
  SLUDGE_PUMP_CATALOG,
  sizeTank,
  sizePumpByFlow,
  sizeFilter,
  sizeHopper,
  sizeMixTank,
  sizeSludgePump,
} from "./equipment-options";
import { tankCost2022, pondCost2022, sprayDryerCost2022, paddlewheelEnergyPerAcreDay } from "./cost-escalation";
import { CO2_LIQUID_DENSITY_TONS_M3, GAL_TO_L, HEAT_REQUIRED_MJ_PER_TON_WATER, MJ_PER_CUFT_NATURAL_GAS } from "./constants";

// ── Types ──────────────────────────────────────────────────────────

export interface EquipmentTypeEntry {
  id: string;
  name: string;
  category: "source" | "tank" | "pump" | "filter" | "hopper" | "mix-tank" | "dryer" | "storage" | "pond";
  maintenanceClass: "passive" | "mechanical" | "membrane";
  defaultEnergyType: "electricity" | "diesel" | "natural_gas" | "none";
  hasInstallationFactors: boolean;
  inputStreams: StreamTypeId[];
  /** The specific output stream types this equipment produces.
   *  For pass-through equipment (passThrough=true), the actual output stream
   *  matches whatever input stream it receives — outputStreams lists the
   *  possible types for validation only. */
  outputStreams: StreamTypeId[];
  /** If true, the equipment passes its input stream through unchanged
   *  (e.g., tanks, pumps, hoppers). The output stream type = the input stream type.
   *  If false, the equipment transforms its input into specific output streams
   *  (e.g., a filter splits culture into biomass-slurry + filtrate-return). */
  passThrough: boolean;
}

export interface SizingContext {
  config: TEAConfig;
  geometry: PondGeometryTEA;
  nutrients: NutrientBalance;
  incomingFlows: Map<StreamTypeId, number>;
  outgoingStreamTypes: StreamTypeId[];
  nodeLabel: string;
  equipmentId: string;
  equipmentParams?: Record<string, number | string>;
  sectionId: string;
  upstreamEquipment?: EquipmentItem[];
}

export type SizeFunction = (entry: EquipmentTypeEntry, ctx: SizingContext) => EquipmentItem;

// ── Maintenance rate helper ────────────────────────────────────────

function getMaintenanceRate(config: TEAConfig, cls: "passive" | "mechanical" | "membrane"): number {
  switch (cls) {
    case "passive": return config.maintenance_rate_passive;
    case "mechanical": return config.maintenance_rate_mechanical;
    case "membrane": return config.maintenance_rate_membrane;
  }
}

// ── Registry entries ───────────────────────────────────────────────

export const EQUIPMENT_TYPES: Record<string, EquipmentTypeEntry> = {
  "material-source": {
    id: "material-source", name: "Material Source", category: "source",
    maintenanceClass: "passive", defaultEnergyType: "none", hasInstallationFactors: false,
    inputStreams: [],
    outputStreams: [
      "raw-water", "filtered-water", "co2-supply",
      "kno3-supply", "dap-supply", "micro-supply",
      "nutrient-solution", "inoculum",
    ],
    passThrough: false,
  },
  "cone-roof-tank": {
    id: "cone-roof-tank", name: "Cone Roof Tank", category: "tank",
    maintenanceClass: "passive", defaultEnergyType: "none", hasInstallationFactors: true,
    inputStreams: ["raw-water", "filtered-water", "filtrate-return"],
    outputStreams: ["raw-water", "filtered-water", "filtrate-return"],
    passThrough: true,
  },
  "water-pump": {
    id: "water-pump", name: "Water Pump", category: "pump",
    maintenanceClass: "mechanical", defaultEnergyType: "diesel", hasInstallationFactors: true,
    inputStreams: ["raw-water", "filtered-water", "nutrient-solution", "culture", "filtrate-return"],
    outputStreams: ["raw-water", "filtered-water", "nutrient-solution", "culture", "filtrate-return"],
    passThrough: true,
  },
  "uf-filter": {
    id: "uf-filter", name: "UF Filter", category: "filter",
    maintenanceClass: "membrane", defaultEnergyType: "electricity", hasInstallationFactors: true,
    inputStreams: ["raw-water"],
    outputStreams: ["filtered-water"],
    passThrough: false,
  },
  "hopper-kno3": {
    id: "hopper-kno3", name: "KNO₃ Hopper", category: "hopper",
    maintenanceClass: "passive", defaultEnergyType: "none", hasInstallationFactors: true,
    inputStreams: ["kno3-supply"],
    outputStreams: ["kno3-supply"],
    passThrough: true,
  },
  "hopper-dap": {
    id: "hopper-dap", name: "DAP Hopper", category: "hopper",
    maintenanceClass: "passive", defaultEnergyType: "none", hasInstallationFactors: true,
    inputStreams: ["dap-supply"],
    outputStreams: ["dap-supply"],
    passThrough: true,
  },
  "hopper-micro": {
    id: "hopper-micro", name: "Micronutrient Hopper", category: "hopper",
    maintenanceClass: "passive", defaultEnergyType: "none", hasInstallationFactors: true,
    inputStreams: ["micro-supply"],
    outputStreams: ["micro-supply"],
    passThrough: true,
  },
  "mix-tank": {
    id: "mix-tank", name: "Mix Tank", category: "mix-tank",
    maintenanceClass: "mechanical", defaultEnergyType: "electricity", hasInstallationFactors: true,
    inputStreams: ["kno3-supply", "dap-supply", "micro-supply"],
    outputStreams: ["nutrient-solution"],
    passThrough: false,
  },
  "co2-pressure-vessel": {
    id: "co2-pressure-vessel", name: "CO₂ Pressure Vessel", category: "tank",
    maintenanceClass: "passive", defaultEnergyType: "electricity", hasInstallationFactors: true,
    inputStreams: ["co2-supply"],
    outputStreams: ["co2-supply"],
    passThrough: true,
  },
  "raceway-pond": {
    id: "raceway-pond", name: "Raceway Pond", category: "pond",
    maintenanceClass: "mechanical", defaultEnergyType: "electricity", hasInstallationFactors: false,
    inputStreams: ["filtered-water", "nutrient-solution", "co2-supply"],
    outputStreams: ["culture"],
    passThrough: false,
  },
  "inoculum-pond": {
    id: "inoculum-pond", name: "Inoculum Pond", category: "pond",
    maintenanceClass: "mechanical", defaultEnergyType: "electricity", hasInstallationFactors: false,
    inputStreams: ["inoculum"],
    outputStreams: ["inoculum"],
    passThrough: true,
  },
  "slant-screen": {
    id: "slant-screen", name: "Slant Screen", category: "filter",
    maintenanceClass: "passive", defaultEnergyType: "electricity", hasInstallationFactors: true,
    inputStreams: ["culture"],
    outputStreams: ["biomass-slurry", "filtrate-return"],
    passThrough: false,
  },
  "shaker-screen": {
    id: "shaker-screen", name: "Shaker Screen", category: "filter",
    maintenanceClass: "mechanical", defaultEnergyType: "electricity", hasInstallationFactors: true,
    inputStreams: ["biomass-slurry"],
    outputStreams: ["biomass-slurry", "filtrate-return"],
    passThrough: false,
  },
  "vacuum-belt": {
    id: "vacuum-belt", name: "Vacuum Belt Filter", category: "filter",
    maintenanceClass: "membrane", defaultEnergyType: "electricity", hasInstallationFactors: true,
    inputStreams: ["biomass-slurry"],
    outputStreams: ["biomass-slurry", "filtrate-return"],
    passThrough: false,
  },
  "sludge-pump": {
    id: "sludge-pump", name: "Sludge Pump", category: "pump",
    maintenanceClass: "mechanical", defaultEnergyType: "electricity", hasInstallationFactors: true,
    inputStreams: ["biomass-slurry"],
    outputStreams: ["biomass-slurry"],
    passThrough: true,
  },
  "spray-dryer": {
    id: "spray-dryer", name: "Spray Dryer", category: "dryer",
    maintenanceClass: "membrane", defaultEnergyType: "natural_gas", hasInstallationFactors: true,
    inputStreams: ["biomass-slurry"],
    outputStreams: ["dry-product"],
    passThrough: false,
  },
  "dry-bulk-silo": {
    id: "dry-bulk-silo", name: "Dry Bulk Silo", category: "storage",
    maintenanceClass: "passive", defaultEnergyType: "none", hasInstallationFactors: true,
    inputStreams: ["dry-product"],
    outputStreams: ["dry-product"],
    passThrough: true,
  },
};

// ── Sizing Functions ───────────────────────────────────────────────

function sizeMaterialSource(_entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  // Material sources have no equipment purchase cost but DO have annual procurement costs.
  // The outgoing stream type determines which material and its annual cost.
  const { config, nutrients } = ctx;
  const stream = ctx.outgoingStreamTypes[0]; // primary output stream

  let annualCost = 0;
  let annualQty = 0;
  let unit = "";
  let materialName = "External Supply";

  switch (stream) {
    case "raw-water":
    case "filtered-water":
      annualCost = nutrients.water_m3_yr * config.water_per_m3;
      annualQty = nutrients.water_m3_yr;
      unit = "m³/yr";
      materialName = "Water Supply";
      break;
    case "co2-supply":
      annualCost = nutrients.co2_tons_yr * config.co2_per_ton;
      annualQty = nutrients.co2_tons_yr;
      unit = "tons/yr";
      materialName = "CO₂ Supply";
      break;
    case "kno3-supply":
      annualCost = nutrients.kno3_tons_yr * config.kno3_per_ton;
      annualQty = nutrients.kno3_tons_yr;
      unit = "tons/yr";
      materialName = "KNO₃ Supply";
      break;
    case "dap-supply":
      annualCost = nutrients.dap_tons_yr * config.dap_per_ton;
      annualQty = nutrients.dap_tons_yr;
      unit = "tons/yr";
      materialName = "DAP Supply";
      break;
    case "micro-supply":
      annualCost = nutrients.micro_tons_yr * config.micronutrient_per_ton;
      annualQty = nutrients.micro_tons_yr;
      unit = "tons/yr";
      materialName = "Micronutrient Supply";
      break;
  }

  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: materialName,
    function: `Annual procurement: ${annualQty.toFixed(1)} ${unit}`,
    unit_cost: 0, units_required: 0, total_purchase_cost: 0,
    energy_type: "none",
    annual_energy_units: annualQty,
    annual_energy_cost: annualCost,
    maintenance_rate: 0, annual_maintenance_cost: 0,
  };
}

function sizeConeRoofTank(entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config, nutrients } = ctx;
  const mRate = getMaintenanceRate(config, entry.maintenanceClass);

  // Determine buffer days from equipmentParams or infer from section
  let bufferDays = Number(ctx.equipmentParams?.bufferDays ?? 0);
  let dailyDemand = 0;

  // Try to get buffer days from config key
  const configKey = ctx.equipmentParams?.bufferDaysKey as string | undefined;
  if (configKey && configKey in config) {
    bufferDays = (config as unknown as Record<string, number>)[configKey];
  }

  // Determine daily demand from incoming flow
  for (const [, flow] of ctx.incomingFlows) {
    dailyDemand += flow;
  }

  // Fallback: if no incoming flow specified, use water demand
  if (dailyDemand === 0) dailyDemand = nutrients.water_m3_day;
  if (bufferDays === 0) bufferDays = config.tank1_buffer_days;

  // For harvesting filtrate tanks, scale by harvest systems
  const n_harvest_systems = ctx.sectionId === "harvesting" ? ctx.geometry.n_cols : 1;
  const required_m3 = (bufferDays * dailyDemand) / n_harvest_systems;

  const { option, units: units_per_sys } = sizeTank(required_m3, TANK_CATALOG);
  const units = units_per_sys * n_harvest_systems;
  const total_cost = option.unit_cost * units;

  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: "Cone Roof",
    function: "Storage tank",
    unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
    energy_type: "none", annual_energy_units: 0, annual_energy_cost: 0,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

function sizeWaterPump(entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config } = ctx;
  const mRate = getMaintenanceRate(config, entry.maintenanceClass);
  const eta_chain = config.eta_pump * config.eta_drive * config.eta_motor;
  const active_days = config.active_days_yr;
  const harvest_hrs = config.harvest_hours_per_day;

  // Get daily flow volume from incoming streams (m³/day)
  let daily_flow_m3 = 0;
  for (const [, flow] of ctx.incomingFlows) {
    daily_flow_m3 += flow;
  }

  // Determine run hours options based on section
  const isHarvesting = ctx.sectionId === "harvesting";
  const n_systems = isHarvesting ? ctx.geometry.n_cols : 1;
  const flow_per_system = daily_flow_m3 / n_systems;

  // Determine run hours options and min flow
  let runHrsOptions = [4, 6, 8, 12];
  let minFlowLs = 0;

  if (isHarvesting) {
    runHrsOptions = [harvest_hrs];
  } else if (ctx.incomingFlows.has("nutrient-solution")) {
    runHrsOptions = [1, 2, 3, 4];
  }

  // For raw water pumps, set minimum flow to 2× evaporation rate
  if (ctx.incomingFlows.has("raw-water") || ctx.incomingFlows.has("filtered-water")) {
    const evap_flow_Ls = (ctx.nutrients.evap_m3_day * 1000) / (24 * 3600);
    minFlowLs = 2 * evap_flow_Ls;
  }

  const daily_volume_L = flow_per_system * 1000;
  const { option, units: units_per_sys, run_hrs_day } = sizePumpByFlow(
    daily_volume_L, runHrsOptions, PUMP_CATALOG, 20, minFlowLs
  );
  const units = units_per_sys * n_systems;
  const total_cost = option.unit_cost * units;
  const run_hrs_yr = run_hrs_day * active_days;

  let annual_energy_units = 0;
  let annual_energy_cost = 0;
  if (option.energy_type === "diesel") {
    const d = dieselCost(option.power_kW, run_hrs_yr * units, config.diesel_per_L, eta_chain);
    annual_energy_units = d.liters;
    annual_energy_cost = d.cost;
  } else {
    const e = electricityCost(option.power_kW, run_hrs_yr * units, config.electricity_per_kWh);
    annual_energy_units = e.kWh;
    annual_energy_cost = e.cost;
  }

  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: option.label,
    function: "Water transfer pump",
    unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
    energy_type: option.energy_type,
    annual_energy_units, annual_energy_cost,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

function sizeUfFilter(_entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config, nutrients } = ctx;
  const mRate = config.maintenance_rate_membrane;
  const active_days = config.active_days_yr;

  const daily_water_gal = (nutrients.water_m3_day * 1000) / GAL_TO_L;
  const { option, units } = sizeFilter(daily_water_gal, FILTER_CATALOG);
  const total_cost = option.unit_cost * units;

  // Run hours tied to upstream pump — use default 8 hrs
  const run_hrs_yr = 8 * active_days;
  const e = electricityCost(option.power_kW, run_hrs_yr * units, config.electricity_per_kWh);

  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: "Ultrafiltration",
    function: "Water purification",
    unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
    energy_type: "electricity", annual_energy_units: e.kWh, annual_energy_cost: e.cost,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

function sizeKno3Hopper(_entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config, nutrients, geometry } = ctx;
  const mRate = config.maintenance_rate_passive;
  const { option, units } = sizeHopper(
    nutrients.kno3_tons_day / geometry.n_ponds,
    config.hopper_buffer_days, 2.11, geometry.n_ponds, KNO3_HOPPER_CATALOG
  );
  const total_cost = option.unit_cost * units;
  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: "Dry Storage",
    function: "KNO₃ storage",
    unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
    energy_type: "none", annual_energy_units: 0, annual_energy_cost: 0,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

function sizeDapHopper(_entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config, nutrients, geometry } = ctx;
  const mRate = config.maintenance_rate_passive;
  const { option, units } = sizeHopper(
    nutrients.dap_tons_day / geometry.n_ponds,
    config.hopper_buffer_days, 1.62, geometry.n_ponds, DAP_HOPPER_CATALOG
  );
  const total_cost = option.unit_cost * units;
  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: "Dry Storage",
    function: "DAP storage",
    unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
    energy_type: "none", annual_energy_units: 0, annual_energy_cost: 0,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

function sizeMicroHopper(_entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config, nutrients, geometry } = ctx;
  const mRate = config.maintenance_rate_passive;
  const { option, units } = sizeHopper(
    nutrients.micro_tons_day / geometry.n_ponds,
    config.hopper_buffer_days, 1.865, geometry.n_ponds, MICRO_HOPPER_CATALOG
  );
  const total_cost = option.unit_cost * units;
  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: "Dry Storage",
    function: "Micronutrient storage",
    unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
    energy_type: "none", annual_energy_units: 0, annual_energy_cost: 0,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

function sizeMixTankEquip(_entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config, geometry } = ctx;
  const mRate = config.maintenance_rate_mechanical;
  const active_days = config.active_days_yr;
  const { option, units } = sizeMixTank(geometry.n_ponds, MIX_TANK_CATALOG);
  const unit_cost = option.tank_cost + option.propeller_cost;
  const total_cost = unit_cost * units;
  const run_hrs_yr = active_days * 1;
  const e = electricityCost(option.propeller_power_kW, run_hrs_yr * units, config.electricity_per_kWh);
  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: "Cone + Propeller",
    function: "Nutrient dissolving",
    unit_cost, units_required: units, total_purchase_cost: total_cost,
    energy_type: "electricity", annual_energy_units: e.kWh, annual_energy_cost: e.cost,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

function sizeCo2PressureVessel(_entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config, nutrients } = ctx;
  const mRate = config.maintenance_rate_passive;
  const active_days = config.active_days_yr;
  const required_m3 = (nutrients.co2_tons_day * config.co2_tank_buffer_days) / CO2_LIQUID_DENSITY_TONS_M3;
  const tank_capacity = 50;
  const units = Math.ceil(required_m3 / tank_capacity);
  const unit_cost = 50000;
  const total_cost = unit_cost * units;
  const power_kW = 0.37285;
  const run_hrs_yr = active_days * 24;
  const e = electricityCost(power_kW, run_hrs_yr * units, config.electricity_per_kWh);
  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: "Pressure Vessel",
    function: "Liquid CO₂ storage",
    unit_cost, units_required: units, total_purchase_cost: total_cost,
    energy_type: "electricity", annual_energy_units: e.kWh, annual_energy_cost: e.cost,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

function sizeRacewayPond(_entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config, geometry } = ctx;
  const mRate = config.maintenance_rate_mechanical;
  const n_ponds = geometry.n_ponds;
  const unit_cost = pondCost2022(config.pond_size_acres);
  const total_cost = unit_cost * n_ponds;
  const energy_per_acre_day = paddlewheelEnergyPerAcreDay(config.pond_size_acres);
  const total_energy_kWh = energy_per_acre_day * config.pond_size_acres * config.active_days_yr * n_ponds;
  const energy_cost = total_energy_kWh * config.electricity_per_kWh;
  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: "Open Raceway Pond",
    function: "Main algae cultivation — paddlewheel-mixed racetrack",
    unit_cost, units_required: n_ponds, total_purchase_cost: total_cost,
    energy_type: "electricity", annual_energy_units: total_energy_kWh, annual_energy_cost: energy_cost,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

function sizeInoculumPond(_entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config, geometry } = ctx;
  const mRate = config.maintenance_rate_mechanical;
  const n_production_ponds = geometry.n_ponds;
  const tierIndex = Number(ctx.equipmentParams?.tierIndex ?? 0);
  const tier = config.inoculum_tiers[tierIndex];
  if (!tier) {
    // Fallback if tier index is out of range
    return {
      id: ctx.equipmentId, name: ctx.nodeLabel, type: "Inoculum Pond",
      function: "Inoculum tier",
      unit_cost: 0, units_required: 0, total_purchase_cost: 0,
      energy_type: "none", annual_energy_units: 0, annual_energy_cost: 0,
      maintenance_rate: mRate, annual_maintenance_cost: 0,
    };
  }

  const n_tiers = config.inoculum_tiers.length;
  const target_weeks = Math.round(config.inoculation_target_months * (52 / 12));
  const startup_weeks = n_tiers;
  const production_weeks = Math.max(1, target_weeks - startup_weeks);
  const ponds_per_tier = Math.ceil(n_production_ponds / production_weeks);

  const tier_acres = config.pond_size_acres * tier.size_fraction;
  const unit_cost = pondCost2022(tier_acres);
  const total_cost = unit_cost * ponds_per_tier;
  const energy_per_acre_day = paddlewheelEnergyPerAcreDay(tier_acres);
  const total_energy_kWh = energy_per_acre_day * tier_acres * config.active_days_yr * ponds_per_tier;
  const energy_cost = total_energy_kWh * config.electricity_per_kWh;

  return {
    id: ctx.equipmentId, name: ctx.nodeLabel,
    type: `Open Raceway Pond (${tier_acres} acre)`,
    function: `Inoculum tier — ${tier.name}`,
    unit_cost, units_required: ponds_per_tier, total_purchase_cost: total_cost,
    energy_type: "electricity", annual_energy_units: total_energy_kWh, annual_energy_cost: energy_cost,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

function sizeSlantScreen(_entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config, geometry } = ctx;
  const mRate = config.maintenance_rate_passive;
  const harvest_hrs = config.harvest_hours_per_day;
  const active_days = config.active_days_yr;
  const n_harvest_systems = geometry.n_cols;

  const V_transfer_daily = geometry.V_system_m3 * config.effective_growth_rate_per_day;
  const inlet_flow_per_system = V_transfer_daily / n_harvest_systems;
  const inlet_flow_m3_hr = inlet_flow_per_system / harvest_hrs;

  const available_m3_hr = 30;
  const units_per_system = Math.ceil(inlet_flow_m3_hr / available_m3_hr);
  const units = units_per_system * n_harvest_systems;
  const unit_cost = 3000;
  const total_cost = unit_cost * units;
  const power_kW = 2.2;
  const run_hrs_yr = units * harvest_hrs * active_days;
  const e = electricityCost(power_kW, run_hrs_yr, config.electricity_per_kWh);

  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: "Slant Screen",
    function: "Primary biomass separation",
    unit_cost, units_required: units, total_purchase_cost: total_cost,
    energy_type: "electricity", annual_energy_units: e.kWh, annual_energy_cost: e.cost,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

function sizeShakerScreen(_entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config } = ctx;
  const mRate = config.maintenance_rate_mechanical;
  const harvest_hrs = config.harvest_hours_per_day;
  const active_days = config.active_days_yr;

  // Match upstream filter count (slant screen)
  const upstream = ctx.upstreamEquipment?.find(
    (e) => e.type === "Slant Screen" || e.name.toLowerCase().includes("filter 2")
  );
  const units = upstream?.units_required ?? 1;

  const unit_cost = 3000;
  const total_cost = unit_cost * units;
  const power_kW = 0.75;
  const run_hrs_yr = units * harvest_hrs * active_days;
  const e = electricityCost(power_kW, run_hrs_yr, config.electricity_per_kWh);

  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: "Shaker Screen",
    function: "Biomass chunk breakup",
    unit_cost, units_required: units, total_purchase_cost: total_cost,
    energy_type: "electricity", annual_energy_units: e.kWh, annual_energy_cost: e.cost,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

function sizeVacuumBelt(_entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config, geometry } = ctx;
  const mRate = config.maintenance_rate_membrane;
  const harvest_hrs = config.harvest_hours_per_day;
  const active_days = config.active_days_yr;
  const n_harvest_systems = geometry.n_cols;

  const V_transfer_daily = geometry.V_system_m3 * config.effective_growth_rate_per_day;
  const inlet_flow_per_system = V_transfer_daily / n_harvest_systems;
  const inlet_flow_m3_hr = inlet_flow_per_system / harvest_hrs;
  const post_filter3_flow = inlet_flow_m3_hr * (1 - config.filter3_efficiency);

  const available_m3_hr = 30;
  const units_per_system = Math.ceil(post_filter3_flow / available_m3_hr);
  const units = Math.max(1, units_per_system) * n_harvest_systems;
  const unit_cost = 30000;
  const total_cost = unit_cost * units;
  const power_kW = 2.6;
  const run_hrs_yr = units * harvest_hrs * active_days;
  const e = electricityCost(power_kW, run_hrs_yr, config.electricity_per_kWh);

  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: "Vacuum Belt",
    function: "Wash & dewater biomass",
    unit_cost, units_required: units, total_purchase_cost: total_cost,
    energy_type: "electricity", annual_energy_units: e.kWh, annual_energy_cost: e.cost,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

function sizeSludgePumpEquip(_entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config, geometry } = ctx;
  const mRate = config.maintenance_rate_mechanical;
  const harvest_hrs = config.harvest_hours_per_day;
  const active_days = config.active_days_yr;
  const n_drying_systems = geometry.n_cols;

  const daily_production_tons = geometry.Q_actual_tons_yr / active_days;
  const daily_wet_input_tons = daily_production_tons / (1 - config.dryer_inlet_water_content);
  const slurry_flow_m3_hr = daily_wet_input_tons / n_drying_systems / harvest_hrs;

  const { option, units: units_per_sys } = sizeSludgePump(slurry_flow_m3_hr, SLUDGE_PUMP_CATALOG);
  const units = units_per_sys * n_drying_systems;
  const total_cost = option.unit_cost * units;
  const run_hrs_yr = units * harvest_hrs * active_days;
  const e = electricityCost(option.power_kW, run_hrs_yr, config.electricity_per_kWh);

  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: option.label,
    function: "Slurry transfer to dryer",
    unit_cost: option.unit_cost, units_required: units, total_purchase_cost: total_cost,
    energy_type: "electricity", annual_energy_units: e.kWh, annual_energy_cost: e.cost,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

function sizeSprayDryer(_entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config, geometry } = ctx;
  const mRate = config.maintenance_rate_membrane;
  const active_days = config.active_days_yr;
  const harvest_hrs = config.harvest_hours_per_day;
  const n_drying_systems = geometry.n_cols;

  const daily_production_tons = geometry.Q_actual_tons_yr / active_days;
  const daily_wet_input_tons = daily_production_tons / (1 - config.dryer_inlet_water_content);
  const daily_water_evap_tons = daily_wet_input_tons - daily_production_tons / (1 - config.dryer_outlet_water_content);
  const evap_rate_kg_hr = (daily_water_evap_tons * 1000) / harvest_hrs;

  const units = n_drying_systems;
  const evap_per_dryer = evap_rate_kg_hr / units;
  const unit_cost = sprayDryerCost2022(evap_per_dryer);
  const total_cost = unit_cost * units;

  const annual_water_evap_tons = daily_water_evap_tons * active_days;
  const heat_required_MJ = annual_water_evap_tons * HEAT_REQUIRED_MJ_PER_TON_WATER;
  const heat_input_MJ = (heat_required_MJ / config.dryer_efficiency) * config.dryer_operating_factor;
  const annual_gas_cuft = heat_input_MJ / MJ_PER_CUFT_NATURAL_GAS;
  const gas_cost = naturalGasCost(annual_gas_cuft, config.natural_gas_per_cuft);

  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: "Spray Dryer",
    function: "Evaporate water from slurry to dry powder",
    unit_cost, units_required: units, total_purchase_cost: total_cost,
    energy_type: "natural_gas", annual_energy_units: annual_gas_cuft, annual_energy_cost: gas_cost,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

function sizeDryBulkSilo(_entry: EquipmentTypeEntry, ctx: SizingContext): EquipmentItem {
  const { config, geometry } = ctx;
  const mRate = config.maintenance_rate_passive;
  const active_days = config.active_days_yr;

  const daily_production_tons = geometry.Q_actual_tons_yr / active_days;
  const silo_capacity_tons = 10;
  const required_tons = daily_production_tons * config.silo_buffer_days;
  const units = Math.max(1, Math.ceil(required_tons / silo_capacity_tons));
  const unit_cost = 10000;
  const total_cost = unit_cost * units;

  return {
    id: ctx.equipmentId, name: ctx.nodeLabel, type: "Dry Bulk Storage",
    function: "Finished product storage",
    unit_cost, units_required: units, total_purchase_cost: total_cost,
    energy_type: "none", annual_energy_units: 0, annual_energy_cost: 0,
    maintenance_rate: mRate, annual_maintenance_cost: total_cost * mRate,
  };
}

// ── Sizing function dispatch map ───────────────────────────────────

export const SIZING_FUNCTIONS: Record<string, SizeFunction> = {
  "material-source": sizeMaterialSource,
  "cone-roof-tank": sizeConeRoofTank,
  "water-pump": sizeWaterPump,
  "uf-filter": sizeUfFilter,
  "hopper-kno3": sizeKno3Hopper,
  "hopper-dap": sizeDapHopper,
  "hopper-micro": sizeMicroHopper,
  "mix-tank": sizeMixTankEquip,
  "co2-pressure-vessel": sizeCo2PressureVessel,
  "raceway-pond": sizeRacewayPond,
  "inoculum-pond": sizeInoculumPond,
  "slant-screen": sizeSlantScreen,
  "shaker-screen": sizeShakerScreen,
  "vacuum-belt": sizeVacuumBelt,
  "sludge-pump": sizeSludgePumpEquip,
  "spray-dryer": sizeSprayDryer,
  "dry-bulk-silo": sizeDryBulkSilo,
};

// Suppress unused import warning — tankCost2022 is used by TANK_CATALOG via equipment-options
void tankCost2022;
