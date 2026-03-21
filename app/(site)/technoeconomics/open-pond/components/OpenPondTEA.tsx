"use client";

import { useState, useMemo, useCallback } from "react";
import { runTEA, DEFAULT_TEA_CONFIG } from "@/lib/technoeconomics/open-pond";
import { runTEAFromDiagram, type EnrichedDiagram } from "@/lib/technoeconomics/open-pond/engine-diagram";
import { ACRES_TO_M2 } from "@/lib/technoeconomics/common/constants";
import { Slider } from "@/components/ui/slider";
import { SectionsOverviewTable } from "./SectionsOverviewTable";
import { SensitivityTable } from "./SensitivityTable";
import { FinancialOverviewTable } from "./FinancialOverviewTable";
import { CostContributionTable } from "./CostContributionTable";
import { LifetimeValueChart } from "./LifetimeValueChart";
import { SectionDetailPanel, type PanelSelection } from "./SectionDetailPanel";
import { InputCostsPanel } from "./InputCostsPanel";
import { DiagramView } from "./DiagramView";
// EquipmentDetailPopup removed — equipment detail now shown in SectionDetailPanel
import diagramData from "../../../../../public/diagrams/open-raceway-pond_simple.json";

// ── Back-calculate desired_output_tons_yr from a target n_ponds ────
// Inverts geometry.ts: n_ponds = ceil(V_required / V_pond), grid = n_rows × 2
function backCalcDesiredOutput(targetPonds: number, density: number, growthRate: number): number {
  const cfg = DEFAULT_TEA_CONFIG;
  const A_pond_m2 = cfg.pond_size_acres * ACRES_TO_M2;
  const AR = cfg.pond_lw_ratio;
  const W = Math.sqrt(A_pond_m2 / AR);
  const L_total = W * AR;
  const SA = W * (L_total - W) + Math.PI * (W / 2) ** 2;
  const V_pond_m3 = SA * cfg.pond_depth_m;

  const BM_rate = density * growthRate;
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
const DEFAULT_DENSITY = DEFAULT_TEA_CONFIG.density_at_harvest_g_L;
const DEFAULT_GROWTH_RATE = DEFAULT_TEA_CONFIG.effective_growth_rate_per_day;

export default function OpenPondTEA() {
  const [density, setDensity] = useState(DEFAULT_DENSITY);
  const [growthRate, setGrowthRate] = useState(DEFAULT_GROWTH_RATE);
  const [nPonds, setNPonds] = useState(DEFAULT_N_PONDS);
  const [salePricePerKg, setSalePricePerKg] = useState(20);
  const [panelSelection, setPanelSelection] = useState<PanelSelection | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [inputsPanelOpen, setInputsPanelOpen] = useState(false);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [selectedEquipmentNodeId, setSelectedEquipmentNodeId] = useState<string | null>(null);

  // Reactive TEA computation — re-runs when biological or facility params change
  const result = useMemo(() => {
    const overrides: Partial<typeof DEFAULT_TEA_CONFIG> = {};

    if (density !== DEFAULT_DENSITY) overrides.density_at_harvest_g_L = density;
    if (growthRate !== DEFAULT_GROWTH_RATE) overrides.effective_growth_rate_per_day = growthRate;
    if (nPonds !== DEFAULT_N_PONDS || density !== DEFAULT_DENSITY || growthRate !== DEFAULT_GROWTH_RATE) {
      overrides.desired_output_tons_yr = backCalcDesiredOutput(nPonds, density, growthRate);
    }

    const hasOverrides = Object.keys(overrides).length > 0;
    const diagram = diagramData as unknown as EnrichedDiagram;
    if (diagram.version && diagram.version >= 2) {
      return runTEAFromDiagram(diagram, hasOverrides ? overrides : undefined);
    }
    return hasOverrides ? runTEA(overrides) : runTEA();
  }, [nPonds, density, growthRate]);

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

  const handleHoverSection = useCallback((sectionId: string | null) => {
    setHoveredSection(sectionId);
  }, []);

  const handleDiagramClick = useCallback((sectionId: string) => {
    setSelectedEquipmentNodeId(null);
    handleCellClick(sectionId, "all");
  }, [handleCellClick]);

  const handleEquipmentClick = useCallback((nodeId: string) => {
    setSelectedEquipmentNodeId(nodeId);
    setPanelSelection({ sectionId: "all", costCategory: "equipment_detail", equipmentNodeId: nodeId });
    setPanelOpen(true);
  }, []);

  // Also handle equipment clicks from within the panel tables
  const handlePanelEquipmentClick = useCallback((sectionId: string, nodeId: string) => {
    setSelectedEquipmentNodeId(nodeId);
    setPanelSelection({ sectionId, costCategory: "equipment_detail", equipmentNodeId: nodeId });
  }, []);

  // Handle panel navigation (back/forward)
  const handlePanelSelectionChange = useCallback((sel: PanelSelection) => {
    setPanelSelection(sel);
    if (sel.costCategory === "equipment_detail" && sel.equipmentNodeId) {
      setSelectedEquipmentNodeId(sel.equipmentNodeId);
    } else {
      setSelectedEquipmentNodeId(null);
    }
  }, []);

  return (
    <div className="space-y-12">
      {/* ── Top Section: Sliders + Facility Animation Placeholder ── */}
      <section>
        {/* Mobile horizontal sliders */}
        <div className="md:hidden space-y-4 mb-4">
          {/* Biological sliders (green) */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-3">
            <div className="text-[10px] font-medium text-emerald-700 uppercase tracking-wide">Biological Parameters (at harvest)</div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-emerald-800">Density</span>
                <span className="text-xs font-mono font-semibold text-emerald-900">{density.toFixed(2)} g/L</span>
              </div>
              <Slider
                value={[density]}
                onValueChange={(v) => setDensity(Math.round(v[0] * 20) / 20)}
                min={0.2}
                max={1.0}
                step={0.05}
                className="[&_[role=slider]]:bg-emerald-600 [&_[data-orientation=horizontal]>span:first-child>span]:bg-emerald-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-emerald-800">Growth Rate</span>
                <span className="text-xs font-mono font-semibold text-emerald-900">{growthRate.toFixed(2)} /day</span>
              </div>
              <Slider
                value={[growthRate]}
                onValueChange={(v) => setGrowthRate(Math.round(v[0] * 100) / 100)}
                min={0.05}
                max={0.3}
                step={0.01}
                className="[&_[role=slider]]:bg-emerald-600 [&_[data-orientation=horizontal]>span:first-child>span]:bg-emerald-500"
              />
            </div>
          </div>
          {/* System sliders */}
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
            {/* ── Biological sliders (green) ── */}
            <div className="flex gap-4 rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 pt-1 pb-2">
              {/* Density at harvest */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-[11px] font-medium text-emerald-800 whitespace-nowrap">
                  Density
                </span>
                <Slider
                  orientation="vertical"
                  value={[density]}
                  onValueChange={(v) => setDensity(Math.round(v[0] * 20) / 20)}
                  min={0.2}
                  max={1.0}
                  step={0.05}
                  className="h-48 [&_[role=slider]]:bg-emerald-600 [&_[data-orientation=vertical]>span:first-child>span]:bg-emerald-500"
                />
                <span className="text-[10px] font-mono font-semibold text-emerald-900">{density.toFixed(2)} g/L</span>
              </div>

              {/* Growth rate at harvest */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-[11px] font-medium text-emerald-800 whitespace-nowrap">
                  Growth Rate
                </span>
                <Slider
                  orientation="vertical"
                  value={[growthRate]}
                  onValueChange={(v) => setGrowthRate(Math.round(v[0] * 100) / 100)}
                  min={0.05}
                  max={0.3}
                  step={0.01}
                  className="h-48 [&_[role=slider]]:bg-emerald-600 [&_[data-orientation=vertical]>span:first-child>span]:bg-emerald-500"
                />
                <span className="text-[10px] font-mono font-semibold text-emerald-900">{growthRate.toFixed(2)} /day</span>
              </div>

              {/* "at harvest" label */}
              <div className="flex items-end pb-1">
                <span className="text-[9px] text-emerald-600 font-medium" style={{ writingMode: "vertical-rl" }}>
                  at harvest
                </span>
              </div>
            </div>

            {/* ── System sliders ── */}
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

      {/* ── Financial Overview + Cost Contribution + Lifetime Value Chart ── */}
      <section>
        <h2 className="text-xl font-medium tracking-tight mb-4">
          Financial Overview
        </h2>
        <div className="flex flex-col lg:flex-row gap-4 items-stretch">
          <div className="lg:w-[20%] shrink-0">
            <FinancialOverviewTable result={result} />
          </div>
          <div className="lg:w-[30%] shrink-0">
            <CostContributionTable result={result} />
          </div>
          <div className="lg:w-[50%] min-h-[280px] relative">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              10-Year Lifetime Value (at ${effectiveSalePrice}/kg)
            </h3>
            <div className="absolute left-0 right-0 bottom-0" style={{ top: "1.75rem" }}>
              <LifetimeValueChart result={result} salePricePerKg={effectiveSalePrice} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Process Flow Diagram ── */}
      <section
        className="relative transition-[padding] duration-300 ease-out"
        style={{
          zIndex: panelOpen ? 45 : undefined,
          paddingRight: panelOpen ? "min(50vw, 640px)" : undefined,
        }}
      >
        <h2 className="text-xl font-medium tracking-tight mb-4">
          Process Flow <span className="text-xs font-normal text-muted-foreground">(click any equipment for detailed breakdown)</span>
        </h2>
        <DiagramView
          diagram={diagramData as React.ComponentProps<typeof DiagramView>["diagram"]}
          hoveredSection={hoveredSection}
          activeSection={panelOpen && panelSelection?.sectionId !== "all" ? panelSelection?.sectionId ?? null : null}
          activeEquipmentId={selectedEquipmentNodeId}
          onHoverSection={handleHoverSection}
          onSectionClick={handleDiagramClick}
          onEquipmentClick={handleEquipmentClick}
        />
      </section>

      {/* ── Sections Overview (interactive) ── */}
      <section
        className="relative transition-[padding] duration-300 ease-out"
        style={{
          zIndex: panelOpen ? 45 : undefined,
          paddingRight: panelOpen ? "min(50vw, 640px)" : undefined,
        }}
      >
        <h2 className="text-xl font-medium tracking-tight mb-4">
          Sections Overview <span className="text-xs font-normal text-muted-foreground">(click any cell for detailed breakdown)</span>
        </h2>
        <SectionsOverviewTable
          result={result}
          onCellClick={handleCellClick}
          hoveredSection={hoveredSection}
          activeSection={panelOpen ? panelSelection?.sectionId ?? null : null}
          activeEquipmentNodeId={panelOpen ? selectedEquipmentNodeId : null}
          onHoverSection={handleHoverSection}
          compact={panelOpen}
        />
      </section>

      {/* ── Revenue Sensitivity ── */}
      <section>
        <h2 className="text-xl font-medium tracking-tight mb-4">
          Revenue Sensitivity
        </h2>
        <SensitivityTable result={result} />
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
        onEquipmentClick={handlePanelEquipmentClick}
        onSelectionChange={handlePanelSelectionChange}
      />
    </div>
  );
}
