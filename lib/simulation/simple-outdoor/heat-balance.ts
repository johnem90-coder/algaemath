// Heat balance for open pond simulation
// Reference: docs/SIMULATION_DESIGN.md Sections 2.4.0–2.4.7

import type { HourlyWeather } from "../weather-types";
import type { OpenPondGeometry } from "./types";
import {
  SIGMA,
  RHO_WATER,
  CP_WATER,
  EPSILON_WATER,
  WIND_10_TO_2,
  H_EVAP,
  A_WIND,
  B_WIND,
  K_GROUND,
  D_GROUND,
  BOWEN_CONSTANT,
  P_REF,
  H_COMBUSTION,
  THETA_DIFFUSE_DEG,
} from "./constants";
import { fresnelTransmission } from "./optics";

/**
 * Convert wind speed from 10m to 2m height using logarithmic wind profile.
 * u2 ≈ 0.825 × u10 for open water (z0 = 0.001 m)
 */
export function windSpeed2m(u10: number): number {
  return u10 * WIND_10_TO_2;
}

/**
 * Saturation vapor pressure from temperature using Magnus formula.
 * @param T - Temperature (°C)
 * @returns Saturation vapor pressure (kPa)
 */
export function saturationVaporPressure(T: number): number {
  return 0.6108 * Math.exp((17.27 * T) / (T + 237.3));
}

/**
 * Actual vapor pressure from dew point temperature.
 * More accurate than RH × e_sat approach when dew point data is available.
 * @param T_dew - Dew point temperature (°C)
 * @returns Actual vapor pressure (kPa)
 */
export function vaporPressure(T_dew: number): number {
  return saturationVaporPressure(T_dew);
}

// ── Individual heat flux terms ──────────────────────────────────────

// Precompute diffuse Fresnel transmission for fixed 60° equivalent angle
const T_DIFFUSE_HEAT = fresnelTransmission(THETA_DIFFUSE_DEG);

/**
 * Solar radiation absorbed by the pond surface. (Section 2.4.1)
 * Uses Fresnel reflectance (angle-dependent for direct, fixed for diffuse)
 * instead of a constant albedo.
 */
export function qSolar(
  directRadiation: number,
  diffuseRadiation: number,
  solarElevation: number
): number {
  const theta_i = Math.max(0, 90 - solarElevation);
  const T_direct = solarElevation > 0 ? fresnelTransmission(theta_i) : 0;
  return directRadiation * T_direct + diffuseRadiation * T_DIFFUSE_HEAT;
}

/**
 * Incoming atmospheric longwave radiation with cloud correction. (Section 2.4.2)
 * Uses Brutsaert (1975) clear-sky emissivity + cloud factor.
 */
export function qLongwaveIn(
  T_air: number,
  T_dew: number,
  cloud_fraction: number
): number {
  const T_air_K = T_air + 273.15;
  const e_a = vaporPressure(T_dew);

  // Brutsaert (1975) clear-sky atmospheric emissivity
  // Original: ε = 1.24 × (e_a_hPa / T_K)^(1/7)
  // With e_a in kPa: 1.24 × 10^(1/7) × (e_a_kPa / T_K)^(1/7) = 1.768 × (...)^(1/7)
  const eps_atm = 1.768 * (e_a / T_air_K) ** (1 / 7);

  // Cloud correction
  const C = Math.max(0, Math.min(1, cloud_fraction));
  return eps_atm * SIGMA * T_air_K ** 4 * (1 + 0.2 * C * C);
}

/**
 * Outgoing longwave radiation from pond surface. (Section 2.4.3)
 */
export function qLongwaveOut(T_pond: number): number {
  const T_pond_K = T_pond + 273.15;
  return EPSILON_WATER * SIGMA * T_pond_K ** 4;
}

/**
 * Evaporative heat loss (Penman-type). (Section 2.4.4)
 * Returns both W/m² (for heat balance) and MJ/m²/day (for volume loss).
 */
export function qEvaporation(
  T_pond: number,
  e_a: number,
  u2: number
): { q_evap_Wm2: number; q_evap_MJday: number } {
  const e_s_pond = saturationVaporPressure(T_pond);
  const vpd = Math.max(0, e_s_pond - e_a); // Vapor pressure deficit
  const f_wind = A_WIND + B_WIND * u2;
  const q_evap_MJday = H_EVAP * vpd * f_wind; // MJ/m²/day
  const q_evap_Wm2 = q_evap_MJday / 0.0864; // Convert to W/m²
  return { q_evap_Wm2, q_evap_MJday };
}

/**
 * Convective heat loss using the Bowen ratio. (Section 2.4.5, Option B)
 * Links sensible heat to latent heat through the same boundary layer.
 */
