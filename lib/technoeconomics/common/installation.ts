// Three-tier installation cost computation
// Reference: docs/TEA_DESIGN.md Section 1.5
//
// Tier 1 — Installation: equipment_purchase × each installation factor
//   (process_piping, instrumentation, insulation, electrical, buildings,
//    yard_improvement, auxiliary_facilities)
//
// Tier 2 — Indirect: installation_total × each indirect factor
//   (engineering, construction)
//
// Tier 3 — Other: (installation_total + indirect_total) × each other factor
//   (contractors_fee, contingency)

import type { InstallationBreakdown } from "../types";
import installationFactorsJson from "../open-pond/data/installation-factors.json";

interface FactorEntry { value: number }
interface SectionData {
  has_installation_factors: boolean;
  installation?: Record<string, FactorEntry>;
  indirect?: Record<string, FactorEntry>;
  other?: Record<string, FactorEntry>;
}

/**
 * Compute the three-tier installation cost breakdown for a section.
 * Biomass and inoculum return zero (NREL costs are fully installed).
 */
export function computeInstallationCost(
  equipment_purchase: number,
  sectionId: string
): InstallationBreakdown {
  const data = (installationFactorsJson as unknown as Record<string, SectionData>)[sectionId];

  const empty: InstallationBreakdown = {
    installation_factors: {},
    installation_total: 0,
    indirect_factors: {},
    indirect_total: 0,
    other_factors: {},
    other_total: 0,
    grand_total: 0,
  };

  if (!data || !data.has_installation_factors) {
    return empty;
  }

  // Tier 1: Installation factors × equipment purchase
  const installation_factors: Record<string, number> = {};
  let installation_total = 0;
  if (data.installation) {
    for (const [name, entry] of Object.entries(data.installation)) {
      const amount = equipment_purchase * entry.value;
      installation_factors[name] = amount;
      installation_total += amount;
    }
  }

  // Tier 2: Indirect factors × installation total
  const indirect_factors: Record<string, number> = {};
  let indirect_total = 0;
  if (data.indirect) {
    for (const [name, entry] of Object.entries(data.indirect)) {
      const amount = installation_total * entry.value;
      indirect_factors[name] = amount;
      indirect_total += amount;
    }
  }

  // Tier 3: Other factors × (installation + indirect)
  const other_factors: Record<string, number> = {};
  let other_total = 0;
  const base_for_other = installation_total + indirect_total;
  if (data.other) {
    for (const [name, entry] of Object.entries(data.other)) {
      const amount = base_for_other * entry.value;
      other_factors[name] = amount;
      other_total += amount;
    }
  }

  return {
    installation_factors,
    installation_total,
    indirect_factors,
    indirect_total,
    other_factors,
    other_total,
    grand_total: installation_total + indirect_total + other_total,
  };
}
