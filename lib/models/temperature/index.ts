// ─── Temperature Models — Barrel Export ─────────────────────────────────────
//
// Single entry point for all temperature-related models.
// Usage: import { gaussianTempModel, ... } from '@/lib/models/temperature'
// ────────────────────────────────────────────────────────────────────────────

export {
    gaussianTempFactor,
    gaussianTempGrowthRate,
    gaussianTempModel,
    GAUSSIAN_TEMP_DEFAULTS,
} from './gaussian'

// Re-export relevant types
export type {
    TemperatureModel,
    TemperatureModelParams,
} from '@/lib/models/types'
