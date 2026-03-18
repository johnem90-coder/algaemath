"use client";

import { useState, useMemo, useCallback } from "react";
import { runTEA, DEFAULT_TEA_CONFIG } from "@/lib/technoeconomics/open-pond";
import { ACRES_TO_M2 } from "@/lib/technoeconomics/common/constants";
import { Slider } from "@/components/ui/slider";
import { SystemSummaryCards } from "./SystemSummaryCards";
import { InputVariablesTable } from "./InputVariablesTable";
import { SectionsOverviewTable } from "./SectionsOverviewTable";
import { CashFlowTable } from "./CashFlowTable";
import { SensitivityTable } from "./SensitivityTable";
import { MBSPBreakdownTable } from "./MBSPBreakdownTable";
import { CostContributionTable } from "./CostContributionTable";
import { LifetimeValueChart } from "./LifetimeValueChart";
import { SectionDetailPanel, type PanelSelection } from "./SectionDetailPanel";
import { InputCostsPanel } from "./InputCostsPanel";

// ── Back-calculate desired_output_tons_yr from a target n_ponds ────
// Inverts geometry.ts: n_ponds = ceil(V_required / V_pond), grid = n_rows × 2
function backCalcDesiredOutput(targetPonds: number): number {
  const cfg = DEFAULT_TEA_CONFIG;
  const A_pond_m2 = cfg.pond_size_acres * ACRES_TO_M2;
  const AR = cfg.pond_lw_ratio;
  const W = Math.sqrt(A_pond_m2 / AR);
  const L_total = W * AR;
  const SA = W * (L_total - W) + Math.PI * (W / 2) ** 2;
  const V_pond_m3 = SA * cfg.pond_depth_m;

  const BM_rate = cfg.density_at_harvest_g_L * cfg.effective_growth_rate_per_day;
  const BM_annual = BM_rate * cfg.active_days_yr; // g/L/yr

  // Q = n_ponds × V_pond_m3 × 1000 × BM_annual / 1e6
  return (targetPonds * V_pond_m3 * 1000 * BM_annual) / 1e6;
}

// Compute initial default pond count from default config
function getDefaultPondCount(): number {
  const initial = runTEA();
  return initial.n_ponds;
}

const DEFAULT_N_PONDS = getDefaultPondCount();

