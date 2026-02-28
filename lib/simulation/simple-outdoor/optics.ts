// Surface optics and light attenuation for open pond simulation
// Reference: docs/SIMULATION_DESIGN.md Sections 1.3, 1.5, 2.3

import type { HourlyWeather } from "../weather-types";
import {
  N_AIR,
  N_WATER,
  DEG_TO_RAD,
  PAR_COMBINED,
  I_MIN_PAR,
  THETA_DIFFUSE_DEG,
} from "./constants";

/**
 * Fresnel transmission for unpolarized light at an air-water interface.
 * Returns the fraction of light transmitted (0–1).
 *
 * At normal incidence (~0°): T ≈ 0.98
 * At grazing angles (>80°): T → 0
 *
 * @param theta_i_deg - Angle of incidence from surface normal (degrees)
 */
export function fresnelTransmission(theta_i_deg: number): number {
  if (theta_i_deg <= 0) return 0.98; // Near-normal incidence
  if (theta_i_deg >= 90) return 0;

  const theta_i = theta_i_deg * DEG_TO_RAD;
  const sinTheta_r = (N_AIR / N_WATER) * Math.sin(theta_i);

  // Total internal reflection check (shouldn't happen for air→water)
  if (sinTheta_r >= 1) return 0;

  const theta_r = Math.asin(sinTheta_r);
  const cos_i = Math.cos(theta_i);
  const cos_r = Math.cos(theta_r);

  // S-polarization (perpendicular)
  const Rs_num = N_AIR * cos_i - N_WATER * cos_r;
  const Rs_den = N_AIR * cos_i + N_WATER * cos_r;
  const Rs = (Rs_num / Rs_den) ** 2;

  // P-polarization (parallel)
  const Rp_num = N_AIR * cos_r - N_WATER * cos_i;
  const Rp_den = N_AIR * cos_r + N_WATER * cos_i;
  const Rp = (Rp_num / Rp_den) ** 2;

  return 1 - (Rs + Rp) / 2;
}

/**
 * Refracted angle via Snell's law (air → water).
 * @param theta_i_deg - Incident angle from surface normal (degrees)
 * @returns Refracted angle (degrees)
 */
export function refractedAngle(theta_i_deg: number): number {
  if (theta_i_deg <= 0) return 0;
  if (theta_i_deg >= 90) return 90;
  const sinTheta_r = (N_AIR / N_WATER) * Math.sin(theta_i_deg * DEG_TO_RAD);
  if (sinTheta_r >= 1) return 90;
  return Math.asin(sinTheta_r) / DEG_TO_RAD;
}

/**
 * Effective optical depth after refraction.
 * Light bends toward normal when entering water, increasing the path length.
 *
 * @param depth - Physical culture depth (m)
 * @param theta_i_deg - Incident angle from surface normal (degrees)
 */
export function effectiveDepth(depth: number, theta_i_deg: number): number {
  if (theta_i_deg <= 0) return depth;
  const theta_r = refractedAngle(theta_i_deg) * DEG_TO_RAD;
  const cos_r = Math.cos(theta_r);
  return cos_r > 0.01 ? depth / cos_r : depth * 100; // Cap at 100× depth
}

/**
 * Beer-Lambert average intensity across a path, with two-component extinction.
 *
 * K = ε·X·1000 + kb   (X converted from g/L to g/m³)
 * Iavg = I_surface / (K·L_eff) × (1 - exp(-K·L_eff))
 *
 * @param I_surface - PAR at culture surface (µmol/m²/s)
 * @param epsilon - Specific extinction coefficient (m²/g)
 * @param X - Biomass concentration (g/L)
 * @param kb - Background extinction (m⁻¹)
 * @param L_eff - Effective optical path length (m)
 */
export function beerLambertAvg(
  I_surface: number,
  epsilon: number,
  X: number,
  kb: number,
  L_eff: number
): number {
  if (I_surface <= 0) return 0;
  // ε(m²/g) × X(g/L → g/m³) gives K_bio in m⁻¹
  const K = epsilon * (X * 1000) + kb;
  const KL = K * L_eff;
  if (KL < 0.001) return I_surface; // Optically thin
  return (I_surface / KL) * (1 - Math.exp(-KL));
}

