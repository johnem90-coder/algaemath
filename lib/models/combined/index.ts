// ─── Combined Models — Barrel Export ────────────────────────────────────────
//
// Single entry point for all combined / multi-factor growth models.
// Usage: import { multiplicativeModel, ... } from '@/lib/models/combined'
// ────────────────────────────────────────────────────────────────────────────

export {
    multiplicativeGrowthRate,
    multiplicativeModel,
    MULTIPLICATIVE_DEFAULTS,
} from './multiplicative'

// Re-export relevant types
export type {
    CombinedModel,
    CombinedFactors,
    CombinedModelParams,
} from '@/lib/models/types'
