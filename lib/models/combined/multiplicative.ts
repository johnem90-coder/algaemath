// ─── Multiplicative Combined Growth Model ──────────────────────────────────
//
// μ_eff = μ_max × f(I) × f(T) × f(S)
//
// The standard multiplicative approach: each environmental factor independently
// limits growth as a fraction [0, 1] of the maximum. The effective growth rate
// is the product of all limitation factors.
//
// Extracted from: CombinedEffectsVisualizer.tsx
// Physics is IDENTICAL to the original inline implementation.
// ────────────────────────────────────────────────────────────────────────────

import type { CombinedModel, CombinedFactors, CombinedModelParams } from '@/lib/models/types'

/**
 * Multiplicative combined growth rate.
 * μ_eff = μ_max × f(I) × f(T) × f(S)
 *
 * @param factors - Individual limitation factors, each ∈ [0, 1]
 * @param params  - Contains muMax
 * @returns Effective growth rate (/day)
 */
export function multiplicativeGrowthRate(
    factors: CombinedFactors,
    params: CombinedModelParams
): number {
    return params.muMax * factors.fI * factors.fT * factors.fS
}

/** Full model object conforming to the CombinedModel interface */
export const multiplicativeModel: CombinedModel = {
    id: 'multiplicative',
    name: 'Multiplicative Limitation',
    description:
        'Standard multiplicative model where each environmental factor (light, temperature, ' +
        'nutrient) independently limits growth as a fraction of the maximum rate. The effective ' +
        'growth rate is the product of all limitation factors times μ_max. This is the most ' +
        'commonly used approach in microalgae growth modeling.',

    calculate: multiplicativeGrowthRate,

    reference: {
        citation: 'Goldman, J.C. (1979). Outdoor algal mass cultures — II. Photosynthetic yield limitations. Water Research, 13(2), 119–136.',
        doi: '10.1016/0043-1354(79)90083-6',
        year: 1979,
    },
}

/** Default muMax matching the original visualizer */
export const MULTIPLICATIVE_DEFAULTS: CombinedModelParams = {
    muMax: 4.0, // /day
}
