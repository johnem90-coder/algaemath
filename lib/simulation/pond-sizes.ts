/**
 * Pond size definitions for simulation and visualization.
 *
 * Each pond is a stadium-shape (racetrack): two rectangular channels
 * connected by two semicircular ends, separated by a center berm.
 *
 * Geometry decomposition:
 *   A_rect = L_straight × (W − berm)       two rectangular channels
 *   A_semi = π × (W/2)²                    two semicircular ends (= full circle)
 *   A_total = A_rect + A_semi              total culture surface area
 *   Volume  = A_total × depth
 */

export interface PondSize {
  id: string;
  name: string;
  length: number;        // total stadium length (m)
  width: number;         // total stadium width (m)
  berm: number;          // center berm/divider width (m)

  // Derived (computed below)
  radius: number;        // semicircle end radius = width / 2 (m)
  straightLength: number; // straight edge = length − width (m)
  channelWidth: number;  // per-side channel = (width − berm) / 2 (m)
  areaRect: number;      // two rectangular channels (m²)
  areaSemi: number;      // two semicircular ends (m²)
  areaTotal: number;     // total culture surface area (m²)
  fractionStraight: number; // A_rect / A_total
  fractionCurved: number;   // A_semi / A_total
}

function makePond(id: string, name: string, length: number, width: number, berm: number): PondSize {
  const radius = width / 2;
  const straightLength = length - width;
  const channelWidth = (width - berm) / 2;
  const areaRect = straightLength * (width - berm);
  const areaSemi = Math.PI * radius * radius;
  const areaTotal = areaRect + areaSemi;
  return {
    id, name, length, width, berm,
    radius, straightLength, channelWidth,
    areaRect, areaSemi, areaTotal,
    fractionStraight: areaRect / areaTotal,
    fractionCurved: areaSemi / areaTotal,
  };
}

/** Small demo pond used on the explorations page (matches 3D diagrams) */
export const POND_DEMO = makePond("demo", "Demo Pond", 4.4, 1.4, 0.2);

/** Production-scale raceway (~1 acre, 250m × 17m) */
export const POND_PRODUCTION = makePond("production", "Production Raceway", 250, 17, 0.8);

/** All available pond sizes */
export const POND_SIZES: PondSize[] = [POND_DEMO, POND_PRODUCTION];
