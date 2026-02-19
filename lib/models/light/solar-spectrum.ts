// ─── AM1.5G Solar Spectrum & Wavelength Utilities ──────────────────────────
//
// Reference solar spectral irradiance (visible PAR range 380–750 nm)
// based on ASTM G-173-03 standard. Provides interpolated lookup and
// wavelength-to-RGB conversion for visualization.
//
// Extracted from: LightAbsorptionVisualizer.tsx
// Data and functions are IDENTICAL to the original inline implementation.
// ────────────────────────────────────────────────────────────────────────────

/** Gaussian helper — used by both solar and pigment spectrum models */
export function gauss(nm: number, center: number, sigma: number): number {
    const d = (nm - center) / sigma
    return Math.exp(-0.5 * d * d)
}

// ─── AM1.5G Solar Spectral Irradiance ──────────────────────────────────────
// (W/m²/nm) at 5nm intervals, 380-750nm
// Source: ASTM G-173-03 reference spectrum (approximate values)

export const SOLAR_AM15G: [number, number][] = [
    [380, 0.47], [385, 0.68], [390, 0.76], [395, 0.86],
    [400, 1.02], [405, 1.15], [410, 1.18], [415, 1.12], [420, 1.10],
    [425, 1.20], [430, 1.29], [435, 1.36], [440, 1.42], [445, 1.53],
    [450, 1.62], [455, 1.66], [460, 1.69], [465, 1.70], [470, 1.72],
    [475, 1.68], [480, 1.72], [485, 1.70], [490, 1.66], [495, 1.64],
    [500, 1.63], [505, 1.60], [510, 1.57], [515, 1.57], [520, 1.55],
    [525, 1.54], [530, 1.53], [535, 1.52], [540, 1.52], [545, 1.50],
    [550, 1.49], [555, 1.48], [560, 1.47], [565, 1.46], [570, 1.45],
    [575, 1.44], [580, 1.42], [585, 1.40], [590, 1.37], [595, 1.35],
    [600, 1.34], [605, 1.33], [610, 1.32], [615, 1.31], [620, 1.30],
    [625, 1.29], [630, 1.28], [635, 1.26], [640, 1.25], [645, 1.24],
    [650, 1.23], [655, 1.22], [660, 1.21], [665, 1.19], [670, 1.18],
    [675, 1.16], [680, 1.13], [685, 1.10], [690, 1.06], [695, 0.97],
    [700, 1.05], [705, 1.02], [710, 0.99], [715, 0.96], [720, 0.92],
    [725, 0.84], [730, 0.87], [735, 0.89], [740, 0.88], [745, 0.86],
    [750, 0.84],
]

export const SOLAR_MAX = Math.max(...SOLAR_AM15G.map(d => d[1]))

/**
 * Interpolated AM1.5G solar spectrum, normalized to [0, 1].
 * Returns relative spectral irradiance at a given wavelength.
 *
 * @param nm - Wavelength in nanometers (380–750 for valid range)
 * @returns Normalized irradiance ∈ [0, 1]
 */
export function sunlightSpectrum(nm: number): number {
    if (nm <= SOLAR_AM15G[0][0]) return SOLAR_AM15G[0][1] / SOLAR_MAX
    if (nm >= SOLAR_AM15G[SOLAR_AM15G.length - 1][0]) return SOLAR_AM15G[SOLAR_AM15G.length - 1][1] / SOLAR_MAX
    // Linear interpolation
    for (let i = 0; i < SOLAR_AM15G.length - 1; i++) {
        const [w0, v0] = SOLAR_AM15G[i]
        const [w1, v1] = SOLAR_AM15G[i + 1]
        if (nm >= w0 && nm <= w1) {
            const t = (nm - w0) / (w1 - w0)
            return (v0 + t * (v1 - v0)) / SOLAR_MAX
        }
    }
    return 0
}

// ─── Wavelength → RGB Conversion ───────────────────────────────────────────

/**
 * Convert a wavelength (nm) to a visible-light RGB color string.
 * Uses piecewise linear approximation with edge-of-spectrum falloff.
 *
 * @param nm - Wavelength in nanometers
 * @returns CSS rgb() color string
 */
export function nmToRGB(nm: number): string {
    let r = 0, g = 0, b = 0
    if (nm >= 380 && nm < 440) {
        r = -(nm - 440) / (440 - 380); g = 0; b = 1
    } else if (nm >= 440 && nm < 490) {
        r = 0; g = (nm - 440) / (490 - 440); b = 1
    } else if (nm >= 490 && nm < 510) {
        r = 0; g = 1; b = -(nm - 510) / (510 - 490)
    } else if (nm >= 510 && nm < 580) {
        r = (nm - 510) / (580 - 510); g = 1; b = 0
    } else if (nm >= 580 && nm < 645) {
        r = 1; g = -(nm - 645) / (645 - 580); b = 0
    } else if (nm >= 645 && nm <= 780) {
        r = 1; g = 0; b = 0
    }
    // Intensity falloff at edges of visible spectrum
    let factor = 1
    if (nm >= 380 && nm < 420) factor = 0.3 + 0.7 * (nm - 380) / (420 - 380)
    else if (nm > 700 && nm <= 780) factor = 0.3 + 0.7 * (780 - nm) / (780 - 700)
    else if (nm > 780 || nm < 380) factor = 0
    r = Math.round(r * factor * 255)
    g = Math.round(g * factor * 255)
    b = Math.round(b * factor * 255)
    return `rgb(${r},${g},${b})`
}

/** Visible PAR range constants */
export const NM_MIN = 380
export const NM_MAX = 750
