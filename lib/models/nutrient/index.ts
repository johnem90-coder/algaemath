// ─── Nutrient Models — Barrel Export ────────────────────────────────────────
//
// Single entry point for all nutrient-related models.
// Usage: import { monodModel, ... } from '@/lib/models/nutrient'
// ────────────────────────────────────────────────────────────────────────────

export {
    monodNutrientFactor,
    monodGrowthRate,
    monodModel,
    MONOD_DEFAULTS,
} from './monod'

// Re-export relevant types
export type {
    NutrientModel,
    NutrientModelParams,
} from '@/lib/models/types'
