// ─── Gaussian Temperature Response Model ───────────────────────────────────
//
// f(T) = exp(−α × (T − T_opt)²)
//
// Simple symmetric Gaussian model for temperature limitation.
// Growth rate peaks at T_opt and declines symmetrically as temperature
// moves away from the optimum in either direction.
//
// Extracted from: TemperatureEffectsVisualizer.tsx, CombinedEffectsVisualizer.tsx
// Physics is IDENTICAL to the original inline implementation.
// ────────────────────────────────────────────────────────────────────────────

import type { TemperatureModel, TemperatureModelParams } from '@/lib/models/types'

/**
 * Gaussian temperature limitation factor.
 * Returns a value in [0, 1] where 1.0 occurs at T = Topt.
 *
 * @param T     - Temperature (°C)
 * @param Topt  - Optimal temperature (°C)
 * @param alpha - Width parameter (steepness of decline), typically 0.005–0.02
 * @returns f(T) ∈ [0, 1]
 */
export function gaussianTempFactor(T: number, Topt: number, alpha: number): number {
    return Math.exp(-alpha * Math.pow(T - Topt, 2))
}

/**
 * Gaussian effective growth rate.
 * μ = μ_max × f(T)
 */
export function gaussianTempGrowthRate(T: number, params: TemperatureModelParams): number {
    return params.muMax * gaussianTempFactor(T, params.Topt, params.alpha)
}

/** Full model object conforming to the TemperatureModel interface */
export const gaussianTempModel: TemperatureModel = {
    id: 'gaussian-temp',
    name: 'Gaussian Temperature Response',
    description:
        'Symmetric bell-curve model for temperature limitation. Growth rate peaks at the ' +
        'species-specific optimum temperature T_opt and declines as a Gaussian function of ' +
        'the deviation from optimum. The width parameter α controls how quickly growth ' +
        'drops off away from T_opt.',
    category: 'simple',

    calculate: (T: number, params: TemperatureModelParams) =>
        gaussianTempFactor(T, params.Topt, params.alpha),

    growthRate: gaussianTempGrowthRate,

    reference: {
        citation: 'Eppley, R.W. (1972). Temperature and phytoplankton growth in the sea. Fishery Bulletin, 70(4), 1063–1085.',
        year: 1972,
    },

    parameterRanges: {
        T: [0, 50],          // °C — full viable range
        Topt: [15, 40],      // °C — species-dependent
        alpha: [0.005, 0.02], // steepness parameter
        muMax: [0.1, 5.0],   // /day
    },

    useCases: [
        'First-order temperature correction for growth models',
        'Species comparison of thermal tolerance windows',
        'Outdoor pond or PBR temperature management',
    ],

    limitations: [
        'Symmetric decline — real organisms often have sharper decline above Topt than below',
        'No lethal temperature thresholds — model gives non-zero growth at extreme temperatures',
        'Does not capture thermal acclimation or adaptation over time',
        'Single optimum — some species show broad plateaus rather than sharp peaks',
    ],
}

/** Default parameter values matching the original visualizer */
export const GAUSSIAN_TEMP_DEFAULTS: TemperatureModelParams = {
    Topt: 30,     // °C
    muMax: 4.0,   // /day
    alpha: 0.01,  // width parameter
}
