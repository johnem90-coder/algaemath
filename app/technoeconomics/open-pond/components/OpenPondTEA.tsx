"use client";

import { useMemo } from "react";
import { runTEA } from "@/lib/technoeconomics/open-pond";
import { SystemSummaryCards } from "./SystemSummaryCards";
import { InputVariablesTable } from "./InputVariablesTable";
import { SectionsOverviewTable } from "./SectionsOverviewTable";
import { CashFlowTable } from "./CashFlowTable";
import { SensitivityTable } from "./SensitivityTable";

export default function OpenPondTEA() {
  const result = useMemo(() => runTEA(), []);

  return (
    <div className="space-y-12">
      {/* System summary KPI cards */}
      <SystemSummaryCards result={result} />

      {/* Unit cost input variables */}
      <section>
        <h2 className="text-xl font-medium tracking-tight mb-4">
          Unit Cost Inputs
        </h2>
        <InputVariablesTable result={result} />
      </section>

      {/* Sections overview — matches Excel layout */}
      <section>
        <h2 className="text-xl font-medium tracking-tight mb-4">
          Sections Overview
        </h2>
        <SectionsOverviewTable result={result} />
      </section>

      {/* MBSP breakdown by category */}
      <section>
        <h2 className="text-xl font-medium tracking-tight mb-4">
          MBSP Breakdown
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Category</th>
                <th className="py-2 pr-4 font-medium text-right">$/ton</th>
                <th className="py-2 font-medium text-right">% of Total</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              <tr className="border-b border-dashed">
                <td className="py-1.5 pr-4">Annualized CAPEX</td>
                <td className="py-1.5 pr-4 text-right">
                  ${result.financials.mbsp_by_category.annualized_capex.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </td>
                <td className="py-1.5 text-right">
                  {((result.financials.mbsp_by_category.annualized_capex / result.financials.mbsp_by_category.total) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr className="border-b border-dashed">
                <td className="py-1.5 pr-4">Operating Cost (OPEX)</td>
                <td className="py-1.5 pr-4 text-right">
                  ${result.financials.mbsp_by_category.opex.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </td>
                <td className="py-1.5 text-right">
                  {((result.financials.mbsp_by_category.opex / result.financials.mbsp_by_category.total) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr className="border-b border-dashed">
                <td className="py-1.5 pr-4">Overhead</td>
                <td className="py-1.5 pr-4 text-right">
                  ${result.financials.mbsp_by_category.overhead.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </td>
                <td className="py-1.5 text-right">
                  {((result.financials.mbsp_by_category.overhead / result.financials.mbsp_by_category.total) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr className="font-semibold">
                <td className="py-1.5 pr-4">Simplified MBSP</td>
                <td className="py-1.5 pr-4 text-right">
                  ${result.financials.mbsp_by_category.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </td>
                <td className="py-1.5 text-right">100%</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            Simplified MBSP (CAPEX/lifetime + OPEX) differs from DCF-derived MBSP (${result.financials.mbsp.toLocaleString("en-US", { maximumFractionDigits: 0 })}/ton) because it does not account for time-value of money or depreciation tax shields.
          </p>
        </div>
      </section>

      {/* MBSP by section */}
      <section>
        <h2 className="text-xl font-medium tracking-tight mb-4">
          Cost Contribution by Section
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Section</th>
                <th className="py-2 pr-4 font-medium text-right">CAPEX $/ton</th>
                <th className="py-2 pr-4 font-medium text-right">OPEX $/ton</th>
                <th className="py-2 pr-4 font-medium text-right">Total $/ton</th>
                <th className="py-2 font-medium text-right">% of MBSP</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {result.financials.mbsp_by_section.map((row) => (
                <tr key={row.section_id} className="border-b border-dashed">
                  <td className="py-1.5 pr-4">{row.section_name}</td>
                  <td className="py-1.5 pr-4 text-right">
                    ${row.capex_per_ton.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-1.5 pr-4 text-right">
                    ${row.opex_per_ton.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-1.5 pr-4 text-right">
                    ${row.total_per_ton.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-1.5 text-right">
                    {row.percent_of_mbsp.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Revenue sensitivity */}
      <section>
        <h2 className="text-xl font-medium tracking-tight mb-4">
          Revenue Sensitivity
        </h2>
        <SensitivityTable result={result} />
      </section>

      {/* Cash flow schedule */}
      <section>
        <h2 className="text-xl font-medium tracking-tight mb-4">
          Annual Cash Flow Schedule
        </h2>
        <CashFlowTable result={result} />
      </section>
    </div>
  );
}
