"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { TEAResult } from "@/lib/technoeconomics/open-pond";
import type { SectionCost } from "@/lib/technoeconomics/types";
import { fmtDollarsLong, fmtNumber, fmtPercent } from "./formatters";
import installationFactorsJson from "@/lib/technoeconomics/open-pond/data/installation-factors.json";

interface FactorEntry { value: number }
interface InstallFactorSection {
  has_installation_factors: boolean;
  installation?: Record<string, FactorEntry>;
  indirect?: Record<string, FactorEntry>;
  other?: Record<string, FactorEntry>;
}
const INSTALL_FACTORS = installationFactorsJson as unknown as Record<string, InstallFactorSection>;

export interface PanelSelection {
  sectionId: string; // e.g. "inputs", "harvesting", or "all"
  costCategory: string; // e.g. "energy", "equipment_purchase", or "all"
}

const SECTION_ORDER = ["inputs", "inoculum", "biomass", "harvesting", "drying"];

const SECTION_LABELS: Record<string, string> = {
  inputs: "Inputs (Water & Nutrients)",
  inoculum: "Inoculum (Scaling Ponds)",
  biomass: "Biomass (Growth Ponds)",
  harvesting: "Harvesting (Dewatering)",
  drying: "Drying (Final Processing)",
  land: "Land",
  all: "All Sections",
};

const CATEGORY_LABELS: Record<string, string> = {
  equipment_purchase: "Equipment Purchase",
  install_engr_other: "Installation, Engineering & Other",
  capital_cost: "Total CAPEX",
  materials_cost: "Materials / Inputs",
  energy_cost: "Energy",
  maintenance_cost: "Maintenance",
  labor_cost: "Labor",
  operating_cost: "Total OPEX",
  all: "All Cost Categories",
};

// When showing "all categories" for a section, show these individually
// (excludes aggregates capital_cost / operating_cost whose parts are shown)
const CATEGORY_ORDER = [
  "equipment_purchase",
  "install_engr_other",
  "materials_cost",
  "energy_cost",
  "maintenance_cost",
  "labor_cost",
];

const FACTOR_LABELS: Record<string, string> = {
  process_piping: "Process Piping",
  instrumentation: "Instrumentation",
  insulation: "Insulation",
  electrical: "Electrical",
  buildings: "Buildings",
  yard_improvement: "Yard Improvement",
  auxiliary_facilities: "Auxiliary Facilities",
  installation: "Installation",
  engineering: "Engineering",
  construction: "Construction",
  contractors_fee: "Contractor\u2019s Fee",
  contingency: "Contingency",
};

const ENERGY_UNIT_LABELS: Record<string, string> = {
  electricity: "kWh",
  diesel: "L",
  natural_gas: "cu ft",
};

// ── Render functions ────────────────────────────────────────────

