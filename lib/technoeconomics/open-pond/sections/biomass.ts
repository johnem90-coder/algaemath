// Section: Biomass (Growth Ponds) — 1 equipment item
// Reference: docs/TEA_DESIGN.md Section 2.2

import type { TEAConfig, PondGeometryTEA, SectionCost, EquipmentItem, InstallationBreakdown } from "../../types";
import { pondCost2022, paddlewheelEnergyPerAcreDay } from "../../common/cost-escalation";
import laborData from "../data/labor-roles.json";

export function computeBiomassSection(
  config: TEAConfig,
  geometry: PondGeometryTEA
): SectionCost {
  const equipment: EquipmentItem[] = [];

  // ── BIO-01: Racetrack Ponds ────────────────────────────────
  const n_ponds = geometry.n_ponds;
  const unit_cost = pondCost2022(config.pond_size_acres);
  const total_cost = unit_cost * n_ponds;

  // Paddlewheel energy
  const energy_per_acre_day = paddlewheelEnergyPerAcreDay(config.pond_size_acres);
  const annual_energy_per_pond = energy_per_acre_day * config.pond_size_acres * config.active_days_yr;
  const total_energy_kWh = annual_energy_per_pond * n_ponds;
  const energy_cost = total_energy_kWh * config.electricity_per_kWh;

  equipment.push({
    id: "BIO-01",
    name: "Racetrack Ponds",
    type: "Open Raceway Pond",
    function: "Main algae cultivation — paddlewheel-mixed racetrack",
    unit_cost,
    units_required: n_ponds,
    total_purchase_cost: total_cost,
    energy_type: "electricity",
    annual_energy_units: total_energy_kWh,
    annual_energy_cost: energy_cost,
    maintenance_rate: 0.05,
    annual_maintenance_cost: total_cost * 0.05,
  });

  // ── Aggregation ────────────────────────────────────────────
  const equipment_purchase = total_cost;
  // NREL costs are fully installed — no additional installation factors
  const installation_breakdown: InstallationBreakdown = {
    installation_factors: {}, installation_total: 0,
    indirect_factors: {}, indirect_total: 0,
    other_factors: {}, other_total: 0,
    grand_total: 0,
  };

  const maintenance_cost = total_cost * 0.05;
  const labor_cost = laborData.sections.biomass.total_annual_cost;
  const materials_cost = 0; // Nutrients are in inputs section
  const operating_cost = materials_cost + energy_cost + maintenance_cost + labor_cost;

  return {
    section_id: "biomass",
    section_name: "Biomass (Growth Ponds)",
    capital_cost: equipment_purchase,
    equipment_purchase,
    install_engr_other: 0,
    installation_breakdown,
    operating_cost,
    materials_cost,
    energy_cost,
    maintenance_cost,
    labor_cost,
    equipment,
  };
}
