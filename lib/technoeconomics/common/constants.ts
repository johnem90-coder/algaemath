// Physical constants and conversion factors for TEA calculations
// Reference: docs/TEA_DESIGN.md Sections 1.3, 1.7

// ── Unit Conversions ───────────────────────────────────────────

export const ACRES_TO_M2 = 4046.86;
export const GAL_TO_L = 3.78541;
export const GAL_TO_M3 = 0.00378541;

// ── Energy Constants ───────────────────────────────────────────

export const MJ_PER_KWH = 3.6;
export const MJ_PER_L_DIESEL = 38.4;

// Drivetrain efficiency chain (diesel pumps)
export const ETA_PUMP = 0.70;
export const ETA_DRIVE = 0.95;
export const ETA_MOTOR = 0.35;
export const ETA_DIESEL_CHAIN = ETA_PUMP * ETA_DRIVE * ETA_MOTOR; // ≈ 0.23275

// ── Molecular Weights & Atomic Weights ─────────────────────────

export const MW_CO2 = 44.01; // g/mol
export const AW_C = 12.011; // g/mol
export const AW_N = 14.007; // g/mol
export const AW_P = 30.974; // g/mol
export const MW_KNO3 = 101.103; // g/mol
export const MW_DAP = 132.06; // g/mol  (NH₄)₂HPO₄

// ── Nutrient Uptake Efficiencies ───────────────────────────────

export const CO2_UPTAKE_EFFICIENCY = 0.30; // Open pond — significant degassing
export const N_UPTAKE_EFFICIENCY = 1.0;
export const P_UPTAKE_EFFICIENCY = 1.0;

// ── MACRS 7-Year Depreciation Schedule ─────────────────────────

export const MACRS_7 = [
  0.1429, 0.2449, 0.1749, 0.1249, 0.0893, 0.0892, 0.0893, 0.0446,
];

// ── Spray Dryer Constants ──────────────────────────────────────

export const HEAT_REQUIRED_MJ_PER_TON_WATER = 2260;
export const DRYER_EFFICIENCY = 0.25;
export const DRYER_OPERATING_FACTOR = 1.06;

// ── Natural Gas Energy ─────────────────────────────────────────

export const MJ_PER_CUFT_NATURAL_GAS = 1.055; // ≈ 1 MJ/cuft (approximate)

// ── CO₂ Storage ────────────────────────────────────────────────

export const CO2_LIQUID_DENSITY_TONS_M3 = 1.101;
