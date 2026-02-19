// ─── Modified Monod Nutrient Uptake Model ──────────────────────────────────
//
// f(S) = min(1, scaleFactor × S / (Ks + S))
// where scaleFactor = (Ks + Sopt) / Sopt
//
// A modified Monod (Michaelis-Menten) model that reaches f(S) = 1.0 at
// a defined optimal concentration Sopt, rather than asymptotically
// approaching 1. Above Sopt the factor is clamped to 1.0.
//
// Extracted from: NutrientEffectsVisualizer.tsx, CombinedEffectsVisualizer.tsx
// Physics is IDENTICAL to the original inline implementation.
// ────────────────────────────────────────────────────────────────────────────

import type { NutrientModel, NutrientModelParams } from '@/lib/models/types'

/**
 * Modified Monod nutrient limitation factor.
 * Returns a value in [0, 1] where 1.0 occurs at S = Sopt.
 *
 * The scale factor ensures the standard Monod curve is shifted so that
 * f(Sopt) = 1.0 exactly, rather than the standard asymptotic approach.
 *
 * @param S    - Nutrient concentration (mM)
 * @param Ks   - Half-saturation constant (mM)
 * @param Sopt - Optimal / saturating concentration (mM)
 * @returns f(S) ∈ [0, 1]
 */
export function monodNutrientFactor(S: number, Ks: number, Sopt: number): number {
    if (S <= 0 || Ks < 0) return 0
    const scaleFactor = (Ks + Sopt) / Sopt
    return Math.min(1, scaleFactor * S / (Ks + S))
}

/**
 * Modified Monod effective growth rate.
 * μ = μ_max × f(S)
 */
export function monodGrowthRate(S: number, params: NutrientModelParams): number {
    return params.muMax * monodNutrientFactor(S, params.Ks, params.Sopt)
}

/** Full model object conforming to the NutrientModel interface */
export const monodModel: NutrientModel = {
    id: 'modified-monod',
    name: 'Modified Monod (Michaelis-Menten)',
    description:
        'Saturating nutrient uptake model based on Monod kinetics with a scale correction ' +
        'so that the limitation factor reaches exactly 1.0 at a defined optimal concentration ' +
        'Sopt. Below Ks the growth rate is roughly half-maximal. Above Sopt, growth is no ' +
        'longer nutrient-limited.',
    category: 'simple',

    calculate: (S: number, params: NutrientModelParams) =>
        monodNutrientFactor(S, params.Ks, params.Sopt),

    growthRate: monodGrowthRate,

    reference: {
        citation: 'Monod, J. (1949). The growth of bacterial cultures. Annual Review of Microbiology, 3, 371–394.',
        doi: '10.1146/annurev.mi.03.100149.002103',
        year: 1949,
    },

    parameterRanges: {
        S: [0, 50],       // mM — typical range for nitrogen/phosphorus
        Ks: [0.01, 5.0],  // mM — species and nutrient dependent
        Sopt: [1, 20],    // mM — concentration at which growth saturates
        muMax: [0.1, 5.0], // /day
    },

    useCases: [
        'Nutrient-limited growth estimation in batch cultures',
        'Feed strategy optimization for fed-batch systems',
        'Determining minimum nutrient requirements',
    ],

    limitations: [
        'No substrate inhibition — real systems can show toxicity at very high concentrations',
        'Single nutrient — does not capture co-limitation by multiple nutrients (use Liebig minimum)',
        'No luxury uptake — does not model intracellular nutrient storage (see Droop model)',
        'Assumes well-mixed conditions — no spatial nutrient gradients',
    ],
}

/** Default parameter values matching the original visualizer */
export const MONOD_DEFAULTS: NutrientModelParams = {
    Ks: 1,       // mM
    Sopt: 10,    // mM
    muMax: 4.0,  // /day
}
