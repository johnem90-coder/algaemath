// ─── Pigment Absorption Spectra ─────────────────────────────────────────────
//
// Approximate absorption spectra for major photosynthetic pigments,
// modeled as sums of Gaussian peaks. Each pigment has both a raw
// (unnormalized) and a normalized (peak = 1.0) version.
//
// Extracted from: LightAbsorptionVisualizer.tsx
// Physics is IDENTICAL to the original inline implementation.
// ────────────────────────────────────────────────────────────────────────────

import { gauss } from './solar-spectrum'

// ─── Pigment Definitions ───────────────────────────────────────────────────

export interface PigmentDefinition {
    id: string
    name: string
    shortName: string
    /** CSS color for chart rendering */
    color: string
    /** Raw (unnormalized) absorption function */
    absorptionRaw: (nm: number) => number
    /** Peak value of raw absorption across visible range */
    peakValue: number
    /** Normalized absorption function — peak reaches 1.0 */
    absorption: (nm: number) => number
    /** Default relative abundance scale (for mixing) */
    defaultScale: number
    /** Slider range [min, max] for abundance adjustment */
    scaleRange: [number, number]
}

// ─── Raw Absorption Functions ──────────────────────────────────────────────
// These are the Gaussian-sum approximations from the original component.

const pigmentAbsorptionRaw: Record<string, (nm: number) => number> = {
    chla: (nm) => 0.85 * gauss(nm, 430, 20) + 0.55 * gauss(nm, 662, 18),
    chlb: (nm) => 0.95 * gauss(nm, 460, 22) + 0.35 * gauss(nm, 642, 20),
    carot: (nm) => 0.4 * gauss(nm, 444, 10) + 0.45 * gauss(nm, 482, 22),
    pc: (nm) => 0.3 * gauss(nm, 545, 22) + 0.2 * gauss(nm, 565, 18),
    pe: (nm) => 0.4 * gauss(nm, 620, 22),
}

// ─── Compute Peak Values for Normalization ─────────────────────────────────

function findPeakValue(fn: (nm: number) => number): number {
    let max = 0
    for (let nm = 380; nm <= 750; nm++) {
        max = Math.max(max, fn(nm))
    }
    return max
}

const pigmentMaxValues: Record<string, number> = {}
for (const [id, fn] of Object.entries(pigmentAbsorptionRaw)) {
    pigmentMaxValues[id] = findPeakValue(fn)
}

// ─── Normalized Absorption Functions ───────────────────────────────────────
// Each pigment's peak is scaled to 1.0

const pigmentAbsorptionNormalized: Record<string, (nm: number) => number> = {}
for (const [id, fn] of Object.entries(pigmentAbsorptionRaw)) {
    const peak = pigmentMaxValues[id]
    pigmentAbsorptionNormalized[id] = peak > 0 ? (nm: number) => fn(nm) / peak : fn
}

// ─── Combined "Bulk" Chlorophyll Absorption ────────────────────────────────
// Approximate total absorption of a typical green alga cell

/**
 * Approximate bulk chlorophyll absorption spectrum (normalized 0-1).
 * Combines Soret band, Q-band, Chl b, and carotenoid contributions.
 */
export function algaeAbsorption(nm: number): number {
    const soret = 0.9 * gauss(nm, 430, 20)
    const qBand = 0.7 * gauss(nm, 680, 18)
    const chlB1 = 0.5 * gauss(nm, 460, 22)
    const chlB2 = 0.4 * gauss(nm, 650, 20)
    const carot = 0.35 * gauss(nm, 480, 30)
    return Math.min(1, soret + qBand + chlB1 + chlB2 + carot)
}

// ─── Full Pigment Registry ─────────────────────────────────────────────────

export const PIGMENTS: PigmentDefinition[] = [
    {
        id: 'chla',
        name: 'Chlorophyll a',
        shortName: 'Chl a',
        color: 'rgb(0, 128, 0)',
        absorptionRaw: pigmentAbsorptionRaw.chla,
        peakValue: pigmentMaxValues.chla,
        absorption: pigmentAbsorptionNormalized.chla,
        defaultScale: 1,
        scaleRange: [0.70, 1.00],
    },
    {
        id: 'chlb',
        name: 'Chlorophyll b',
        shortName: 'Chl b',
        color: 'rgb(100, 180, 50)',
        absorptionRaw: pigmentAbsorptionRaw.chlb,
        peakValue: pigmentMaxValues.chlb,
        absorption: pigmentAbsorptionNormalized.chlb,
        defaultScale: 0.4,
        scaleRange: [0.30, 0.50],
    },
    {
        id: 'carot',
        name: 'Carotenoids',
        shortName: 'Car',
        color: 'rgb(220, 160, 0)',
        absorptionRaw: pigmentAbsorptionRaw.carot,
        peakValue: pigmentMaxValues.carot,
        absorption: pigmentAbsorptionNormalized.carot,
        defaultScale: 0.1,
        scaleRange: [0.00, 0.15],
    },
    {
        id: 'pc',
        name: 'Phycocyanin',
        shortName: 'PC',
        color: 'rgb(0, 120, 200)',
        absorptionRaw: pigmentAbsorptionRaw.pc,
        peakValue: pigmentMaxValues.pc,
        absorption: pigmentAbsorptionNormalized.pc,
        defaultScale: 0.15,
        scaleRange: [0.00, 0.20],
    },
    {
        id: 'pe',
        name: 'Phycoerythrin',
        shortName: 'PE',
        color: 'rgb(200, 60, 100)',
        absorptionRaw: pigmentAbsorptionRaw.pe,
        peakValue: pigmentMaxValues.pe,
        absorption: pigmentAbsorptionNormalized.pe,
        defaultScale: 0.05,
        scaleRange: [0.00, 0.10],
    },
]

/** Lookup pigment by id */
export function getPigment(id: string): PigmentDefinition | undefined {
    return PIGMENTS.find(p => p.id === id)
}

/** Get the normalized absorption function for a pigment by id */
export function getPigmentAbsorption(id: string): ((nm: number) => number) | undefined {
    return pigmentAbsorptionNormalized[id]
}

/** Get the raw absorption function for a pigment by id */
export function getPigmentAbsorptionRaw(id: string): ((nm: number) => number) | undefined {
    return pigmentAbsorptionRaw[id]
}

/**
 * Compute combined absorption from a set of pigment scales.
 * Returns a function of wavelength and also the peak-normalization factor.
 */
export function combinedAbsorption(
    scales: Record<string, number>
): { absorption: (nm: number) => number; peakValue: number } {
    // Compute un-normalized sum
    const rawFn = (nm: number): number => {
        let sum = 0
        for (const [id, scale] of Object.entries(scales)) {
            const fn = pigmentAbsorptionNormalized[id]
            if (fn) sum += fn(nm) * scale
        }
        return sum
    }

    // Find peak for normalization
    let peak = 0
    for (let nm = 380; nm <= 750; nm++) {
        peak = Math.max(peak, rawFn(nm))
    }

    const normalizedFn = peak > 0
        ? (nm: number) => rawFn(nm) / peak
        : rawFn

    return { absorption: normalizedFn, peakValue: peak }
}

/** Default pigment abundance scales matching the original visualizer */
export const DEFAULT_PIGMENT_SCALES: Record<string, number> = {
    chla: 1,
    chlb: 0.4,
    carot: 0.1,
    pc: 0.15,
    pe: 0.05,
}
