// Open pond simulation engine
// Reference: docs/SIMULATION_DESIGN.md

import type { RawDayData } from "../weather-types";
import type {
  OpenPondConfig,
  OpenPondTimestep,
  OpenPondSummary,
} from "./types";
import { computeGeometry } from "./geometry";
import { computePAR } from "./optics";
import { computeHeatBalance, windSpeed2m } from "./heat-balance";
import { LAMBDA_WATER } from "./constants";
import { steeleLightFactor } from "@/lib/models/light/steele";
import { gaussianTempFactor } from "@/lib/models/temperature/gaussian";

/**
 * Run the full open pond simulation.
 *
 * Pre-computes all hourly timesteps deterministically from raw daily weather data.
 * Each simulation day uses a distinct day from the raw data, cycling if needed.
 *
 * @param raw - Array of raw daily weather data (each entry = 24 hourly observations)
 * @param config - Simulation configuration
 * @param totalDays - Number of days to simulate
 * @returns Array of timesteps and summary statistics
 */
export function runSimulation(
  raw: RawDayData[],
  config: OpenPondConfig,
  totalDays: number
): { timesteps: OpenPondTimestep[]; summary: OpenPondSummary } {
  const geometry = computeGeometry(config.area_ha, config.aspect_ratio, config.depth, config.berm_width);
  const timesteps: OpenPondTimestep[] = [];

  // State variables
  let X = config.initial_density;
  let T_pond = config.initial_temperature;
  let V = geometry.V_m3;
  let totalHarvested = 0;
  let harvestCount = 0;

  // Harvest state — harvesting runs over 4 nighttime hours (20:00–23:00)
  const HARVEST_START = 20;
  const HARVEST_HOURS = 4;
  let harvestRateGLPerHour = 0; // g/L to remove each hour during active harvest

  const START_HOUR = 7; // Simulation starts at 7 AM local time

  for (let step = 0; step < totalDays * 24; step++) {
    const day = Math.floor(step / 24) + 1;
    const hour = (step + START_HOUR) % 24;

    // Get weather for this hour from the raw daily data (cycles through available days)
    const dayIndex = Math.floor(step / 24) % raw.length;
    const weather = raw[dayIndex].hours[hour];

    // Initialize pond temperature from air temperature on first step
    if (step === 0 && config.initial_temperature === 0) {
      T_pond = weather.temperature;
    }

    // ── Light ────────────────────────────────────────────────
    const par = computePAR(weather, X, config.depth, config.epsilon, config.kb);

    // ── Growth factors ───────────────────────────────────────
    const mu_L = steeleLightFactor(par.par_avg_culture, config.Iopt);
    const mu_T = gaussianTempFactor(T_pond, config.Topt, config.alpha);
    const mu_N = 1.0; // Nutrients not limiting in v1
    const mu_pH = 1.0; // pH not modeled in v1

    // Net growth rate (/day)
    const mu_gross = config.mu_max * mu_L * mu_T * mu_N * mu_pH;
    const mu_net = mu_gross - config.death_rate;

    // Effective growth rate (scaled by lighted fraction)
    const mu_eff = mu_net * par.f_lighted;

    // ── Biomass Euler step ───────────────────────────────────
    const dX = (mu_eff / 24) * X; // Per-hour increment
    let X_new = Math.max(0.01, X + dX); // Clamp to min 0.01 g/L

    // ── Harvest check (nighttime only, spread over 4 hours) ──
    let harvestOccurred = false;
    let harvestMassKg = 0;
    let harvestWaterRemovedL = 0;
    let harvestWaterReturnedL = 0;

    if (config.harvest_mode !== "none") {
      const isHarvestWindow = hour >= HARVEST_START && hour < HARVEST_START + HARVEST_HOURS;

      // At the start of the harvest window, decide tonight's harvest rate
      if (hour === HARVEST_START) {
        if (config.harvest_mode === "semi-continuous") {
          // Harvest excess above min density, spread over 4 hours
          const excess = X_new - config.harvest_threshold;
          harvestRateGLPerHour = excess > 0 ? excess / HARVEST_HOURS : 0;
        } else if (config.harvest_mode === "batch") {
          // Harvest entire pond down to target, spread over 4 hours
          if (X_new > config.harvest_threshold) {
            harvestRateGLPerHour = (X_new - config.harvest_target) / HARVEST_HOURS;
          } else {
            harvestRateGLPerHour = 0;
          }
        }
        if (harvestRateGLPerHour > 0) harvestCount++;
      }

      // Remove biomass during harvest window
      if (isHarvestWindow && harvestRateGLPerHour > 0) {
        const removeConc = Math.min(harvestRateGLPerHour, X_new - 0.01);
        if (removeConc > 0) {
          const X_before = X_new; // concentration before removal
          harvestMassKg = (removeConc * V * 1000) / 1000; // g/L × m³ × 1000 L/m³ / 1000 g/kg = kg
          // Culture volume removed = mass (g) / concentration (g/L)
          harvestWaterRemovedL = (removeConc * V * 1000) / X_before;
          harvestWaterReturnedL = harvestWaterRemovedL * 0.8; // 80% of water recycled
          X_new -= removeConc;
          totalHarvested += harvestMassKg;
          harvestOccurred = true;
        }
      }
    }

    // ── Heat balance ─────────────────────────────────────────
    const heat = computeHeatBalance(weather, T_pond, X, mu_eff, geometry);
    const T_pond_new = T_pond + heat.dT;

    // ── Water balance ────────────────────────────────────────
    // Evaporative loss: q_evap (W/m²) → L/h over pond surface
    const evap_L = (heat.q_evap * 3600 * geometry.A_surface) / (LAMBDA_WATER * 1e6);
    // Rainfall volume: 1 mm over 1 m² = 1 L
    const rainfall_L = weather.precipitation * geometry.A_surface;
    // Makeup water offsets evaporation + net harvest loss, reduced by rainfall
    // Only add makeup water when pond volume is at or below baseline
    const harvestNetLoss = harvestWaterRemovedL - harvestWaterReturnedL;
    const makeup_L = V <= geometry.V_m3
      ? Math.max(0, evap_L + harvestNetLoss - rainfall_L)
      : 0;

    // ── Update pond volume (V is now a state variable) ────────
    const V_old = V;
    V = V + (rainfall_L + makeup_L - evap_L - harvestNetLoss) / 1000; // L → m³

    // ── Dilute biomass from volume change (mass conservation) ──
    if (V > V_old) {
      X_new = X_new * (V_old / V);
    }

    // ── Productivity ─────────────────────────────────────────
    const productivity_vol = mu_eff > 0 ? mu_eff * X : 0; // g/L/day
    const productivity_areal = productivity_vol * config.depth * 1000; // g/m²/day

    // ── Record timestep ──────────────────────────────────────
    timesteps.push({
      day,
      hour,

      biomass_concentration: X_new,
      pond_temperature: T_pond_new,
      culture_volume: V,

      net_growth_rate: mu_eff,
      light_factor: mu_L,
      temperature_factor: mu_T,
      nutrient_factor: mu_N,
      lighted_depth_fraction: par.f_lighted,

      par_direct_surface: par.par_direct_surface,
      par_diffuse_surface: par.par_diffuse_surface,
      par_avg_culture: par.par_avg_culture,
      fresnel_transmission_direct: par.fresnel_direct,

      productivity_volumetric: productivity_vol,
      productivity_areal: productivity_areal,

      q_solar: heat.q_solar,
      q_longwave_in: heat.q_longwave_in,
      q_longwave_out: heat.q_longwave_out,
      q_evap: heat.q_evap,
      q_convection: heat.q_convection,
      q_conduction: heat.q_conduction,
      q_biomass: heat.q_biomass,
      q_net: heat.q_net,

      air_temperature: weather.temperature,
      dew_point: weather.dewPoint,
      relative_humidity: weather.relativeHumidity,
      cloud_cover: weather.cloudCover,
      wind_speed_10m: weather.windSpeed,
      wind_speed_2m: heat.u2,
      direct_radiation: weather.directRadiation,
      diffuse_radiation: weather.diffuseRadiation,
      solar_elevation: weather.solarElevation,
      soil_temperature: weather.soilTemperature,
      precipitation: weather.precipitation,

      evap_L,
      rainfall_L,
      makeup_L,
      harvest_water_removed_L: harvestWaterRemovedL,
      harvest_water_returned_L: harvestWaterReturnedL,

      harvest_occurred: harvestOccurred,
      harvest_mass_kg: harvestMassKg,
    });

    // ── Advance state ────────────────────────────────────────
    X = X_new;
    T_pond = T_pond_new;
  }

  // ── Compute summary ──────────────────────────────────────────
  const temps = timesteps.map((t) => t.pond_temperature);
  const prods = timesteps.filter((t) => t.productivity_areal > 0);

  const summary: OpenPondSummary = {
    total_days: totalDays,
    total_harvested_kg: totalHarvested,
    avg_productivity_areal:
      prods.length > 0
        ? prods.reduce((s, t) => s + t.productivity_areal, 0) / prods.length
        : 0,
    avg_productivity_volumetric:
      prods.length > 0
        ? prods.reduce((s, t) => s + t.productivity_volumetric, 0) / prods.length
        : 0,
    avg_temperature:
      temps.reduce((s, t) => s + t, 0) / temps.length,
    harvest_count: harvestCount,
    min_temperature: Math.min(...temps),
    max_temperature: Math.max(...temps),
    final_density: timesteps[timesteps.length - 1]?.biomass_concentration ?? 0,
  };

  return { timesteps, summary };
}
