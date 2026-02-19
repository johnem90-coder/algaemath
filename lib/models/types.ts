// ─── Shared Model Registry Types ───────────────────────────────────────────
// Every model in the registry conforms to one of these interfaces.
// Pure type definitions — no calculations, no side-effects.

/** Academic reference for a model */
export interface ModelReference {
    citation: string
    doi?: string
    year: number
}

// ─── Light Models ──────────────────────────────────────────────────────────

export interface LightModelParams {
    /** Optimal light intensity (μE/m²/s) */
    Iopt: number
    /** Maximum specific growth rate (/day) */
    muMax: number
}

export interface LightModel {
    id: string
    name: string
    description: string
    category: 'simple' | 'inhibition' | 'advanced'
    /** Compute the light limitation factor f(I) ∈ [0, 1] */
    calculate: (I: number, params: LightModelParams) => number
    /** Compute the effective growth rate μ = muMax × f(I) */
    growthRate: (I: number, params: LightModelParams) => number
    reference: ModelReference
    parameterRanges: Record<string, [number, number]>
    useCases: string[]
    limitations: string[]
}

// ─── Temperature Models ────────────────────────────────────────────────────

export interface TemperatureModelParams {
    /** Optimal temperature (°C) */
    Topt: number
    /** Maximum specific growth rate (/day) */
    muMax: number
    /** Width parameter (steepness of decline away from Topt) */
    alpha: number
}

export interface TemperatureModel {
    id: string
    name: string
    description: string
    category: 'simple' | 'cardinal' | 'advanced'
    /** Compute the temperature limitation factor f(T) ∈ [0, 1] */
    calculate: (T: number, params: TemperatureModelParams) => number
    /** Compute the effective growth rate μ = muMax × f(T) */
    growthRate: (T: number, params: TemperatureModelParams) => number
    reference: ModelReference
    parameterRanges: Record<string, [number, number]>
    useCases: string[]
    limitations: string[]
}

// ─── Nutrient Models ───────────────────────────────────────────────────────

export interface NutrientModelParams {
    /** Half-saturation constant (mM) */
    Ks: number
    /** Optimal / saturating concentration (mM) */
    Sopt: number
    /** Maximum specific growth rate (/day) */
    muMax: number
}

export interface NutrientModel {
    id: string
    name: string
    description: string
    category: 'simple' | 'inhibition' | 'advanced'
    /** Compute the nutrient limitation factor f(S) ∈ [0, 1] */
    calculate: (S: number, params: NutrientModelParams) => number
    /** Compute the effective growth rate μ = muMax × f(S) */
    growthRate: (S: number, params: NutrientModelParams) => number
    reference: ModelReference
    parameterRanges: Record<string, [number, number]>
    useCases: string[]
    limitations: string[]
}

// ─── Light Attenuation (Beer-Lambert) ──────────────────────────────────────

export interface AttenuationParams {
    /** Incident light intensity at surface (μE/m²/s) */
    I0: number
    /** Biomass concentration (g/L or kg/m³) */
    X: number
    /** Specific light absorption coefficient (m²/kg) */
    Ka: number
    /** Optical path length (m) */
    L: number
}

export interface AttenuationResult {
    /** Light intensity at depth z: I(z) = I0 × e^(−Ka·X·z) */
    intensityAtDepth: (z: number) => number
    /** Average light intensity across the path length */
    Iavg: number
    /** Depth at which I(z) ≈ 0 (drops below 1 μE/m²/s), capped at L */
    zPhotic: number
    /** Fraction of path length that is "lit" (zPhotic / L) */
    photicFraction: number
}

// ─── Combined / Multiplicative Model ───────────────────────────────────────

export interface CombinedModelParams {
    muMax: number
}

export interface CombinedFactors {
    fI: number
    fT: number
    fS: number
}

export interface CombinedModel {
    id: string
    name: string
    description: string
    /** μ_eff = muMax × f(I) × f(T) × f(S) */
    calculate: (factors: CombinedFactors, params: CombinedModelParams) => number
    reference: ModelReference
}