function renderEquipmentTable(section: SectionCost): ReactNode {
  if (section.equipment.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-2">No equipment in this section.</p>;
  }
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1.5 pr-3 font-medium text-xs">ID</th>
          <th className="py-1.5 pr-3 font-medium text-xs">Name</th>
          <th className="py-1.5 pr-3 font-medium text-xs">Type</th>
          <th className="py-1.5 pr-3 font-medium text-xs text-right">Unit Cost</th>
          <th className="py-1.5 pr-3 font-medium text-xs text-right">Units</th>
          <th className="py-1.5 font-medium text-xs text-right">Total</th>
        </tr>
      </thead>
      <tbody className="font-mono text-xs">
        {section.equipment.map((eq) => (
          <tr key={eq.id} className="border-b border-dashed">
            <td className="py-1.5 pr-3 font-sans text-xs text-muted-foreground">{eq.id}</td>
            <td className="py-1.5 pr-3 font-sans text-sm">{eq.name}</td>
            <td className="py-1.5 pr-3 font-sans text-xs text-muted-foreground">{eq.type}</td>
            <td className="py-1.5 pr-3 text-right">{fmtDollarsLong(eq.unit_cost)}</td>
            <td className="py-1.5 pr-3 text-right">{eq.units_required}</td>
            <td className="py-1.5 text-right">{fmtDollarsLong(eq.total_purchase_cost)}</td>
          </tr>
        ))}
        <tr className="border-t-2 font-semibold">
          <td colSpan={5} className="py-2 pr-3 font-sans text-sm">Total Equipment Purchase</td>
          <td className="py-2 text-right">{fmtDollarsLong(section.equipment_purchase)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function renderInstallationTable(section: SectionCost): ReactNode {
  const bd = section.installation_breakdown;
  if (bd.grand_total === 0) {
    return (
      <p className="text-xs text-muted-foreground italic py-2">
        NREL costs are fully installed — no additional installation factors apply.
      </p>
    );
  }

  // Look up original factor rates for the multiplier column
  const factorData = INSTALL_FACTORS[section.section_id];
  const getRate = (tier: "installation" | "indirect" | "other", key: string): number | null => {
    const tierData = factorData?.[tier];
    return tierData?.[key]?.value ?? null;
  };

  const renderFactorRows = (
    factors: Record<string, number>,
    tier: "installation" | "indirect" | "other",
  ) =>
    Object.entries(factors).map(([key, val]) => {
      const rate = getRate(tier, key);
      return (
        <tr key={key} className="border-b border-dashed">
          <td className="py-1 pr-3 font-sans text-sm pl-4">{FACTOR_LABELS[key] ?? key}</td>
          <td className="py-1 pr-3 text-right text-muted-foreground">
            {rate !== null ? fmtPercent(rate) : "—"}
          </td>
          <td className="py-1 text-right">{fmtDollarsLong(val)}</td>
        </tr>
      );
    });

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1 pr-3 font-medium text-xs">Factor</th>
          <th className="py-1 pr-3 font-medium text-xs text-right">Multiplier</th>
          <th className="py-1 font-medium text-xs text-right">Amount</th>
        </tr>
      </thead>
      <tbody className="font-mono text-xs">
        {/* Tier 1: Installation — multiplied against equipment purchase */}
        <tr><td colSpan={3} className="pt-0.5 pb-0.5 font-sans text-[10px] font-medium text-muted-foreground tracking-wider">Installation (× equipment purchase)</td></tr>
        {renderFactorRows(bd.installation_factors, "installation")}
        <tr className="border-t font-semibold">
          <td colSpan={2} className="py-1 pr-3 font-sans text-sm">Subtotal</td>
          <td className="py-1 text-right">{fmtDollarsLong(bd.installation_total)}</td>
        </tr>
        {/* Tier 2: Indirect — multiplied against installation total */}
        <tr><td colSpan={3} className="pt-2 pb-0.5 font-sans text-[10px] font-medium text-muted-foreground tracking-wider">Indirect (× installation subtotal)</td></tr>
        {renderFactorRows(bd.indirect_factors, "indirect")}
        <tr className="border-t font-semibold">
          <td colSpan={2} className="py-1 pr-3 font-sans text-sm">Subtotal</td>
          <td className="py-1 text-right">{fmtDollarsLong(bd.indirect_total)}</td>
        </tr>
        {/* Tier 3: Other — multiplied against (installation + indirect) */}
        <tr><td colSpan={3} className="pt-2 pb-0.5 font-sans text-[10px] font-medium text-muted-foreground tracking-wider">Other (× install + indirect)</td></tr>
        {renderFactorRows(bd.other_factors, "other")}
        <tr className="border-t font-semibold">
          <td colSpan={2} className="py-1 pr-3 font-sans text-sm">Subtotal</td>
          <td className="py-1 text-right">{fmtDollarsLong(bd.other_total)}</td>
        </tr>
        {/* Grand total */}
        <tr className="border-t-2 font-semibold">
          <td colSpan={2} className="py-1.5 pr-3 font-sans text-sm">Grand Total</td>
          <td className="py-1.5 text-right">{fmtDollarsLong(bd.grand_total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function renderMaterialsTable(section: SectionCost, result: TEAResult): ReactNode {
  if (section.section_id !== "inputs" || section.materials_cost === 0) {
    return <p className="text-xs text-muted-foreground italic py-2">No material costs in this section.</p>;
  }

  const c = result.config;
  const n = result.nutrients;
  const items = [
    { name: "CO\u2082", qty: n.co2_tons_yr, unit: "tons/yr", unitCost: c.co2_per_ton, cost: n.co2_tons_yr * c.co2_per_ton },
    { name: "KNO\u2083", qty: n.kno3_tons_yr, unit: "tons/yr", unitCost: c.kno3_per_ton, cost: n.kno3_tons_yr * c.kno3_per_ton },
    { name: "DAP", qty: n.dap_tons_yr, unit: "tons/yr", unitCost: c.dap_per_ton, cost: n.dap_tons_yr * c.dap_per_ton },
    { name: "Micronutrients", qty: n.micro_tons_yr, unit: "tons/yr", unitCost: c.micronutrient_per_ton, cost: n.micro_tons_yr * c.micronutrient_per_ton },
    { name: "Water", qty: n.water_m3_yr, unit: "m\u00B3/yr", unitCost: c.water_per_m3, cost: n.water_m3_yr * c.water_per_m3 },
  ];

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1.5 pr-3 font-medium text-xs">Material</th>
          <th className="py-1.5 pr-3 font-medium text-xs text-right">Annual Qty</th>
          <th className="py-1.5 pr-3 font-medium text-xs text-right">Unit Cost</th>
          <th className="py-1.5 font-medium text-xs text-right">Annual Cost</th>
        </tr>
      </thead>
      <tbody className="font-mono text-xs">
        {items.map((it) => (
          <tr key={it.name} className="border-b border-dashed">
            <td className="py-1.5 pr-3 font-sans text-sm">{it.name}</td>
            <td className="py-1.5 pr-3 text-right whitespace-nowrap">{fmtNumber(it.qty, 1)} {it.unit}</td>
            <td className="py-1.5 pr-3 text-right">{fmtDollarsLong(it.unitCost)}</td>
            <td className="py-1.5 text-right">{fmtDollarsLong(it.cost)}</td>
          </tr>
        ))}
        <tr className="border-t-2 font-semibold">
          <td colSpan={3} className="py-2 pr-3 font-sans text-sm">Total Materials</td>
          <td className="py-2 text-right">{fmtDollarsLong(section.materials_cost)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function renderEnergyTable(section: SectionCost): ReactNode {
  const items = section.equipment.filter((e) => e.annual_energy_cost > 0);
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-2">No energy costs in this section.</p>;
  }
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1.5 pr-3 font-medium text-xs">Equipment</th>
          <th className="py-1.5 pr-3 font-medium text-xs">Type</th>
          <th className="py-1.5 pr-3 font-medium text-xs text-right">Annual Units</th>
          <th className="py-1.5 font-medium text-xs text-right">Annual Cost</th>
        </tr>
      </thead>
      <tbody className="font-mono text-xs">
        {items.map((eq) => (
          <tr key={eq.id} className="border-b border-dashed">
            <td className="py-1.5 pr-3 font-sans text-sm">{eq.name}</td>
            <td className="py-1.5 pr-3 font-sans text-xs text-muted-foreground capitalize">{eq.energy_type.replace("_", " ")}</td>
            <td className="py-1.5 pr-3 text-right whitespace-nowrap">{fmtNumber(eq.annual_energy_units, 0)} {ENERGY_UNIT_LABELS[eq.energy_type] ?? ""}</td>
            <td className="py-1.5 text-right">{fmtDollarsLong(eq.annual_energy_cost)}</td>
          </tr>
        ))}
        <tr className="border-t-2 font-semibold">
          <td colSpan={3} className="py-2 pr-3 font-sans text-sm">Total Energy</td>
          <td className="py-2 text-right">{fmtDollarsLong(section.energy_cost)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function renderMaintenanceTable(section: SectionCost): ReactNode {
  const items = section.equipment.filter((e) => e.annual_maintenance_cost > 0);
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-2">No maintenance costs in this section.</p>;
  }
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1.5 pr-3 font-medium text-xs">Equipment</th>
          <th className="py-1.5 pr-3 font-medium text-xs text-right">Rate</th>
          <th className="py-1.5 font-medium text-xs text-right">Annual Cost</th>
        </tr>
      </thead>
      <tbody className="font-mono text-xs">
        {items.map((eq) => (
          <tr key={eq.id} className="border-b border-dashed">
            <td className="py-1.5 pr-3 font-sans text-sm">{eq.name}</td>
            <td className="py-1.5 pr-3 text-right">{fmtPercent(eq.maintenance_rate)}</td>
            <td className="py-1.5 text-right">{fmtDollarsLong(eq.annual_maintenance_cost)}</td>
          </tr>
        ))}
        <tr className="border-t-2 font-semibold">
          <td colSpan={2} className="py-2 pr-3 font-sans text-sm">Total Maintenance</td>
          <td className="py-2 text-right">{fmtDollarsLong(section.maintenance_cost)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function renderLaborTable(section: SectionCost, result: TEAResult): ReactNode {
  const sectionKey = section.section_id as keyof typeof result.config.labor;
  const roles = result.config.labor[sectionKey];
  if (!roles || roles.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-2">No labor costs in this section.</p>;
  }
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1.5 pr-3 font-medium text-xs">Role</th>
          <th className="py-1.5 pr-3 font-medium text-xs text-right">Headcount</th>
          <th className="py-1.5 pr-3 font-medium text-xs text-right">Annual Salary</th>
          <th className="py-1.5 font-medium text-xs text-right">Total</th>
        </tr>
      </thead>
      <tbody className="font-mono text-xs">
        {roles.map((r) => (
          <tr key={r.title} className="border-b border-dashed">
            <td className="py-1.5 pr-3 font-sans text-sm">{r.title}</td>
            <td className="py-1.5 pr-3 text-right">{r.headcount}</td>
            <td className="py-1.5 pr-3 text-right">{fmtDollarsLong(r.annual_salary)}</td>
            <td className="py-1.5 text-right">{fmtDollarsLong(r.headcount * r.annual_salary)}</td>
          </tr>
        ))}
        <tr className="border-t-2 font-semibold">
          <td colSpan={3} className="py-2 pr-3 font-sans text-sm">Total Labor</td>
          <td className="py-2 text-right">{fmtDollarsLong(section.labor_cost)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function renderOperatingTable(section: SectionCost): ReactNode {
  const rows = [
    { label: "Materials / Inputs", value: section.materials_cost },
    { label: "Energy", value: section.energy_cost },
    { label: "Maintenance", value: section.maintenance_cost },
    { label: "Labor", value: section.labor_cost },
  ];
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1.5 pr-3 font-medium text-xs">Category</th>
          <th className="py-1.5 font-medium text-xs text-right">Annual Cost</th>
        </tr>
      </thead>
      <tbody className="font-mono text-xs">
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-dashed">
            <td className="py-1.5 pr-3 font-sans text-sm">{r.label}</td>
            <td className="py-1.5 text-right">{fmtDollarsLong(r.value)}</td>
          </tr>
        ))}
        <tr className="border-t-2 font-semibold">
          <td className="py-2 pr-3 font-sans text-sm">Total OPEX</td>
          <td className="py-2 text-right">{fmtDollarsLong(section.operating_cost)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function renderCapitalTable(section: SectionCost): ReactNode {
  return (
    <div className="space-y-4">
      <div>
        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Equipment</h5>
        {renderEquipmentTable(section)}
      </div>
      <div>
        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Installation, Engineering &amp; Other</h5>
        {renderInstallationTable(section)}
      </div>
      <table className="w-full text-sm border-collapse">
        <tbody className="font-mono text-xs">
          <tr className="border-t-2 font-semibold">
            <td className="py-2 pr-3 font-sans text-sm">Total CAPEX</td>
            <td className="py-2 text-right">{fmtDollarsLong(section.capital_cost)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function renderLandTable(result: TEAResult): ReactNode {
  const c = result.config;
  const rows = [
    { label: "Pond Footprint", value: `${fmtNumber(result.land_pond_footprint_acres, 1)} acres` },
    { label: "Land Buffer", value: fmtPercent(c.land_buffer_fraction) },
    { label: "Total Land Required", value: `${fmtNumber(result.land_total_acres, 0)} acres` },
    { label: "Price per Acre", value: fmtDollarsLong(c.land_price_per_acre) },
  ];
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1.5 pr-3 font-medium text-xs">Parameter</th>
          <th className="py-1.5 font-medium text-xs text-right">Value</th>
        </tr>
      </thead>
      <tbody className="font-mono text-xs">
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-dashed">
            <td className="py-1.5 pr-3 font-sans text-sm">{r.label}</td>
            <td className="py-1.5 text-right whitespace-nowrap">{r.value}</td>
          </tr>
        ))}
        <tr className="border-t-2 font-semibold">
          <td className="py-2 pr-3 font-sans text-sm">Total Land Cost</td>
          <td className="py-2 text-right">{fmtDollarsLong(result.land_cost)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ── Category → renderer mapping ─────────────────────────────────

function renderCategory(category: string, section: SectionCost, result: TEAResult): ReactNode {
  switch (category) {
    case "equipment_purchase": return renderEquipmentTable(section);
    case "install_engr_other": return renderInstallationTable(section);
    case "capital_cost": return renderCapitalTable(section);
    case "materials_cost": return renderMaterialsTable(section, result);
    case "energy_cost": return renderEnergyTable(section);
    case "maintenance_cost": return renderMaintenanceTable(section);
    case "labor_cost": return renderLaborTable(section, result);
    case "operating_cost": return renderOperatingTable(section);
    default: return null;
  }
}

// ── Component ───────────────────────────────────────────────────

interface Props {
  selection: PanelSelection | null;
  isOpen: boolean;
  result: TEAResult;
  onToggle: () => void;
}

export function SectionDetailPanel({ selection, isOpen, result, onToggle }: Props) {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onToggle();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onToggle]);

  // Scroll to highlighted section when a specific cell is clicked
  useEffect(() => {
    if (selection && selection.sectionId !== "all" && selection.costCategory !== "all") {
      const timer = setTimeout(() => {
        const el = sectionRefs.current[selection.sectionId];
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [selection]);

  const sectionLabel = selection ? (SECTION_LABELS[selection.sectionId] ?? selection.sectionId) : "";
  const categoryLabel = selection ? (CATEGORY_LABELS[selection.costCategory] ?? selection.costCategory) : "";

  const title = selection
    ? selection.sectionId === "all"
      ? categoryLabel
      : selection.costCategory === "all"
        ? sectionLabel
        : `${sectionLabel} — ${categoryLabel}`
    : "Section Details";

  // ── Build panel body content ──
  let body: ReactNode = null;

  if (!selection) {
    body = (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Click a cell in the Sections Overview table to view its detailed breakdown here.
        </p>
      </div>
    );
  } else if (selection.sectionId !== "all" && selection.costCategory === "all") {
    // Case 1: One section, all categories
    const section = result.sections[selection.sectionId];
    body = (
      <div className="space-y-8">
        {CATEGORY_ORDER.map((cat) => (
          <div key={cat}>
            <h4 className="text-sm font-medium mb-3">{CATEGORY_LABELS[cat]}</h4>
            {renderCategory(cat, section, result)}
          </div>
        ))}
      </div>
    );
  } else if (selection.sectionId === "all") {
    // Case 2: All sections, one category
    const isCapital = selection.costCategory === "capital_cost";
    body = (
      <div className="space-y-8">
        {SECTION_ORDER.map((sid) => {
          const section = result.sections[sid];
          return (
            <div key={sid}>
              <h4 className="text-sm font-medium mb-3">{SECTION_LABELS[sid]}</h4>
              {renderCategory(selection.costCategory, section, result)}
            </div>
          );
        })}
        {isCapital && (
          <div>
            <h4 className="text-sm font-medium mb-3">Land</h4>
            {renderLandTable(result)}
          </div>
        )}
      </div>
    );
  } else {
    // Case 3: Specific cell — show all sections for that category, highlight one
    const isCapital = selection.costCategory === "capital_cost";
    body = (
      <div className="space-y-8">
        {SECTION_ORDER.map((sid) => {
          const section = result.sections[sid];
          const isHighlighted = sid === selection.sectionId;
          return (
            <div
              key={sid}
              ref={(el) => { sectionRefs.current[sid] = el; }}
              className={
                isHighlighted
                  ? "ring-2 ring-primary/40 rounded-lg p-3 bg-primary/5 transition-all duration-500"
                  : "p-3"
              }
            >
              <h4 className="text-sm font-medium mb-3">{SECTION_LABELS[sid]}</h4>
              {renderCategory(selection.costCategory, section, result)}
            </div>
          );
        })}
        {isCapital && (
          <div
            ref={(el) => { sectionRefs.current["land"] = el; }}
            className={
              selection.sectionId === "land"
                ? "ring-2 ring-primary/40 rounded-lg p-3 bg-primary/5 transition-all duration-500"
                : "p-3"
            }
          >
            <h4 className="text-sm font-medium mb-3">Land</h4>
            {renderLandTable(result)}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Backdrop — only when open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={onToggle}
        />
      )}

      {/* Panel + attached tab — both slide together */}
      <div
        className={`fixed inset-y-0 right-0 z-50 transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-[calc(100%-2rem)]"
        }`}
        style={{ width: "min(50vw, 640px)" }}
      >
        {/* Tab — attached to left edge of panel */}
        <button
          onClick={onToggle}
          className="absolute left-0 top-1/2 -translate-x-[calc(100%-1px)] -translate-y-1/2 z-[51] flex items-center justify-center bg-background border border-r-0 rounded-l-md shadow-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          style={{ writingMode: "vertical-rl", padding: "12px 4px" }}
          aria-label={isOpen ? "Close economic details" : "Open economic details"}
        >
          <span className="text-xs font-medium tracking-wide whitespace-nowrap">
            Economic Details
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`mt-1 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Panel body */}
        <div ref={scrollContainerRef} className="h-full w-full bg-background border-l shadow-xl overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-4">
            <h3 className="text-lg font-medium tracking-tight pr-4">{title}</h3>
            <button
              onClick={onToggle}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close panel"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-6">
            {body}
          </div>
        </div>
      </div>
    </>
  );
}