export function qConvectionBowen(
  T_pond: number,
  T_air: number,
  e_s_pond: number,
  e_a: number,
  q_evap_Wm2: number
): number {
  const vpd = e_s_pond - e_a;
  if (Math.abs(vpd) < 0.001) {
    // Fallback to McAdams when VPD ≈ 0 (avoids division by zero)
    return (3.0 + 4.2 * 2) * (T_pond - T_air); // Assume moderate wind
  }
  // Convert kPa to Pa for Bowen ratio (BOWEN_CONSTANT is in Pa/°C)
  const vpd_Pa = vpd * 1000;
  return (BOWEN_CONSTANT * P_REF * (T_pond - T_air)) / (P_REF * vpd_Pa) * q_evap_Wm2;
}

/**
 * Ground conduction heat loss with side-wall correction. (Section 2.4.6)
 */
export function qConduction(
  T_pond: number,
  T_ground: number,
  A_surface: number,
  perimeter: number,
  depth: number
): number {
  const q_base = (K_GROUND * (T_pond - T_ground)) / D_GROUND; // W/m² through bottom
  // Side-wall area correction ratio
  const A_total = A_surface + perimeter * depth;
  return q_base * (A_total / A_surface);
}

/**
 * Photosynthetic heat sink — chemical energy stored in biomass. (Section 2.4.7)
 * Typically 1–5 W/m².
 */
export function qBiomass(
  X: number,
  mu_eff: number,
  depth: number
): number {
  if (mu_eff <= 0) return 0;
  // H_COMBUSTION (MJ/kg) × X (g/L = kg/m³) × (µeff/24) (/h) × depth (m)
  // Result: MJ/m²/h → convert to W/m²: × 1e6 / 3600 = × 277.8
  const q_MJ_per_m2_per_h = H_COMBUSTION * (X / 1000) * (mu_eff / 24) * depth;
  return q_MJ_per_m2_per_h * 277.778;
}

// ── Combined heat balance ───────────────────────────────────────────

/** Result from the full heat balance computation */
export interface HeatBalanceResult {
  q_solar: number;
  q_longwave_in: number;
  q_longwave_out: number;
  q_evap: number;
  q_convection: number;
  q_conduction: number;
  q_biomass: number;
  q_net: number;
  dT: number; // Temperature change per hour (°C/h)
  u2: number; // Converted wind speed at 2m
}

/**
 * Compute the full heat balance for one timestep.
 * Returns all individual Q terms, the net flux, and the temperature derivative.
 */
export function computeHeatBalance(
  weather: HourlyWeather,
  T_pond: number,
  X: number,
  mu_eff: number,
  geometry: OpenPondGeometry
): HeatBalanceResult {
  const u2 = windSpeed2m(weather.windSpeed);
  const e_a = vaporPressure(weather.dewPoint);
  const e_s_pond = saturationVaporPressure(T_pond);
  const cloud_fraction = weather.cloudCover / 100;
  const T_ground = weather.soilTemperature;

  const q_solar_val = qSolar(weather.directRadiation, weather.diffuseRadiation, weather.solarElevation);
  const q_lw_in = qLongwaveIn(weather.temperature, weather.dewPoint, cloud_fraction);
  const q_lw_out = qLongwaveOut(T_pond);

  const { q_evap_Wm2 } = qEvaporation(T_pond, e_a, u2);
  const q_conv = qConvectionBowen(T_pond, weather.temperature, e_s_pond, e_a, q_evap_Wm2);
  const q_cond = qConduction(
    T_pond,
    T_ground,
    geometry.A_surface,
    geometry.perimeter,
    geometry.A_surface > 0 ? geometry.V_m3 / geometry.A_surface : 0.25
  );
  const q_bio = qBiomass(X, mu_eff, geometry.V_m3 / geometry.A_surface);

  const q_net =
    q_solar_val + q_lw_in - q_evap_Wm2 - q_conv - q_cond - q_lw_out - q_bio;

  // dT/dt = Q_net / (ρ × Cp × depth)
  // Result is °C/s; multiply by 3600 to get °C/h for the hourly timestep
  const depth = geometry.A_surface > 0 ? geometry.V_m3 / geometry.A_surface : 0.25;
  const dT = (q_net / (RHO_WATER * CP_WATER * depth)) * 3600;

  return {
    q_solar: q_solar_val,
    q_longwave_in: q_lw_in,
    q_longwave_out: q_lw_out,
    q_evap: q_evap_Wm2,
    q_convection: q_conv,
    q_conduction: q_cond,
    q_biomass: q_bio,
    q_net,
    dT,
    u2,
  };
}
