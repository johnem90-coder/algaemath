// Re-exports for the open-pond TEA module
// Follows the pattern of lib/simulation/simple-outdoor/index.ts

export { runTEA } from "./engine";
export { getDefaultTEAConfig, DEFAULT_TEA_CONFIG } from "./config";
export type {
  TEAConfig,
  TEAResult,
  SectionCost,
  EquipmentItem,
  ResourceConsumption,
  FinancialAnalysis,
  AnnualCashFlow,
  SensitivityRow,
  MBSPBreakdown,
  MBSPCategoryBreakdown,
  PondGeometryTEA,
  NutrientBalance,
} from "../types";
