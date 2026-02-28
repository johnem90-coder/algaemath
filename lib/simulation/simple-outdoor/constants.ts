// Physical constants for open pond simulation
// Reference: docs/SIMULATION_DESIGN.md Section 8

// Radiation
export const SIGMA = 5.67e-8; // Stefan-Boltzmann constant (W/m²/K⁴)

// Water properties
export const RHO_WATER = 1000; // Water density (kg/m³)
export const CP_WATER = 4186; // Water heat capacity (J/kg/°C)
export const LAMBDA_WATER = 2.45; // Latent heat of vaporization (MJ/kg)
export const EPSILON_WATER = 0.97; // Emissivity of water in infrared

// PAR conversion
export const F_PAR = 0.43; // PAR fraction of total solar spectrum
export const PAR_CONVERSION = 4.57; // µmol/J for sunlight in PAR range
export const PAR_COMBINED = F_PAR * PAR_CONVERSION; // 1.965 — shortcut W/m² → µmol/m²/s

// Optics
export const N_AIR = 1.0; // Refractive index of air
export const N_WATER = 1.333; // Refractive index of water
export const I_MIN_PAR = 1.0; // Minimum usable PAR threshold (µmol/m²/s)
export const THETA_DIFFUSE_DEG = 60; // Equivalent angle for hemispherical diffuse (degrees)

// Heat transfer
export const H_COMBUSTION = 20; // Heat of combustion of algae (MJ/kg)
export const BOWEN_CONSTANT = 61.3; // Bowen constant (Pa/°C)
export const Z0_WATER = 0.001; // Aerodynamic roughness length for open water (m)
export const K_GROUND = 1.5; // Soil thermal conductivity (W/m/°C)
export const D_GROUND = 0.5; // Effective depth for ground conduction (m)
export const P_REF = 101325; // Reference atmospheric pressure (Pa)

// Evaporation (Penman-type)
export const H_EVAP = 6.43; // Evaporative mass transfer coefficient (MJ/m²/day/kPa)
export const A_WIND = 1.0; // Calm-air coefficient
export const B_WIND = 0.536; // Wind enhancement coefficient

// Wind conversion ratio (precomputed)
// ln(2/0.001) / ln(10/0.001) = 7.601 / 9.210 ≈ 0.8253
export const WIND_10_TO_2 = Math.log(2 / Z0_WATER) / Math.log(10 / Z0_WATER);

// Degrees ↔ radians
export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;
