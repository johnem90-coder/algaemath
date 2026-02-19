// ─── Shared Cell Animation Engine ──────────────────────────────────────────
//
// Types, constants, and pure utility functions for the cell-division
// animations used by GrowthRate, LightEffects, Temperature, and
// Nutrient visualizers. Extracted from the identically-duplicated code
// across all four components.
//
// All values are IDENTICAL to the originals — visual results unchanged.
// ────────────────────────────────────────────────────────────────────────────

// ─── Types ─────────────────────────────────────────────────────────────────

/** Array of 8 radius multipliers that define a blob's irregular shape */
export type ShapeVar = [number, number, number, number, number, number, number, number]

/** A single algae cell with position, physics, and division state */
export interface Cell {
    id: number
    x: number
    y: number
    vx: number
    vy: number
    size: number
    /** 0→1 within its current division cycle */
    growthPhase: number
    shape: ShapeVar
    rotation: number
    hueShift: number
    splitting: boolean
    /** 0→1 pinch animation progress */
    splitProgress: number
    splitAngle: number
    /** Progress timestamp (0-1 day fraction) when this cell was born */
    born: number
}

// ─── Animation Timing Constants ────────────────────────────────────────────

/** Duration of the active growth animation (ms) */
export const LOOP_DURATION = 6000
/** Pause at start of cycle before animation begins (ms) */
export const PAUSE_START = 1000
/** Pause at end of cycle before reset (ms) */
export const PAUSE_END = 1000
/** Total cycle = PAUSE_START + LOOP_DURATION + PAUSE_END */
export const TOTAL_CYCLE = PAUSE_START + LOOP_DURATION + PAUSE_END

// ─── Cell Geometry Constants ───────────────────────────────────────────────

/** Base (newborn) cell size in SVG units */
export const BASE_SIZE = 10
/** Cell size just before splitting */
export const SPLIT_SIZE = 16
/** Magnifier circle center X */
export const MX = 260
/** Magnifier circle center Y */
export const MY = 195
/** Magnifier circle radius */
export const MR = 70
/** Maximum number of cells before we stop dividing */
export const MAX_CELLS = 200

// ─── Physics Constants ─────────────────────────────────────────────────────

export const REPULSION_STRENGTH = 0.1
export const DAMPING = 0.92

// ─── Utility Functions ─────────────────────────────────────────────────────

/** Generate random blob shape (8 radius multipliers in range [0.8, 1.2]) */
export function randomShape(): ShapeVar {
    return Array.from({ length: 8 }, () => 0.8 + Math.random() * 0.4) as ShapeVar
}

/**
 * Generate an SVG path string for an irregularly-shaped blob cell.
 * Uses cubic Bezier curves through 8 points to create smooth organic shapes.
 *
 * @param cx    - Center X
 * @param cy    - Center Y
 * @param size  - Overall cell size
 * @param shape - 8 radius multipliers
 * @param rot   - Rotation angle (radians)
 * @param pinch - Pinch factor [0, 1] for splitting animation (0 = none, 1 = full pinch)
 * @returns SVG path `d` attribute string
 */
export function blobPath(
    cx: number,
    cy: number,
    size: number,
    shape: ShapeVar,
    rot: number,
    pinch = 0
): string {
    const points: [number, number][] = []
    const n = shape.length
    for (let i = 0; i < n; i++) {
        const angle = rot + (i / n) * Math.PI * 2
        let rx = size * 0.55 * shape[i]
        let ry = size * 0.45 * shape[(i + 2) % n]
        // Pinch effect at the equator for splitting
        if (pinch > 0) {
            const equatorDist = Math.abs(Math.sin(angle - rot))
            const pinchFactor = 1 - pinch * 0.5 * (1 - equatorDist)
            rx *= pinchFactor
            ry *= pinchFactor
        }
        points.push([
            cx + Math.cos(angle) * rx,
            cy + Math.sin(angle) * ry,
        ])
    }
    // Smooth closed path using cubic bezier
    let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`
    for (let i = 0; i < n; i++) {
        const curr = points[i]
        const next = points[(i + 1) % n]
        const prev = points[(i - 1 + n) % n]
        const nextNext = points[(i + 2) % n]
        const cp1x = curr[0] + (next[0] - prev[0]) * 0.25
        const cp1y = curr[1] + (next[1] - prev[1]) * 0.25
        const cp2x = next[0] - (nextNext[0] - curr[0]) * 0.25
        const cp2y = next[1] - (nextNext[1] - curr[1]) * 0.25
        d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${next[0].toFixed(1)},${next[1].toFixed(1)}`
    }
    return d + 'Z'
}

/**
 * Clamp a point (x, y) to stay within the magnifier circle.
 * Returns the original point if inside, or the nearest point on the circle boundary.
 */
export function clampToCircle(x: number, y: number, maxR: number): [number, number] {
    const dx = x - MX
    const dy = y - MY
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d > maxR) {
        return [MX + (dx / d) * maxR, MY + (dy / d) * maxR]
    }
    return [x, y]
}

/**
 * Apply cell-cell repulsion physics and velocity damping.
 * Mutates cells in-place for performance (called every animation frame).
 */
export function applyPhysics(cells: Cell[]): void {
    for (let i = 0; i < cells.length; i++) {
        const a = cells[i]
        // Cell-cell repulsion
        for (let j = i + 1; j < cells.length; j++) {
            const b = cells[j]
            const dx = b.x - a.x
            const dy = b.y - a.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.1
            const minDist = (a.size + b.size) * 0.3
            if (dist < minDist) {
                const overlap = (minDist - dist) / dist
                const fx = dx * overlap * REPULSION_STRENGTH
                const fy = dy * overlap * REPULSION_STRENGTH
                a.vx -= fx * 0.5
                a.vy -= fy * 0.5
                b.vx += fx * 0.5
                b.vy += fy * 0.5
            }
        }

        // Apply velocity with damping
        a.vx *= DAMPING
        a.vy *= DAMPING
        a.x += a.vx
        a.y += a.vy
    }
}

/**
 * Create a single new cell at a given position.
 * Returns a Cell object with default physics state.
 *
 * @param id   - Unique cell ID
 * @param x    - Initial X position
 * @param y    - Initial Y position
 * @param born - Day-progress timestamp when this cell was created
 */
export function createCell(id: number, x: number, y: number, born: number): Cell {
    return {
        id,
        x,
        y,
        vx: 0,
        vy: 0,
        size: BASE_SIZE,
        growthPhase: 0,
        shape: randomShape(),
        rotation: Math.random() * Math.PI * 2,
        hueShift: Math.random() * 40 - 20,
        splitting: false,
        splitProgress: 0,
        splitAngle: Math.random() * Math.PI * 2,
        born,
    }
}

/** Standard initial cell positions inside the magnifier circle */
export const INITIAL_POSITIONS = [
    { x: MX - 18, y: MY - 10 },
    { x: MX + 14, y: MY + 8 },
    { x: MX - 6, y: MY + 20 },
    { x: MX + 10, y: MY - 20 },
    { x: MX - 15, y: MY + 6 },
    { x: MX + 18, y: MY - 6 },
]

/**
 * Create the standard set of 6 initial cells for a fresh animation cycle.
 *
 * @param startId - Starting ID counter (used for unique IDs across resets)
 * @returns Array of 6 cells at the standard positions
 */
export function createInitialCells(startId: number): { cells: Cell[]; nextId: number } {
    let id = startId
    const cells = INITIAL_POSITIONS.map((p) => createCell(id++, p.x, p.y, 0))
    return { cells, nextId: id }
}
