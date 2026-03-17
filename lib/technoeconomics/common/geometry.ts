// TEA racetrack pond geometry and system sizing
// Reference: docs/TEA_DESIGN.md Section 1.2

import type { TEAConfig, PondGeometryTEA } from "../types";
import { ACRES_TO_M2 } from "./constants";

/**
 * Compute racetrack pond geometry and system-level sizing for TEA.
 *
 * This is separate from the simulation geometry (lib/simulation/simple-outdoor/geometry.ts)
 * which uses hectares and berm width. The TEA geometry uses acres, L:W ratio,
 * and computes facility-level quantities (n_ponds, land area, etc.).
 */
export function computeTEAPondGeometry(config: TEAConfig): PondGeometryTEA {
  const A_pond_m2 = config.pond_size_acres * ACRES_TO_M2;
  const AR = config.pond_lw_ratio;

  // ── Single pond dimensions ─────────────────────────────────
  const W = Math.sqrt(A_pond_m2 / AR); // Channel width (m)
  const L_total = W * AR; // Total length (m)
  const SA = W * (L_total - W) + Math.PI * (W / 2) ** 2; // Surface area (m²)
  const perimeter = 2 * (L_total - W) + Math.PI * W; // Outer perimeter (m)
  const V_pond_m3 = SA * config.pond_depth_m; // Culture volume (m³)

  // ── System sizing ──────────────────────────────────────────
  const BM_production_rate = config.density_at_harvest_g_L * config.effective_growth_rate_per_day; // g/L/day
  const BM_production_annual = BM_production_rate * config.active_days_yr; // g/L/yr

  const V_required_L = (config.desired_output_tons_yr * 1e6) / BM_production_annual; // L
  const V_required_m3 = V_required_L / 1000; // m³

  const n_ponds_min = Math.ceil(V_required_m3 / V_pond_m3);

  // ── Land layout ────────────────────────────────────────────
  const n_rows = Math.ceil(n_ponds_min / 2); // Ponds arranged in 2 columns
  const n_cols = Math.min(2, n_ponds_min); // 1 or 2 columns

  // Round pond count up to fill the grid (n_rows × n_cols)
  const n_ponds = n_rows * n_cols;
  const V_system_m3 = n_ponds * V_pond_m3;

  // Actual production (may exceed target due to rounding up)
  const Q_actual_tons_yr = (n_ponds * V_pond_m3 * 1000 * BM_production_annual) / 1e6;

  const land_width = n_cols * (W + config.pond_spacing_col_m); // m
  const land_length = n_rows * (L_total + config.pond_spacing_row_m); // m
  const A_land_m2 = land_width * land_length;
  const A_land_acres = A_land_m2 / ACRES_TO_M2;

  // ── Liner area ─────────────────────────────────────────────
  const L_straight = L_total - W;
  const A_bottom = SA;
  const A_flat_sides = 2 * L_straight * config.pond_depth_m;
  const A_round_sides = Math.PI * W * config.pond_depth_m;
  const liner_area_per_pond_m2 = A_bottom + A_flat_sides + A_round_sides;
  const liner_area_total_m2 = liner_area_per_pond_m2 * n_ponds;

  return {
    W,
    L_total,
    SA,
    perimeter,
    V_pond_m3,
    n_ponds,
    Q_actual_tons_yr,
    V_system_m3,
    n_rows,
    n_cols,
    A_land_m2,
    A_land_acres,
    liner_area_per_pond_m2,
    liner_area_total_m2,
  };
}
