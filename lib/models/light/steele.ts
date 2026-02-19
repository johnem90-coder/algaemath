// ─── Steele (1962) Photoinhibition Model ───────────────────────────────────
//
// f(I) = (I / Iopt) × exp(1 − I / Iopt)
//
// A single-parameter light response model that captures both light limitation
// (below Iopt) and photoinhibition (above Iopt). The factor peaks at exactly
// f(Iopt) = 1.0 and declines symmetrically on a log scale.
//
// Extracted from: LightEffectsVisualizer.tsx, CombinedEffectsVisualizer.tsx
// Physics is IDENTICAL to the original inline implementation.
// ────────────────────────────────────────────────────────────────────────────

import type { LightModel, LightModelParams } from '@/lib/models/types'

/**
 * Steele light limitation factor.
 * Returns a value in [0, 1] where 1.0 occurs at I = Iopt.
 *
 * @param I  - Light intensity (μE/m²/s), must be ≥ 0
 * @param Iopt - Optimal light intensity (μE/m²/s)
 * @returns f(I) ∈ [0, 1]
 */
export function steeleLightFactor(I: number, Iopt: number): number {
    if (I <= 0 || Iopt <= 0) return 0
    const ratio = I / Iopt
    return ratio * Math.exp(1 - ratio)
}

/**
 * Steele effective growth rate.
 * μ = μ_max × f(I)
 */
export function steeleGrowthRate(I: number, params: LightModelParams): number {
    return params.muMax * steeleLightFactor(I, params.Iopt)
}

/** Full model object conforming to the LightModel interface */
export const steeleModel: LightModel = {
    id: 'steele-1962',
    name: 'Steele Photoinhibition',
    description:
        'Single-parameter model capturing both light limitation and photoinhibition. ' +
        'Growth rate peaks at the optimal intensity Iopt and declines at higher intensities ' +
        'due to photodamage of the photosynthetic apparatus.',
    category: 'inhibition',

    calculate: (I: number, params: LightModelParams) =>
        steeleLightFactor(I, params.Iopt),

    growthRate: steeleGrowthRate,

    reference: {
        citation: 'Steele, J.H. (1962). Environmental control of photosynthesis in the sea. Limnology and Oceanography, 7(2), 137–150.',
        doi: '10.4319/lo.1962.7.2.0137',
        year: 1962,
    },

    parameterRanges: {
        I: [0, 2000],      // μE/m²/s — typical PAR range
        Iopt: [50, 500],   // μE/m²/s — species-dependent optimum
        muMax: [0.1, 5.0], // /day — species-dependent max growth rate
    },

    useCases: [
        'Quick estimation of light-limited growth with photoinhibition',
        'Species comparison at different light optima',
        'First-order photobioreactor modeling',
    ],

    limitations: [
        'Symmetric decline above Iopt — real photoinhibition is often asymmetric',
        'No photoacclimation — assumes fixed Iopt regardless of light history',
        'Single optimal intensity — does not capture chromatic adaptation',
        'No time-dependent photodamage or repair kinetics',
    ],
}
