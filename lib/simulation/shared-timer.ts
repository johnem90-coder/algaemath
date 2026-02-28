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

// ─── Interaction Priority ──────────────────────────────────────────────────
//
// When the user clicks/taps anywhere, all animation RAF loops should yield
// for a short period so the browser can process the interaction (e.g.
// navigating to another page) without being starved by heavy render work.
// ────────────────────────────────────────────────────────────────────────────

let yieldUntil = 0

/**
 * Returns true if animations should skip work this frame to let the
 * browser handle a pending user interaction.
 */
export function shouldYieldToInteraction(): boolean {
    return performance.now() < yieldUntil
}

// Attach the listener once, lazily, on first import in the browser.
if (typeof window !== "undefined") {
    window.addEventListener(
        "pointerdown",
        () => {
            yieldUntil = performance.now() + 200
        },
        { capture: true, passive: true },
    )
}
