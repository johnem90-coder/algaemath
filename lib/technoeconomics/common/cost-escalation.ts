// Cost escalation and parametric cost correlations
// Reference: docs/TEA_DESIGN.md Sections 1.4, 2.1, 2.2, 2.5
// Data source: lib/technoeconomics/open-pond/data/cost-correlations.json

// ── Escalation Factors ─────────────────────────────────────────

const ESCALATION_2006_TO_2022 = 1.42;
const ESCALATION_2011_TO_2022 = 1.24;
const AUD_TO_USD = 0.70827;

export function escalate2006to2022(cost_2006: number): number {
  return cost_2006 * ESCALATION_2006_TO_2022;
}

export function escalate2011to2022(cost_2011: number): number {
  return cost_2011 * ESCALATION_2011_TO_2022;
}

export function audToUsd(cost_aud: number): number {
  return cost_aud * AUD_TO_USD;
}

// ── Parametric Cost Correlations ───────────────────────────────

/** Cone roof tank cost as function of capacity (m³) → 2022 USD */
export function tankCost2022(capacity_m3: number): number {
  const cost_2006 = 5700 + 700 * Math.pow(capacity_m3, 0.7);
  return escalate2006to2022(cost_2006);
}

/** Open raceway pond fully installed cost (acres) → 2022 USD
 *  NREL linear correlation, "Full" liner option. Fully installed — no additional factors.
 *  Note: The coefficients (60788, 68046) were fitted to already-escalated 2022 data points
 *  from the NREL reference, so no additional escalation factor is applied. */
export function pondCost2022(acres: number): number {
  return 60788 * acres + 68046;
}

/** Spray dryer cost as function of evaporation rate (kg/hr) → 2022 USD */
export function sprayDryerCost2022(evap_rate_kg_hr: number): number {
  const cost_2006 = 190000 + 180 * Math.pow(evap_rate_kg_hr, 0.9);
  return escalate2006to2022(cost_2006);
}

/** Paddlewheel energy consumption (kWh/acre/day) as function of pond size (acres).
 *  NREL power-law correlation. */
export function paddlewheelEnergyPerAcreDay(acres: number): number {
  return 34.2 * Math.pow(acres, -0.176);
}
