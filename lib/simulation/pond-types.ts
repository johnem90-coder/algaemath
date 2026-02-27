/** API returned by initPond for external control of the 3D scene */
export interface PondAPI {
  /** Set algae biomass density (g/L). Range: 0.05–4.0 */
  setDensity(density: number): void
  /** Set time of day (hours). Range: 0–24 */
  setTime(hour: number): void
  /** Set wind direction (degrees from) and speed (m/s) */
  setWind(fromDegrees: number, speedMs: number): void
  /** Set cloud cover fraction. Range: 0–1 */
  setClouds(density: number): void
  /** Set rain intensity fraction. Range: 0–1 */
  setRain(density: number): void
  /** Resize the renderer and update camera aspect */
  resize(width: number, height: number): void
  /** Clean up Three.js resources */
  dispose(): void
}

/** Configuration for initPond */
export interface PondConfig {
  canvas: HTMLCanvasElement
  width: number
  height: number
}
