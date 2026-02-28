// Racetrack pond geometry calculations
// Reference: docs/SIMULATION_DESIGN.md Section 2.5

import type { OpenPondGeometry } from "./types";

/**
 * Compute racetrack (slot-shape) pond geometry from design parameters.
 *
 * The pond is two straight channels connected by semicircular ends,
 * separated by a center berm (divider wall).
 *
 * Slot-shape area = (L - W) × W + π × (W/2)²
 * Culture area = slot area − berm area  (berm runs along straight sections only)
 *
 * @param area_ha - Reference area W×L in hectares (used to derive W and L)
 * @param aspect_ratio - L / W ratio
 * @param depth - Culture depth in meters
 * @param berm_width - Center divider width in meters (0 = no berm)
 */
export function computeGeometry(
  area_ha: number,
  aspect_ratio: number,
  depth: number,
  berm_width: number = 0
): OpenPondGeometry {
  const A = area_ha * 10000; // Convert hectares to m²
  const W = Math.sqrt(A / aspect_ratio); // Outer width (m)
  const Ltotal = A / W; // Total length (m)

  // Slot-shape surface area: rectangular center + two semicircular ends
  const L_straight = Ltotal - W; // Length of each straight section
  const A_slot = L_straight * W + Math.PI * (W / 2) ** 2;

  // Subtract berm (runs along straight sections only, not the semicircular ends)
  const A_berm = L_straight * berm_width;
  const A_surface = A_slot - A_berm;

  // Outer perimeter: two straights + one full circle
  const perimeter = 2 * L_straight + Math.PI * W;

  // Ground contact area includes side walls
  const A_soil = A_surface + perimeter * depth;

  // Culture volume
  const V_m3 = A_surface * depth;
  const V_liters = V_m3 * 1000;

  return { W, Ltotal, A_surface, perimeter, A_soil, V_m3, V_liters };
}
