"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import type { TEAResult } from "@/lib/technoeconomics/open-pond";

const CHART_YEARS = 10;
const QUARTERS = CHART_YEARS * 4; // 40 quarters
const WEEKS_PER_QUARTER = 13;
const WEEKS_PER_YEAR = 52;

interface Props {
  result: TEAResult;
  salePricePerKg: number;
}

export function LifetimeValueChart({ result, salePricePerKg }: Props) {
  const salePricePerTon = salePricePerKg * 1000;

  const data = useMemo(() => {
    const { construction, total_capex, actual_production_tons_yr, total_annual_cost, n_ponds } = result;
    const discountRate = result.financials.discount_rate;

    // Revenue per pond per week (at full capacity)
    const revenuePerPondWeek = (salePricePerTon * actual_production_tons_yr) / (n_ponds * WEEKS_PER_YEAR);
    // OPEX per pond per week (at full capacity)
    const opexPerPondWeek = total_annual_cost / (n_ponds * WEEKS_PER_YEAR);

    let cumulativeRevenue = 0;
    let cumulativeExpenditure = 0;
    let cumulativeNPV = 0;

    const points: { quarter: number; revenue: number; expenditure: number; npv: number }[] = [];

    // Start at quarter 0 with all values at 0
    points.push({ quarter: 0, revenue: 0, expenditure: 0, npv: 0 });

    for (let q = 1; q <= QUARTERS; q++) {
      const qStartWeek = (q - 1) * WEEKS_PER_QUARTER;
      const qEndWeek = q * WEEKS_PER_QUARTER;

      // CAPEX: add batch cost at the start of each batch's construction
      let quarterCapex = 0;
      for (const batch of construction.batches) {
        if (batch.build_start_week >= qStartWeek && batch.build_start_week < qEndWeek) {
          quarterCapex += batch.capex_fraction * total_capex;
        }
      }
      cumulativeExpenditure += quarterCapex;

      // Production: count pond-weeks producing this quarter
      let pondWeeksProducing = 0;
      for (const batch of construction.batches) {
        const prodStart = batch.test_end_week;
        if (prodStart >= qEndWeek) continue; // not producing yet
        if (prodStart <= qStartWeek) {
          // Full quarter of production
          pondWeeksProducing += batch.n_ponds * WEEKS_PER_QUARTER;
        } else {
          // Partial quarter
          pondWeeksProducing += batch.n_ponds * (qEndWeek - prodStart);
        }
      }

      const quarterRevenue = pondWeeksProducing * revenuePerPondWeek;
      const quarterOpex = pondWeeksProducing * opexPerPondWeek;

      cumulativeRevenue += quarterRevenue;
      cumulativeExpenditure += quarterOpex;

      // NPV: discount quarterly net cash flow
      const yearFraction = (q * WEEKS_PER_QUARTER) / WEEKS_PER_YEAR;
      const discountFactor = Math.pow(1 + discountRate, yearFraction);
      const quarterFCF = quarterRevenue - quarterOpex - quarterCapex;
      cumulativeNPV += quarterFCF / discountFactor;

      points.push({
        quarter: q / 4, // display as fractional years
        revenue: cumulativeRevenue,
        expenditure: cumulativeExpenditure,
        npv: cumulativeNPV,
      });
    }

    return points;
  }, [result, salePricePerTon]);

  const formatMillions = (value: number) => {
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatQuarterLabel = (value: number) => {
    if (value === Math.floor(value)) return `${value}`;
    return "";
  };

  return (
    <div className="touch-pan-y">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 24, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="quarter"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={formatQuarterLabel}
            interval={3}
            label={{ value: "Year", position: "insideBottom", offset: 0, fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={formatMillions}
            width={64}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const v = typeof value === "number" ? value : 0;
              const label =
                name === "revenue"
                  ? "Cumulative Revenue"
                  : name === "expenditure"
                    ? "Cumulative Expenditure"
                    : "NPV (DCF)";
              return [formatMillions(v), label];
            }}
            labelFormatter={(label) => {
              const y = Number(label);
              const yr = Math.floor(y);
              const qtr = Math.round((y - yr) * 4) + 1;
              return `Year ${yr} Q${qtr}`;
            }}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value: string) =>
              value === "revenue"
                ? "Cumulative Revenue"
                : value === "expenditure"
                  ? "Cumulative Expenditure"
                  : "NPV (DCF)"
            }
          />
          <ReferenceLine y={0} stroke="#333" strokeWidth={0.5} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="hsl(145, 60%, 45%)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="expenditure"
            stroke="hsl(0, 70%, 55%)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="npv"
            stroke="hsl(220, 70%, 55%)"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
