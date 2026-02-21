// ─── Light Models — Barrel Export ───────────────────────────────────────────
//
// Single entry point for all light-related models.
// Usage: import { steeleModel, computeAttenuation, ... } from '@/lib/models/light'
// ────────────────────────────────────────────────────────────────────────────

// Steele photoinhibition
export { steeleLightFactor, steeleGrowthRate, steeleModel } from './steele'

// Beer-Lambert attenuation
export {
    intensityAtDepth,
    averageIntensity,
    photicDepth,
    computeAttenuation,
    BEER_LAMBERT_DEFAULTS,
} from './beer-lambert'

// Solar spectrum & wavelength utilities
export {
    gauss,
    SOLAR_AM15G,
    SOLAR_MAX,
    sunlightSpectrum,
    nmToRGB,
    NM_MIN,
    NM_MAX,
} from './solar-spectrum'

// Pigment absorption spectra
export {
    algaeAbsorption,
    PIGMENTS,
    getPigment,
    getPigmentAbsorption,
    getPigmentAbsorptionRaw,
    combinedAbsorption,
    DEFAULT_PIGMENT_SCALES,
} from './pigment-absorption'
export type { PigmentDefinition } from './pigment-absorption'

// Re-export relevant types
export type {
    LightModel,
    LightModelParams,
    AttenuationParams,
    AttenuationResult,
} from '@/lib/models/types'
