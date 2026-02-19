// ─── Beer-Lambert Light Attenuation Model ──────────────────────────────────
//
// I(z) = I₀ × exp(−ε × X × z)
//
// Models exponential light decay through a microalgae culture.
// Also computes average light intensity (Iavg) and photic depth.
//
// Extracted from: LightAttenuationVisualizer.tsx
// Physics is IDENTICAL to the original inline implementation.
// ────────────────────────────────────────────────────────────────────────────

import type { AttenuationParams, AttenuationResult } from '@/lib/models/types'

/**
 * Light intensity at depth z using Beer-Lambert law.
 *
 * @param I0 - Incident light at surface (μE/m²/s)
 * @param Ka - Specific absorption coefficient (m²/kg)
 * @param X  - Biomass concentration (g/L ≈ kg/m³)
 * @param z  - Depth into culture (m)
 * @returns I(z) in μE/m²/s
 */
export function intensityAtDepth(I0: number, Ka: number, X: number, z: number): number {
    return I0 * Math.exp(-Ka * X * z)
}

/**
 * Average light intensity across a path length L.
 *
 * Iavg = I₀ / (ε·X·L) × (1 − exp(−ε·X·L))
 *
 * When ε·X·L is very small (optically thin), Iavg ≈ I₀.
 *
 * @param I0 - Incident light at surface (μE/m²/s)
 * @param Ka - Specific absorption coefficient (m²/kg)
 * @param X  - Biomass concentration (g/L)
 * @param L  - Optical path length (m)
 * @returns Average light intensity (μE/m²/s)
 */
export function averageIntensity(I0: number, Ka: number, X: number, L: number): number {
    const KaXL = Ka * X * L
    if (KaXL < 0.001) return I0
    return (I0 / KaXL) * (1 - Math.exp(-KaXL))
}

/**
 * Photic depth — the depth z at which I(z) drops below a threshold
 * (default 1 μE/m²/s), capped at the path length L.
 *
 * z_photic = ln(I₀ / threshold) / (ε × X)
 */
export function photicDepth(
    I0: number,
    Ka: number,
    X: number,
    L: number,
    threshold: number = 1
): number {
    const KaX = Ka * X
    if (KaX <= 0.001 || I0 <= threshold) return L
    return Math.min(Math.log(I0 / threshold) / KaX, L)
}

/**
 * Full Beer-Lambert attenuation computation.
 * Returns an AttenuationResult with all derived values.
 *
 * This is the main entry point — produces the same results as the
 * inline calculations in LightAttenuationVisualizer.tsx.
 */
export function computeAttenuation(params: AttenuationParams): AttenuationResult {
    const { I0, Ka, X, L } = params
    const KaX = Ka * X

    // Photic depth (where I drops below 1 μE/m²/s)
    const zPhotic = photicDepth(I0, Ka, X, L)

    // Average intensity across effective photic zone
    const zEff = Math.min(zPhotic, L)
    const KaXZeff = KaX * zEff
    const Iavg = KaXZeff > 0.001
        ? (I0 / KaXZeff) * (1 - Math.exp(-KaXZeff))
        : I0

    return {
        intensityAtDepth: (z: number) => intensityAtDepth(I0, Ka, X, z),
        Iavg,
        zPhotic,
        photicFraction: L > 0 ? zPhotic / L : 1,
    }
}

/** Default parameter values matching the original visualizer */
export const BEER_LAMBERT_DEFAULTS: AttenuationParams = {
    I0: 500,   // μE/m²/s
    X: 2,      // g/L
    Ka: 150,   // m²/kg
    L: 0.1,    // m (10 cm flask)
}
