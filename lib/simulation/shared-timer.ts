// ─── Shared Animation Timer ────────────────────────────────────────────────
//
// A global start-time reference so all visualizers on the page stay
// in sync. The first visualizer to call getGlobalStart() sets the
// timestamp; all subsequent calls return the same value.
//
// Extracted from: sharedTimer.ts (AlgaeConceptsPage)
// Logic is IDENTICAL to the original.
// ────────────────────────────────────────────────────────────────────────────

let globalStart: number | null = null

/**
 * Get (or set) the shared animation start timestamp.
 * All visualizer animation loops should call this instead of using
 * their own `performance.now()` origin, so the cycles align.
 *
 * @param timestamp - Current `requestAnimationFrame` timestamp
 * @returns The global start timestamp (same for all callers)
 */
export function getGlobalStart(timestamp: number): number {
    if (globalStart === null) {
        globalStart = timestamp
    }
    return globalStart
}

/**
 * Reset the global start time. Useful for testing or page transitions.
 */
export function resetGlobalStart(): void {
    globalStart = null
}