/**
 * Lighted depth fraction: the fraction of the culture receiving usable PAR.
 * Clamped to [0, 1].
 *
 * @param I_surface - PAR at culture surface (µmol/m²/s)
 * @param epsilon - Specific extinction coefficient (m²/g)
 * @param X - Biomass concentration (g/L)
 * @param kb - Background extinction (m⁻¹)
 * @param depth - Physical culture depth (m)
 */
export function lightedDepthFraction(
  I_surface: number,
  epsilon: number,
  X: number,
  kb: number,
  depth: number
): number {
  if (I_surface <= I_MIN_PAR) return 0;
  // ε(m²/g) × X(g/L → g/m³) gives K_bio in m⁻¹
  const K = epsilon * (X * 1000) + kb;
  if (K <= 0) return 1;
  const L_lighted = Math.log(I_surface / I_MIN_PAR) / K;
  return Math.min(L_lighted / depth, 1);
}

/** Result from the dual-path PAR computation */
export interface PARResult {
  par_direct_surface: number; // µmol/m²/s (after Fresnel, before Beer-Lambert)
  par_diffuse_surface: number; // µmol/m²/s (after Fresnel, before Beer-Lambert)
  par_avg_culture: number; // µmol/m²/s (volume-averaged total)
  fresnel_direct: number; // 0–1 (transmission factor for direct beam)
  f_lighted: number; // 0–1 (lighted depth fraction)
}

// Precompute diffuse constants (fixed 60° equivalent angle)
const T_DIFFUSE = fresnelTransmission(THETA_DIFFUSE_DEG);
const L_EFF_DIFFUSE_FACTOR = 1 / Math.cos(refractedAngle(THETA_DIFFUSE_DEG) * DEG_TO_RAD);

/**
 * Full dual-path PAR computation.
 *
 * Processes direct and diffuse radiation through separate optical paths:
 * 1. Fresnel transmission (angle-dependent for direct, fixed for diffuse)
 * 2. W/m² → µmol/m²/s PAR conversion
 * 3. Beer-Lambert attenuation with refracted effective depth
 * 4. Sum for total average culture PAR
 *
 * @param weather - Current hourly weather data
 * @param X - Current biomass concentration (g/L)
 * @param depth - Culture depth (m)
 * @param epsilon - Specific extinction coefficient (m²/g)
 * @param kb - Background extinction (m⁻¹)
 */
export function computePAR(
  weather: HourlyWeather,
  X: number,
  depth: number,
  epsilon: number,
  kb: number
): PARResult {
  // Direct component
  const theta_direct = Math.max(0, 90 - weather.solarElevation);
  const T_direct = weather.solarElevation > 0 ? fresnelTransmission(theta_direct) : 0;
  const I_direct_surface =
    weather.directRadiation * PAR_COMBINED * T_direct;
  const L_eff_direct = effectiveDepth(depth, theta_direct);
  const I_direct_avg = beerLambertAvg(I_direct_surface, epsilon, X, kb, L_eff_direct);

  // Diffuse component
  const I_diffuse_surface =
    weather.diffuseRadiation * PAR_COMBINED * T_DIFFUSE;
  const L_eff_diffuse = depth * L_EFF_DIFFUSE_FACTOR;
  const I_diffuse_avg = beerLambertAvg(I_diffuse_surface, epsilon, X, kb, L_eff_diffuse);

  // Total surface PAR (for lighted depth calculation, use sum of both surface values)
  const I_total_surface = I_direct_surface + I_diffuse_surface;
  const f_lighted = lightedDepthFraction(I_total_surface, epsilon, X, kb, depth);

  return {
    par_direct_surface: I_direct_surface,
    par_diffuse_surface: I_diffuse_surface,
    par_avg_culture: I_direct_avg + I_diffuse_avg,
    fresnel_direct: T_direct,
    f_lighted,
  };
}
