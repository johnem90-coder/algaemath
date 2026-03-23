"use client";

import { useState } from "react";
import type { TEAResult } from "@/lib/technoeconomics/open-pond";

interface Props {
  result: TEAResult;
}

function fmt(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

type View = "section" | "category";

export function CostContributionTable({ result }: Props) {
  const [view, setView] = useState<View>("section");

  const rows = result.financials.mbsp_by_section;
  const mbsp = result.financials.mbsp;
  const overheadPerTon = result.config.overhead_per_ton;
  const lifetime = result.financials.unit_lifetime_years;
  const q = result.actual_production_tons_yr;

  // Undiscounted totals (for Taxes & Finance row)
  const sectionCapex = rows.reduce((s, r) => s + r.capex_per_ton, 0);
  const sectionOpex = rows.reduce((s, r) => s + r.opex_per_ton, 0);
  const totalUndiscounted = sectionCapex + sectionOpex + overheadPerTon;
  const financeAdjustment = mbsp - totalUndiscounted;

  const pct = (val: number) => mbsp > 0 ? (val / mbsp) * 100 : 0;

  // ── By Category: sum each cost type across all sections ──
  const sections = Object.values(result.sections);
  const catEquip    = sections.reduce((s, sec) => s + sec.equipment_purchase, 0) / (q * lifetime);
  const catInstall  = sections.reduce((s, sec) => s + sec.install_engr_other, 0) / (q * lifetime);
  const catMaterials = sections.reduce((s, sec) => s + sec.materials_cost, 0) / q;
  const catEnergy   = sections.reduce((s, sec) => s + sec.energy_cost, 0) / q;
  const catMaint    = sections.reduce((s, sec) => s + sec.maintenance_cost, 0) / q;
  const catLabor    = sections.reduce((s, sec) => s + sec.labor_cost, 0) / q;

  const categoryRows = [
    { label: "Equipment",     value: catEquip,     isCapex: true },
    { label: "Install & Engr",value: catInstall,   isCapex: true },
    { label: "Materials",     value: catMaterials, isCapex: false },
    { label: "Energy",        value: catEnergy,    isCapex: false },
    { label: "Maintenance",   value: catMaint,     isCapex: false },
    { label: "Labor",         value: catLabor,     isCapex: false },
    { label: "Overhead",      value: overheadPerTon, isCapex: false },
  ];

  const views: { id: View; label: string }[] = [
    { id: "section",  label: "By Section" },
    { id: "category", label: "By Category" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-muted-foreground">Cost Contribution ($/ton)</h3>
        <span className="flex items-center gap-1">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-normal cursor-pointer transition-colors ${
                view === v.id
                  ? "bg-foreground/15 text-foreground font-medium"
                  : "bg-muted text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </span>
      </div>

      {view === "category" ? (
        /* ── By Category view ── */
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1.5 pr-1 font-medium text-xs">Category</th>
              <th className="py-1.5 pr-1 font-medium text-xs text-right text-transparent select-none">CAPEX</th>
              <th className="py-1.5 pr-1 font-medium text-xs text-right text-transparent select-none">OPEX</th>
              <th className="py-1.5 pr-1 font-medium text-xs text-right">Total</th>
              <th className="py-1.5 font-medium text-xs text-right">%</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[11px]">
            {categoryRows.map((row) => (
              <tr key={row.label} className="border-b border-dashed">
                <td className="py-1 pr-1 font-sans text-xs">
                  {row.label}
                  {row.isCapex && (
                    <span className="ml-1 text-[9px] text-muted-foreground">(ann.)</span>
                  )}
                </td>
                <td className="py-1 pr-1 text-right text-muted-foreground">—</td>
                <td className="py-1 pr-1 text-right text-muted-foreground">—</td>
                <td className="py-1 pr-1 text-right">{fmt(row.value)}</td>
                <td className="py-1 text-right text-muted-foreground">{pct(row.value).toFixed(1)}%</td>
              </tr>
            ))}
            {Math.abs(financeAdjustment) > 1 && (
              <tr className="border-b border-dashed">
                <td className="py-1 pr-1 font-sans text-xs text-muted-foreground">Taxes &amp; Finance</td>
                <td className="py-1 pr-1 text-right text-muted-foreground">—</td>
                <td className="py-1 pr-1 text-right text-muted-foreground">—</td>
                <td className="py-1 pr-1 text-right">{fmt(financeAdjustment)}</td>
                <td className="py-1 text-right text-muted-foreground">{pct(financeAdjustment).toFixed(1)}%</td>
              </tr>
            )}
            <tr className="border-t-2 font-semibold">
              <td className="py-1.5 pr-1 font-sans text-xs">MBSP</td>
              <td className="py-1.5 pr-1 text-right text-muted-foreground">—</td>
              <td className="py-1.5 pr-1 text-right text-muted-foreground">—</td>
              <td className="py-1.5 pr-1 text-right">{fmt(mbsp)}</td>
              <td className="py-1.5 text-right text-muted-foreground">100%</td>
            </tr>
          </tbody>
        </table>
      ) : (
        /* ── By Section view (default) ── */
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1.5 pr-1 font-medium text-xs">Section</th>
              <th className="py-1.5 pr-1 font-medium text-xs text-right">CAPEX</th>
              <th className="py-1.5 pr-1 font-medium text-xs text-right">OPEX</th>
              <th className="py-1.5 pr-1 font-medium text-xs text-right">Total</th>
              <th className="py-1.5 font-medium text-xs text-right">%</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[11px]">
            {rows.map((row) => (
              <tr key={row.section_id} className="border-b border-dashed">
                <td className="py-1 pr-1 font-sans text-xs">{row.section_name}</td>
                <td className="py-1 pr-1 text-right text-muted-foreground">{fmt(row.capex_per_ton)}</td>
                <td className="py-1 pr-1 text-right text-muted-foreground">{fmt(row.opex_per_ton)}</td>
                <td className="py-1 pr-1 text-right">{fmt(row.total_per_ton)}</td>
                <td className="py-1 text-right text-muted-foreground">{pct(row.total_per_ton).toFixed(1)}%</td>
              </tr>
            ))}
            <tr className="border-b border-dashed">
              <td className="py-1 pr-1 font-sans text-xs">Overhead</td>
              <td className="py-1 pr-1 text-right text-muted-foreground">—</td>
              <td className="py-1 pr-1 text-right text-muted-foreground">{fmt(overheadPerTon)}</td>
              <td className="py-1 pr-1 text-right">{fmt(overheadPerTon)}</td>
              <td className="py-1 text-right text-muted-foreground">{pct(overheadPerTon).toFixed(1)}%</td>
            </tr>
            {Math.abs(financeAdjustment) > 1 && (
              <tr className="border-b border-dashed">
                <td className="py-1 pr-1 font-sans text-xs text-muted-foreground">Taxes &amp; Finance</td>
                <td className="py-1 pr-1 text-right text-muted-foreground">—</td>
                <td className="py-1 pr-1 text-right text-muted-foreground">—</td>
                <td className="py-1 pr-1 text-right">{fmt(financeAdjustment)}</td>
                <td className="py-1 text-right text-muted-foreground">{pct(financeAdjustment).toFixed(1)}%</td>
              </tr>
            )}
            <tr className="border-t-2 font-semibold">
              <td className="py-1.5 pr-1 font-sans text-xs">MBSP</td>
              <td className="py-1.5 pr-1 text-right text-muted-foreground">{fmt(sectionCapex)}</td>
              <td className="py-1.5 pr-1 text-right text-muted-foreground">{fmt(sectionOpex + overheadPerTon)}</td>
              <td className="py-1.5 pr-1 text-right">{fmt(mbsp)}</td>
              <td className="py-1.5 text-right text-muted-foreground">100%</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
