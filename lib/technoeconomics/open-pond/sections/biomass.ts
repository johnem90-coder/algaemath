// Section: Biomass (Growth Ponds) — 1 equipment item
// Reference: docs/TEA_DESIGN.md Section 2.2

import type { TEAConfig, PondGeometryTEA, SectionCost, EquipmentItem, InstallationBreakdown, LaborRole } from "../../types";
import { pondCost2022, paddlewheelEnergyPerAcreDay } from "../../common/cost-escalation";

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
    maintenance_rate: config.maintenance_rate_mechanical,
    annual_maintenance_cost: total_cost * config.maintenance_rate_mechanical,
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

  const maintenance_cost = equipment.reduce((s, e) => s + e.annual_maintenance_cost, 0);
  const labor_cost = config.labor.biomass.reduce((s: number, r: LaborRole) => s + r.headcount * r.annual_salary, 0);
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
