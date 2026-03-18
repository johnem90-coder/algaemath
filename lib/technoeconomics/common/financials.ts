// Financial analysis — NPV, IRR, MBSP, DCF, depreciation, sensitivity
// Reference: docs/TEA_DESIGN.md Section 1.9

import type {
  AnnualCashFlow,
  SensitivityRow,
  MBSPBreakdown,
  MBSPCategoryBreakdown,
  SectionCost,
  ConstructionTimeline,
} from "../types";
import { MACRS_7 } from "./constants";
import {
  productionFractionForYear,
  capexFractionForYear,
} from "./construction";

// ── Tax Rate ───────────────────────────────────────────────────

export function computeTaxRate(federal: number, state: number): number {
  return federal + state - federal * state;
}

// ── Depreciation ───────────────────────────────────────────────

function macrsDepreciation(capex: number, year: number): number {
  if (year < 1 || year > MACRS_7.length) return 0;
  return capex * MACRS_7[year - 1];
}

function straightLineDepreciation(
  capex: number,
  salvage: number,
  lifetime: number,
  year: number
): number {
  if (year < 1 || year > lifetime) return 0;
  return (capex - salvage) / lifetime;
}

// ── Cash Flow Schedule ─────────────────────────────────────────

export interface CashFlowParams {
  total_capex: number;
  annual_opex: number; // AOC (including overhead)
  q_actual: number; // tons/yr
  sale_price: number; // $/ton
  discount_rate: number;
  tax_rate: number;
  lifetime: number;
  depreciation_method: "MACRS-7" | "straight-line";
  working_capital_fraction: number;
  salvage_value_fraction: number;
  construction?: ConstructionTimeline; // optional — if omitted, all CAPEX in year 0, full production from year 1
  n_ponds?: number; // needed when construction is provided
}

export function computeCashFlows(params: CashFlowParams): AnnualCashFlow[] {
  const {
    total_capex,
    annual_opex,
    q_actual,
    sale_price,
    discount_rate,
    tax_rate,
    lifetime,
    depreciation_method,
    working_capital_fraction,
    salvage_value_fraction,
    construction,
    n_ponds,
  } = params;

  const tci = total_capex * (1 + working_capital_fraction);
  const salvage = total_capex * salvage_value_fraction;
  const flows: AnnualCashFlow[] = [];
  let cumulative_dcf = 0;

  // Determine how many years to model.
  // With construction, year 0 may span initial construction, and the lifetime
  // counts from year 1 (first possible revenue year).
  const total_years = lifetime;

  // ── Year 0 — construction investment ──
  const capex_frac_y0 = construction
    ? capexFractionForYear(0, construction)
    : 1; // all CAPEX in year 0 if no construction timeline
  const capex_y0 = total_capex * capex_frac_y0;
  const wc_y0 = capex_y0 * working_capital_fraction;
  const fcf_y0 = -(capex_y0 + wc_y0);

  cumulative_dcf += fcf_y0; // year 0 discount factor = 1

  flows.push({
    year: 0,
    revenue: 0,
    cogs: 0,
    gross_profit: 0,
    depreciation: 0,
    taxable_income: 0,
    taxes: 0,
    net_income: 0,
    free_cash_flow: fcf_y0,
    cumulative_dcf,
    production_fraction: 0,
    capex_spent: capex_y0,
  });

  // Track cumulative CAPEX spent for depreciation basis
  let cumulative_capex = capex_y0;

  // ── Years 1 through lifetime ──
  for (let t = 1; t <= total_years; t++) {
    // Staged CAPEX: additional investment in later years
    const capex_frac_t = construction
      ? capexFractionForYear(t, construction)
      : 0;
    const capex_t = total_capex * capex_frac_t;
    const wc_t = capex_t * working_capital_fraction;
    cumulative_capex += capex_t;

    // Production fraction for this year (ramp-up)
    const prod_frac = construction && n_ponds
      ? productionFractionForYear(t, construction, n_ponds)
      : 1; // full production if no construction timeline

    const revenue = sale_price * q_actual * prod_frac;
    const cogs = annual_opex * prod_frac;
    const gross_profit = revenue - cogs;

    // Depreciation is based on cumulative CAPEX placed in service
    // For simplicity, depreciate the total CAPEX on the same schedule
    // (conservative: some batches are placed later but we use the full basis)
    const depreciation =
      depreciation_method === "MACRS-7"
        ? macrsDepreciation(total_capex, t)
        : straightLineDepreciation(total_capex, salvage, lifetime, t);

    const taxable_income = gross_profit - depreciation;
    const taxes = Math.max(0, taxable_income * tax_rate);
    const net_income = taxable_income - taxes;
    let free_cash_flow = net_income + depreciation - capex_t - wc_t;

    // Final year — add salvage value + recover working capital
    if (t === total_years) {
      free_cash_flow += salvage + total_capex * working_capital_fraction;
    }

    const discount_factor = Math.pow(1 + discount_rate, t);
    cumulative_dcf += free_cash_flow / discount_factor;

    flows.push({
      year: t,
      revenue,
      cogs,
      gross_profit,
      depreciation,
      taxable_income,
      taxes,
      net_income,
      free_cash_flow,
      cumulative_dcf,
      production_fraction: prod_frac,
      capex_spent: capex_t,
    });
  }

  return flows;
}

