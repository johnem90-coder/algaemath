// Construction timeline and ramp-up model
//
// Assumptions:
//   - Ponds are built in fully sequential batches of up to max_ponds_per_batch.
//   - Each pond takes pond_build_weeks to build (sequential within a batch).
//   - After all ponds in a batch are built, a batch_test_weeks test run occurs.
//   - The next batch does NOT start until the previous batch's test is complete.
//   - Revenue from a batch begins only after its test run completes.
//   - CAPEX is allocated proportionally to each batch by pond count.

import type { TEAConfig, ConstructionTimeline, ConstructionBatch } from "../types";

const WEEKS_PER_YEAR = 52;

/**
 * Compute the construction timeline for a given facility size.
 */
export function computeConstructionTimeline(
  n_ponds: number,
  config: TEAConfig
): ConstructionTimeline {
  const { max_ponds_per_batch, pond_build_weeks, batch_test_weeks } = config;

  const n_batches = Math.ceil(n_ponds / max_ponds_per_batch);
  const batches: ConstructionBatch[] = [];

  let week_cursor = 0;
  let ponds_assigned = 0;

  for (let i = 0; i < n_batches; i++) {
    const batch_size = Math.min(max_ponds_per_batch, n_ponds - ponds_assigned);
    const build_start = week_cursor;
    const build_end = build_start + batch_size * pond_build_weeks;
    const test_end = build_end + batch_test_weeks;

    batches.push({
      batch_index: i,
      n_ponds: batch_size,
      build_start_week: build_start,
      build_end_week: build_end,
      test_end_week: test_end,
      capex_fraction: batch_size / n_ponds,
    });

    ponds_assigned += batch_size;
    week_cursor = test_end; // fully sequential — next batch starts after test
  }

  return {
    batches,
    total_construction_weeks: week_cursor,
    first_revenue_week: batches[0].test_end_week,
    full_production_week: batches[batches.length - 1].test_end_week,
  };
}

/**
 * For a given year t, compute the fraction of full production capacity available.
 *
 * Year mapping: year t covers weeks [t * 52, (t+1) * 52).
 * Year 0 = construction start; year 1 = second calendar year; etc.
 * Revenue is only computed for years ≥ 1 in the cash flow model, so year 0
 * production (if any) is conservatively ignored.
 *
 * Returns a value between 0 and 1.
 */
export function productionFractionForYear(
  year: number,
  timeline: ConstructionTimeline,
  n_ponds: number
): number {
  if (year <= 0 || n_ponds === 0) return 0;

  // Year t covers weeks [t*52, (t+1)*52)
  const year_start_week = year * WEEKS_PER_YEAR;
  const year_end_week = (year + 1) * WEEKS_PER_YEAR;

  let total_pond_weeks = 0;

  for (const batch of timeline.batches) {
    const prod_start = batch.test_end_week; // when this batch starts producing

    if (prod_start >= year_end_week) {
      // Batch hasn't started producing by end of this year
      continue;
    }

    if (prod_start <= year_start_week) {
      // Batch was producing for the entire year
      total_pond_weeks += batch.n_ponds * WEEKS_PER_YEAR;
    } else {
      // Batch started producing mid-year
      const weeks_producing = year_end_week - prod_start;
      total_pond_weeks += batch.n_ponds * weeks_producing;
    }
  }

  const max_pond_weeks = n_ponds * WEEKS_PER_YEAR;
  return total_pond_weeks / max_pond_weeks;
}

/**
 * For a given year t, compute the fraction of total CAPEX spent that year.
 * CAPEX for a batch is spent at the start of its construction.
 *
 * Year mapping: year t covers weeks [t * 52, (t+1) * 52).
 * Year 0 = weeks 0–51; year 1 = weeks 52–103; etc.
 */
export function capexFractionForYear(
  year: number,
  timeline: ConstructionTimeline
): number {
  const year_start_week = Math.max(0, year) * WEEKS_PER_YEAR;
  const year_end_week = (Math.max(0, year) + 1) * WEEKS_PER_YEAR;

  let fraction = 0;
  for (const batch of timeline.batches) {
    if (batch.build_start_week >= year_start_week && batch.build_start_week < year_end_week) {
      fraction += batch.capex_fraction;
    }
  }

  return fraction;
}
