// Three-tier installation cost computation
// Reference: docs/TEA_DESIGN.md Section 1.5
//
// Tier 1 — Installation: equipment_purchase × each installation factor
//   (process_piping, instrumentation, insulation, electrical, buildings,
//    auxiliary_facilities)
//
// Tier 2 — Indirect: installation_total × each indirect factor
//   (engineering, construction)
//
// Tier 3 — Other: (installation_total + indirect_total) × each other factor
//   (contractors_fee, contingency)
//
// Multipliers scale linearly with facility size (n_ponds):
//   - At MIN_PONDS (10): use "high" values (small facilities have higher relative costs)
//   - At MAX_PONDS (100): use "low" values (large facilities benefit from economies of scale)

import type { InstallationBreakdown } from "../types";
import installationFactorsJson from "../open-pond/data/installation-factors.json";

const MIN_PONDS = 10;
const MAX_PONDS = 100;

interface FactorEntry { value: number; low: number; high: number }
interface SectionData {
  has_installation_factors: boolean;
  installation?: Record<string, FactorEntry>;
  indirect?: Record<string, FactorEntry>;
  other?: Record<string, FactorEntry>;
}

/**
 * Interpolate a factor value based on facility size.
 * Small facility (MIN_PONDS) → high value, large facility (MAX_PONDS) → low value.
 */
function interpolateFactor(entry: FactorEntry, nPonds: number): number {
  const t = Math.max(0, Math.min(1, (nPonds - MIN_PONDS) / (MAX_PONDS - MIN_PONDS)));
  // t=0 (small) → high, t=1 (large) → low
  return entry.high + t * (entry.low - entry.high);
}

/**
 * Compute the three-tier installation cost breakdown for a section.
 * Biomass and inoculum return zero (NREL costs are fully installed).
 *
 * @param nPonds — facility size for interpolating multipliers (default: uses midpoint "value")
 */
export function computeInstallationCost(
  equipment_purchase: number,
  sectionId: string,
  nPonds?: number
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

  const usePonds = nPonds != null;
  const getFactor = (entry: FactorEntry) =>
    usePonds ? interpolateFactor(entry, nPonds) : entry.value;

  // Tier 1: Installation factors × equipment purchase
  const installation_factors: Record<string, number> = {};
  let installation_total = 0;
  if (data.installation) {
    for (const [name, entry] of Object.entries(data.installation)) {
      const rate = getFactor(entry);
      const amount = equipment_purchase * rate;
      installation_factors[name] = amount;
      installation_total += amount;
    }
  }

  // Tier 2: Indirect factors × installation total
  const indirect_factors: Record<string, number> = {};
  let indirect_total = 0;
  if (data.indirect) {
    for (const [name, entry] of Object.entries(data.indirect)) {
      const rate = getFactor(entry);
      const amount = installation_total * rate;
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
      const rate = getFactor(entry);
      const amount = base_for_other * rate;
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