// ── NPV ────────────────────────────────────────────────────────

export function computeNPV(cashFlows: AnnualCashFlow[]): number {
  return cashFlows[cashFlows.length - 1]?.cumulative_dcf ?? 0;
}

/** Compute NPV from raw FCF array at a given discount rate */
function npvFromFCF(fcfs: number[], rate: number): number {
  let npv = 0;
  for (let t = 0; t < fcfs.length; t++) {
    npv += fcfs[t] / Math.pow(1 + rate, t);
  }
  return npv;
}

// ── IRR (Bisection) ────────────────────────────────────────────

export function computeIRR(
  cashFlows: AnnualCashFlow[],
  tolerance: number = 0.0001
): number {
  const fcfs = cashFlows.map((cf) => cf.free_cash_flow);

  let lo = -0.5;
  let hi = 5.0;
  const maxIter = 200;

  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const npv = npvFromFCF(fcfs, mid);

    if (Math.abs(npv) < 1 || Math.abs(hi - lo) < tolerance) {
      return mid;
    }

    if (npv > 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return (lo + hi) / 2;
}

// ── MBSP (Bisection) ──────────────────────────────────────────

export function computeMBSP(
  params: Omit<CashFlowParams, "sale_price">,
  tolerance: number = 1
): number {
  let lo = 0;
  let hi = 200000; // $/ton
  const maxIter = 200;

  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const flows = computeCashFlows({ ...params, sale_price: mid });
    const npv = computeNPV(flows);

    if (Math.abs(npv) < 100 || Math.abs(hi - lo) < tolerance) {
      return mid;
    }

    if (npv < 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return (lo + hi) / 2;
}

// ── Payback Period ─────────────────────────────────────────────

export function computePaybackSimple(
  tci: number,
  annual_fcf: number
): number {
  if (annual_fcf <= 0) return Infinity;
  return tci / annual_fcf;
}

export function computePaybackDiscounted(
  cashFlows: AnnualCashFlow[]
): number {
  for (const cf of cashFlows) {
    if (cf.year > 0 && cf.cumulative_dcf >= 0) {
      return cf.year;
    }
  }
  return Infinity;
}

// ── Sensitivity Table ──────────────────────────────────────────

export function computeSensitivityTable(
  params: Omit<CashFlowParams, "sale_price">,
  priceRange?: number[]
): SensitivityRow[] {
  const prices = priceRange ?? [
    10000, 15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000,
  ];

  return prices.map((sale_price) => {
    const flows = computeCashFlows({ ...params, sale_price });
    const npv = computeNPV(flows);
    const revenue = sale_price * params.q_actual;
    const gross_profit = revenue - params.annual_opex;
    // Use year-1 flow for net income (representative steady-state)
    const year1 = flows[1];
    const net_income = year1?.net_income ?? 0;
    const net_profit_margin = revenue > 0 ? net_income / revenue : 0;

    return { sale_price, revenue, gross_profit, net_income, net_profit_margin, npv };
  });
}

// ── MBSP Breakdown ─────────────────────────────────────────────

export function computeMBSPBreakdown(
  sections: Record<string, SectionCost>,
  q_actual: number,
  lifetime: number,
  mbsp: number
): MBSPBreakdown[] {
  const entries = Object.values(sections).map((s) => {
    const capex_per_ton = s.capital_cost / (q_actual * lifetime);
    const opex_per_ton = s.operating_cost / q_actual;
    const total_per_ton = capex_per_ton + opex_per_ton;
    return {
      section_id: s.section_id,
      section_name: s.section_name,
      capex_per_ton,
      opex_per_ton,
      total_per_ton,
      percent_of_mbsp: mbsp > 0 ? (total_per_ton / mbsp) * 100 : 0,
    };
  });

  return entries;
}

export function computeMBSPCategoryBreakdown(
  totalCapex: number,
  aoc: number,
  overheadPerTon: number,
  q_actual: number,
  lifetime: number
): MBSPCategoryBreakdown {
  const annualized_capex = totalCapex / (q_actual * lifetime);
  // aoc already includes overhead, so subtract it to get pure section OPEX
  const opex = (aoc - overheadPerTon * q_actual) / q_actual;
  const overhead = overheadPerTon;
  return {
    annualized_capex,
    opex,
    overhead,
    total: annualized_capex + opex + overhead,
  };
}