export default function OpenPondTEA() {
  const [nPonds, setNPonds] = useState(DEFAULT_N_PONDS);
  const [salePricePerKg, setSalePricePerKg] = useState(20);
  const [panelSelection, setPanelSelection] = useState<PanelSelection | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [inputsPanelOpen, setInputsPanelOpen] = useState(false);

  // Reactive TEA computation — only re-runs when pond count changes
  const result = useMemo(() => {
    if (nPonds === DEFAULT_N_PONDS) return runTEA();
    const desired = backCalcDesiredOutput(nPonds);
    return runTEA({ desired_output_tons_yr: desired });
  }, [nPonds]);

  // Initialize sale price to MBSP/1000 on first result
  const initialMbspPerKg = useMemo(() => Math.round(result.financials.mbsp / 1000), []);

  // Use initialMbspPerKg as default if salePricePerKg is still at placeholder
  const effectiveSalePrice = salePricePerKg;

  const handleCellClick = useCallback((sectionId: string, costCategory: string) => {
    setPanelSelection({ sectionId, costCategory });
    setPanelOpen(true);
  }, []);

  const togglePanel = useCallback(() => {
    setPanelOpen((prev) => !prev);
  }, []);

  const toggleInputsPanel = useCallback(() => {
    setInputsPanelOpen((prev) => !prev);
  }, []);

  // Clamp slider value to valid range and ensure step of 2
  const handlePondChange = useCallback((value: number[]) => {
    const v = Math.round(value[0] / 2) * 2;
    setNPonds(Math.max(10, Math.min(100, v)));
  }, []);

  return (
    <div className="space-y-12">
      {/* ── Top Section: Sliders + Facility Animation Placeholder ── */}
      <section>
        {/* Mobile horizontal sliders */}
        <div className="md:hidden space-y-4 mb-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Facility Size</span>
              <span className="text-xs font-mono font-semibold">{nPonds} ponds</span>
            </div>
            <Slider
              value={[nPonds]}
              onValueChange={handlePondChange}
              min={10}
              max={100}
              step={2}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Sale Price</span>
              <span className="text-xs font-mono font-semibold">${effectiveSalePrice}/kg</span>
            </div>
            <Slider
              value={[effectiveSalePrice]}
              onValueChange={(v) => setSalePricePerKg(v[0])}
              min={1}
              max={100}
              step={1}
            />
          </div>
        </div>

        {/* Desktop: vertical sliders + animation placeholder */}
        <div className="hidden md:flex gap-6" style={{ minHeight: 320 }}>
          {/* Vertical sliders column */}
          <div className="flex gap-6 shrink-0">
            {/* Facility size slider */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                Facility Size
              </span>
              <Slider
                orientation="vertical"
                value={[nPonds]}
                onValueChange={handlePondChange}
                min={10}
                max={100}
                step={2}
                className="h-52"
              />
              <span className="text-xs font-mono font-semibold">{nPonds} ponds</span>
            </div>

            {/* Sale price slider */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                Sale Price
              </span>
              <Slider
                orientation="vertical"
                value={[effectiveSalePrice]}
                onValueChange={(v) => setSalePricePerKg(v[0])}
                min={1}
                max={100}
                step={1}
                className="h-52"
              />
              <span className="text-xs font-mono font-semibold">${effectiveSalePrice}/kg</span>
            </div>
          </div>

          {/* Facility animation placeholder */}
          <div className="flex-1 rounded-xl border border-dashed flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-sm font-medium">Facility Animation</p>
              <p className="text-xs mt-1">Coming Soon</p>
            </div>
          </div>
        </div>

        {/* Mobile animation placeholder */}
        <div className="md:hidden rounded-xl border border-dashed flex items-center justify-center text-muted-foreground" style={{ height: 200 }}>
          <div className="text-center">
            <p className="text-sm font-medium">Facility Animation</p>
            <p className="text-xs mt-1">Coming Soon</p>
          </div>
        </div>
      </section>

      {/* ── System Summary KPI Cards ── */}
      <SystemSummaryCards result={result} />

      {/* ── Financial Overview: MBSP Breakdown + Lifetime Value Chart ── */}
      <section>
        <h2 className="text-xl font-medium tracking-tight mb-4">
          Financial Overview
        </h2>
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              MBSP Breakdown by Category
            </h3>
            <MBSPBreakdownTable result={result} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              10-Year Lifetime Value (at ${effectiveSalePrice}/kg)
            </h3>
            <LifetimeValueChart result={result} salePricePerKg={effectiveSalePrice} />
          </div>
        </div>
      </section>

      {/* ── Sections Overview (interactive) ── */}
      <section>
        <h2 className="text-xl font-medium tracking-tight mb-1">
          Sections Overview
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Click any cell to view detailed breakdown
        </p>
        <SectionsOverviewTable result={result} onCellClick={handleCellClick} />
      </section>

      {/* ── Cost Contribution by Section ── */}
      <section>
        <h2 className="text-xl font-medium tracking-tight mb-4">
          Cost Contribution by Section
        </h2>
        <CostContributionTable result={result} />
      </section>

      {/* ── Revenue Sensitivity ── */}
      <section>
        <h2 className="text-xl font-medium tracking-tight mb-4">
          Revenue Sensitivity
        </h2>
        <SensitivityTable result={result} />
      </section>

      {/* ── Cash Flow Schedule ── */}
      <section>
        <h2 className="text-xl font-medium tracking-tight mb-4">
          Annual Cash Flow Schedule
        </h2>
        <CashFlowTable result={result} />
      </section>

      {/* ── Slide-in panels ── */}
      <InputCostsPanel
        isOpen={inputsPanelOpen}
        result={result}
        onToggle={toggleInputsPanel}
      />
      <SectionDetailPanel
        selection={panelSelection}
        isOpen={panelOpen}
        result={result}
        onToggle={togglePanel}
      />
    </div>
  );
}
