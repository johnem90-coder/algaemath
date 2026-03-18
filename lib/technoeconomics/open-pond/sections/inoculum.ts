// Section: Inoculum (Scaling Ponds) — one equipment item per tier
// Reference: docs/TEA_DESIGN.md Section 2.3
//
// Pond counts are calculated from the inoculation timeline:
//   - Each tier pond takes 1 week (cycle_days / 7) to grow from 0.05 → 0.5 g/L
//   - Pipeline startup = n_tiers weeks (each tier adds 1 week)
//   - Available production weeks = target_weeks - startup_weeks
//   - Ponds per tier = ceil(n_production_ponds / production_weeks)

import type { TEAConfig, PondGeometryTEA, SectionCost, EquipmentItem, InstallationBreakdown } from "../../types";
import { pondCost2022, paddlewheelEnergyPerAcreDay } from "../../common/cost-escalation";
import laborData from "../data/labor-roles.json";

export function computeInoculumSection(
  config: TEAConfig,
  geometry: PondGeometryTEA
): SectionCost {
  const equipment: EquipmentItem[] = [];
  const n_production_ponds = geometry.n_ponds;

  // ── Calculate ponds per tier from inoculation timeline ─────
  const n_tiers = config.inoculum_tiers.length;
  const target_weeks = Math.round(config.inoculation_target_months * (52 / 12)); // months → weeks
  const startup_weeks = n_tiers; // each tier adds 1 week to pipeline
  const production_weeks = Math.max(1, target_weeks - startup_weeks);
  const ponds_per_tier = Math.ceil(n_production_ponds / production_weeks);

  // ── Build equipment for each tier ──────────────────────────
  config.inoculum_tiers.forEach((tier, i) => {
    const tier_acres = config.pond_size_acres * tier.size_fraction;
    const count = ponds_per_tier;

    const unit_cost = pondCost2022(tier_acres);
    const total_cost = unit_cost * count;

    // Paddlewheel energy
    const energy_per_acre_day = paddlewheelEnergyPerAcreDay(tier_acres);
    const annual_energy_per_pond = energy_per_acre_day * tier_acres * config.active_days_yr;
    const total_energy_kWh = annual_energy_per_pond * count;
    const energy_cost = total_energy_kWh * config.electricity_per_kWh;

    const tier_letter = String.fromCharCode(65 + (n_tiers - 1 - i)); // A, B, C from largest to smallest
    equipment.push({
      id: `INO-${String(i + 1).padStart(2, "0")}`,
      name: tier.name,
      type: `Open Raceway Pond (${tier_acres} acre)`,
      function: `Inoculum tier ${tier_letter} — ${tier.name}`,
      unit_cost,
      units_required: count,
      total_purchase_cost: total_cost,
      energy_type: "electricity",
      annual_energy_units: total_energy_kWh,
      annual_energy_cost: energy_cost,
      maintenance_rate: 0.05,
      annual_maintenance_cost: total_cost * 0.05,
    });
  });

  // ── Aggregation ────────────────────────────────────────────
  const equipment_purchase = equipment.reduce((s, e) => s + e.total_purchase_cost, 0);
  const installation_breakdown: InstallationBreakdown = {
    installation_factors: {}, installation_total: 0,
    indirect_factors: {}, indirect_total: 0,
    other_factors: {}, other_total: 0,
    grand_total: 0,
  };

  const energy_cost = equipment.reduce((s, e) => s + e.annual_energy_cost, 0);
  const maintenance_cost = equipment.reduce((s, e) => s + e.annual_maintenance_cost, 0);
  const labor_cost = laborData.sections.inoculum.total_annual_cost;
  const materials_cost = 0;
  const operating_cost = materials_cost + energy_cost + maintenance_cost + labor_cost;

  return {
    section_id: "inoculum",
    section_name: "Inoculum (Scaling Ponds)",
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
