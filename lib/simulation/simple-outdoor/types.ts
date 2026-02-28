// Type definitions for the open pond simulation engine
// Reference: docs/SIMULATION_DESIGN.md Sections 2.5, 2.6

/** User-configurable simulation parameters */
export interface OpenPondConfig {
  // Pond geometry
  area_ha: number; // Reference area W×L (hectares), used to derive W and L
  depth: number; // Culture depth (m)
  aspect_ratio: number; // Length-to-width ratio (L / W_outer)
  berm_width: number; // Center divider width (m), 0 = no berm

  // Initial conditions
  initial_density: number; // Starting biomass concentration (g/L)
  initial_temperature: number; // Starting pond temperature (°C), null = use air temp

  // Growth kinetics
  mu_max: number; // Maximum specific growth rate (/day)
  Iopt: number; // Optimal light intensity for Steele model (µmol/m²/s)
  Topt: number; // Optimal temperature (°C)
  alpha: number; // Temperature response width (Gaussian steepness)
  death_rate: number; // Death/lysis rate (/day)

  // Light attenuation
  epsilon: number; // Specific extinction coefficient (m²/g)
  kb: number; // Background extinction (m⁻¹)

  // Harvest (occurs overnight, hours 20–23, ~4 hours)
  harvest_mode: "none" | "semi-continuous" | "batch"; // Harvest strategy
  harvest_threshold: number; // Semi-continuous: min density to maintain (g/L); Batch: trigger density (g/L)
  harvest_target: number; // Batch: restart density after harvest (g/L)
}

/** Computed pond geometry from config */
export interface OpenPondGeometry {
  W: number; // Channel width (m)
  Ltotal: number; // Total racetrack length (m)
  A_surface: number; // Pond surface area (m²)
  perimeter: number; // Outer perimeter (m)
  A_soil: number; // Ground contact area including side walls (m²)
  V_m3: number; // Culture volume (m³)
  V_liters: number; // Culture volume (L)
}

/** Full per-timestep simulation output */
export interface OpenPondTimestep {
  // Time
  day: number; // Simulation day (1-indexed)
  hour: number; // Hour of day (0–23)

  // Core state
  biomass_concentration: number; // g/L
  pond_temperature: number; // °C
  culture_volume: number; // m³

  // Growth factors
  net_growth_rate: number; // /day
  light_factor: number; // 0–1
  temperature_factor: number; // 0–1
  nutrient_factor: number; // 0–1 (1.0 in v1)
  lighted_depth_fraction: number; // 0–1

  // Light detail
  par_direct_surface: number; // µmol/m²/s (after Fresnel)
  par_diffuse_surface: number; // µmol/m²/s (after Fresnel)
  par_avg_culture: number; // µmol/m²/s (volume-averaged)
  fresnel_transmission_direct: number; // 0–1

  // Productivity
  productivity_volumetric: number; // g/L/day
  productivity_areal: number; // g/m²/day

  // Heat flux components (W/m²)
  q_solar: number;
  q_longwave_in: number;
  q_longwave_out: number;
  q_evap: number;
  q_convection: number;
  q_conduction: number;
  q_biomass: number;
  q_net: number;

  // Climate inputs
  air_temperature: number; // °C
  dew_point: number; // °C
  relative_humidity: number; // 0–100 %
  cloud_cover: number; // 0–100 %
  wind_speed_10m: number; // m/s
  wind_speed_2m: number; // m/s
  direct_radiation: number; // W/m²
  diffuse_radiation: number; // W/m²
  solar_elevation: number; // degrees
  soil_temperature: number; // °C
  precipitation: number; // mm

  // Water balance
  evap_L: number; // Evaporative water loss this hour (L)
  rainfall_L: number; // Rainfall volume added this hour (L)
  makeup_L: number; // Fresh water added this hour (L)
  harvest_water_removed_L: number; // Culture volume removed during harvest (L)
  harvest_water_returned_L: number; // Water recycled from harvest (80%) (L)

  // Harvest
  harvest_occurred: boolean;
  harvest_mass_kg: number; // 0 if no harvest
}

/** Summary statistics for a completed simulation run */
export interface OpenPondSummary {
  total_days: number;
  total_harvested_kg: number;
  avg_productivity_areal: number; // g/m²/day
  avg_productivity_volumetric: number; // g/L/day
  avg_temperature: number; // °C
  harvest_count: number;
  min_temperature: number;
  max_temperature: number;
  final_density: number; // g/L
}

/** Sensible defaults for Spirulina — 250 m × 17 m racetrack (~1 acre), 200 mm deep */
export const DEFAULT_CONFIG: OpenPondConfig = {
  area_ha: 0.425, // ref area 250 × 17 = 4250 m²
  depth: 0.2, // 200 mm
  aspect_ratio: 250 / 17, // ≈ 14.71 → W = 17 m, L = 250 m
  berm_width: 0.8, // 800 mm center divider

  initial_density: 0.3, // g/L
  initial_temperature: 25, // °C

  mu_max: 4.0, // /day (Spirulina typical)
  Iopt: 200, // µmol/m²/s
  Topt: 30, // °C
  alpha: 0.03, // Gaussian width
  death_rate: 0.05, // /day

  epsilon: 0.15, // m²/g
  kb: 0.2, // m⁻¹

  harvest_mode: "none",
  harvest_threshold: 2.0, // g/L — trigger density for both modes
  harvest_target: 0.3, // g/L — reset density (semi-continuous and batch)
};
