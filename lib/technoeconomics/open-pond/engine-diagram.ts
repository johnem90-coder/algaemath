// Diagram-driven TEA engine — reads an enriched diagram JSON and produces
// the same TEAResult as the original runTEA(). The diagram is the source of
// truth for equipment lists and section assignments.
//
// Usage: const result = runTEAFromDiagram(diagramData);
//        const result = runTEAFromDiagram(diagramData, { desired_output_tons_yr: 1200 });

import type { TEAConfig, TEAResult, SectionCost, EquipmentItem, InstallationBreakdown } from "../types";
import { computeLabor } from "../common/labor";
import { computeTEAPondGeometry } from "../common/geometry";
import { computeNutrientBalance } from "../common/nutrient-balance";
import { computeConstructionTimeline } from "../common/construction";
import { computeInstallationCost } from "../common/installation";
import {
  computeTaxRate,
  computeCashFlows,
  computeNPV,
  computeIRR,
  computeMBSP,
  computePaybackSimple,
  computePaybackDiscounted,
  computeSensitivityTable,
  computeMBSPBreakdown,
  computeMBSPCategoryBreakdown,
  type CashFlowParams,
} from "../common/financials";
import { computeCostRollup, computeResourceTotals } from "./outputs";
import { DEFAULT_TEA_CONFIG } from "./config";
import { detectSections, type DiagramNodeGeometry } from "../common/section-detection";
import { computeGlobalFlows, type StreamTypeId } from "../common/stream-types";
import { EQUIPMENT_TYPES, SIZING_FUNCTIONS, type SizingContext } from "../common/equipment-registry";

// ── Enriched Diagram Types ──────────────────────────────────────

export interface EnrichedDiagramNode extends DiagramNodeGeometry {
  data: DiagramNodeGeometry["data"] & {
    equipmentTypeId?: string;
    equipmentParams?: Record<string, number | string>;
  };
}

export interface EnrichedDiagramEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: {
    streamType?: StreamTypeId;
    /** Fraction of the stream's flow carried by this edge (0–1).
     *  Used when equipment has multiple outputs, e.g., a filter splitting
     *  culture into biomass-slurry (0.30) and filtrate-return (0.70).
     *  Defaults to 1.0 if not set. */
    splitFraction?: number;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface EnrichedDiagram {
  name: string;
  version?: number;
  nodes: EnrichedDiagramNode[];
  edges: EnrichedDiagramEdge[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// ── Section ID prefixes for equipment IDs ───────────────────────

const SECTION_PREFIX: Record<string, string> = {
  inputs: "INP",
  inoculum: "INO",
  biomass: "BIO",
  harvesting: "HAR",
  drying: "DRY",
};

// ── Helper: resolve incoming flows for a node ───────────────────

function resolveIncomingFlows(
  nodeId: string,
  edges: EnrichedDiagramEdge[],
  globalFlows: Map<StreamTypeId, number>,
): Map<StreamTypeId, number> {
  const flows = new Map<StreamTypeId, number>();
  for (const edge of edges) {
    if (edge.target === nodeId && edge.data?.streamType) {
      const streamType = edge.data.streamType;
      const baseRate = globalFlows.get(streamType) ?? 0;
      const fraction = edge.data.splitFraction ?? 1.0;
      flows.set(streamType, (flows.get(streamType) ?? 0) + baseRate * fraction);
    }
  }
  return flows;
}

function resolveOutgoingStreamTypes(
  nodeId: string,
  edges: EnrichedDiagramEdge[],
): StreamTypeId[] {
  const types: StreamTypeId[] = [];
  for (const edge of edges) {
    if (edge.source === nodeId && edge.data?.streamType) {
      types.push(edge.data.streamType);
    }
  }
  return types;
}

// ── Empty installation breakdown ────────────────────────────────

const EMPTY_INSTALLATION: InstallationBreakdown = {
  installation_factors: {}, installation_total: 0,
  indirect_factors: {}, indirect_total: 0,
  other_factors: {}, other_total: 0,
  grand_total: 0,
};

// ── Main engine function ────────────────────────────────────────

/**
 * Run the full TEA calculation driven by an enriched diagram.
 * Pure function — diagram + config in, TEAResult out.
 */
export function runTEAFromDiagram(
  diagram: EnrichedDiagram,
  configOverrides?: Partial<TEAConfig>,
): TEAResult {
  // 1. Merge config
  const config: TEAConfig = configOverrides
    ? { ...DEFAULT_TEA_CONFIG, ...configOverrides }
    : DEFAULT_TEA_CONFIG;

  // 2. Geometry
  const geometry = computeTEAPondGeometry(config);

  // 3. Nutrient balance
  const nutrients = computeNutrientBalance(config, geometry);

  // 4. Compute land acres + dynamic labor (needed before section processing)
  const land_pond_footprint_acres = Math.ceil(geometry.A_land_acres);
  const land_total_acres = Math.ceil(land_pond_footprint_acres * (1 + config.land_buffer_fraction));
  const dynamicLabor = computeLabor(geometry.n_ponds, land_total_acres);
  const configWithLabor: TEAConfig = { ...config, labor: dynamicLabor as TEAConfig["labor"] };

  // 5. Detect sections from diagram geometry
  const { sections: detectedSections, nodeToSection } = detectSections(diagram.nodes);

  // 5. Compute global flow rates
  const globalFlows = computeGlobalFlows(config, geometry, nutrients);

  // 6. Build equipment graph — filter to equipment nodes, group by section
  const equipmentNodes: EnrichedDiagramNode[] = [];
  const sectionEquipment = new Map<string, EnrichedDiagramNode[]>();

  for (const node of diagram.nodes) {
    if (!node.data.equipmentTypeId) continue;
    equipmentNodes.push(node);
    const sid = nodeToSection.get(node.id);
    if (sid) {
      const list = sectionEquipment.get(sid) ?? [];
      list.push(node);
      sectionEquipment.set(sid, list);
    }
  }

  // 7. Size equipment for each section
  const sections: Record<string, SectionCost> = {};

  // Process sections in standard order
  const sectionOrder = ["inputs", "inoculum", "biomass", "harvesting", "drying"];
  // Also include any sections found in diagram but not in standard order
  for (const sec of detectedSections) {
    if (!sectionOrder.includes(sec.sectionId)) {
      sectionOrder.push(sec.sectionId);
    }
  }

  for (const sectionId of sectionOrder) {
    const nodes = sectionEquipment.get(sectionId) ?? [];
    const prefix = SECTION_PREFIX[sectionId] ?? sectionId.toUpperCase().slice(0, 3);
    const sizedEquipment: EquipmentItem[] = [];
    const usedTypeIds: string[] = [];

    // Sort nodes by Y position (top to bottom) for stable ordering
    const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);

    for (let i = 0; i < sortedNodes.length; i++) {
      const node = sortedNodes[i];
      const typeId = node.data.equipmentTypeId!;
      const entry = EQUIPMENT_TYPES[typeId];
      const sizeFn = SIZING_FUNCTIONS[typeId];

      if (!entry || !sizeFn) {
        console.warn(`Unknown equipment type: ${typeId} on node ${node.id}`);
        continue;
      }

      const equipmentId = `${prefix}-${String(i + 1).padStart(2, "0")}`;
      const incomingFlows = resolveIncomingFlows(node.id, diagram.edges, globalFlows);
      const outgoingStreamTypes = resolveOutgoingStreamTypes(node.id, diagram.edges);

      const ctx: SizingContext = {
        config,
        geometry,
        nutrients,
        incomingFlows,
        outgoingStreamTypes,
        nodeLabel: node.data.label || entry.name,
        equipmentId,
        equipmentParams: node.data.equipmentParams,
        sectionId,
        upstreamEquipment: sizedEquipment,
      };

      const item = sizeFn(entry, ctx);
      item.diagramNodeId = node.id;
      sizedEquipment.push(item);
      usedTypeIds.push(typeId);
    }

    // Aggregate section costs
    const equipment_purchase = sizedEquipment.reduce((s, e) => s + e.total_purchase_cost, 0);

    // Installation factors — check if any equipment in this section has installation factors
    const hasInstallation = usedTypeIds.some((tid) => EQUIPMENT_TYPES[tid]?.hasInstallationFactors);

    let installation_breakdown: InstallationBreakdown;
    if (hasInstallation) {
      installation_breakdown = computeInstallationCost(equipment_purchase, sectionId, geometry.n_ponds);
    } else {
      installation_breakdown = EMPTY_INSTALLATION;
    }

    // Materials cost — sum from material-source equipment items (their annual_energy_cost
    // stores the annual procurement cost). Non-source equipment energy costs are separate.
    let materials_cost = 0;
    let energy_cost = 0;
    for (const eq of sizedEquipment) {
      const tid = usedTypeIds[sizedEquipment.indexOf(eq)];
      if (tid === "material-source") {
        materials_cost += eq.annual_energy_cost;
      } else {
        energy_cost += eq.annual_energy_cost;
      }
    }
    const maintenance_cost = sizedEquipment.reduce((s, e) => s + e.annual_maintenance_cost, 0);

    // Labor from config
    const laborRoles = (dynamicLabor as Record<string, import("../types").LaborRole[]>)[sectionId] ?? [];
    const labor_cost = laborRoles.reduce((s, r) => s + r.headcount * r.annual_salary, 0);

    const operating_cost = materials_cost + energy_cost + maintenance_cost + labor_cost;

    // Section name from detected sections or fallback
    const sectionInfo = detectedSections.find((s) => s.sectionId === sectionId);
    const section_name = sectionInfo
      ? sectionId.charAt(0).toUpperCase() + sectionId.slice(1)
      : sectionId;

    sections[sectionId] = {
      section_id: sectionId,
      section_name,
      capital_cost: equipment_purchase + installation_breakdown.grand_total,
      equipment_purchase,
      install_engr_other: installation_breakdown.grand_total,
      installation_breakdown,
      operating_cost,
      materials_cost,
      energy_cost,
      maintenance_cost,
      labor_cost,
      equipment: sizedEquipment,
    };
  }

  // 8. Land as a proper section (land_pond_footprint_acres and land_total_acres computed above)
  const land_cost = land_total_acres * config.land_price_per_acre;
  const land_maintenance = land_cost * config.land_maintenance_rate;
  const land_labor_cost = dynamicLabor.land.reduce((s, r) => s + r.headcount * r.annual_salary, 0);
  sections.land = {
    section_id: "land", section_name: "Land",
    capital_cost: land_cost, equipment_purchase: land_cost,
    install_engr_other: 0,
    installation_breakdown: EMPTY_INSTALLATION,
    operating_cost: land_maintenance + land_labor_cost,
    materials_cost: 0, energy_cost: 0,
    maintenance_cost: land_maintenance, labor_cost: land_labor_cost,
    equipment: [{
      id: "LND-01", name: `Land (${land_total_acres} acres)`, type: "Real Estate",
      function: `${land_pond_footprint_acres} acre footprint + ${Math.round(config.land_buffer_fraction * 100)}% buffer`,
      unit_cost: config.land_price_per_acre, units_required: land_total_acres,
      total_purchase_cost: land_cost,
      energy_type: "none", annual_energy_units: 0, annual_energy_cost: 0,
      maintenance_rate: config.land_maintenance_rate,
      annual_maintenance_cost: land_maintenance,
    }],
  };

  // 9. Cost rollup (includes land section now)
  const rollup = computeCostRollup(sections);
  const resources = computeResourceTotals(sections, nutrients);
  const total_capex_with_land = rollup.total_capex;

  // 10. Construction timeline
  const construction = computeConstructionTimeline(geometry.n_ponds, config);

  // 11. Financial analysis (identical to original engine)
  const tax_rate = computeTaxRate(config.federal_tax_rate, config.state_tax_rate);
  const overhead_annual = config.overhead_per_ton * geometry.Q_actual_tons_yr;
  const aoc = rollup.total_opex + overhead_annual;

  const financialParams: Omit<CashFlowParams, "sale_price"> = {
    total_capex: total_capex_with_land,
    annual_opex: aoc,
    q_actual: geometry.Q_actual_tons_yr,
    discount_rate: config.discount_rate,
    tax_rate,
    lifetime: config.unit_lifetime_yrs,
    depreciation_method: config.depreciation_method,
    working_capital_fraction: config.working_capital_fraction,
    salvage_value_fraction: config.salvage_value_fraction,
    construction,
    n_ponds: geometry.n_ponds,
  };

  const mbsp = computeMBSP(financialParams);
  const cash_flows = computeCashFlows({ ...financialParams, sale_price: mbsp });
  const npv = computeNPV(cash_flows);
  const irr = computeIRR(cash_flows);

  const tci = total_capex_with_land * (1 + config.working_capital_fraction);
  const steady_state_fcfs = cash_flows
    .filter((cf) => cf.year > 0 && cf.production_fraction >= 1)
    .map((cf) => cf.free_cash_flow);
  const avg_annual_fcf = steady_state_fcfs.length > 0
    ? steady_state_fcfs.reduce((s, v) => s + v, 0) / steady_state_fcfs.length
    : cash_flows.filter((cf) => cf.year > 0).map((cf) => cf.free_cash_flow).reduce((s, v) => s + v, 0) / (cash_flows.length - 1);
  const payback_simple = computePaybackSimple(tci, avg_annual_fcf);
  const payback_discounted = computePaybackDiscounted(cash_flows);

  const sensitivity = computeSensitivityTable(financialParams);
  const mbsp_by_section = computeMBSPBreakdown(sections, geometry.Q_actual_tons_yr, config.unit_lifetime_yrs, mbsp);
  const mbsp_by_category = computeMBSPCategoryBreakdown(
    total_capex_with_land, aoc, config.overhead_per_ton,
    geometry.Q_actual_tons_yr, config.unit_lifetime_yrs
  );

  const system_productivity = (geometry.Q_actual_tons_yr * 1e6) / (geometry.A_land_m2 * config.active_days_yr);

  return {
    n_ponds: geometry.n_ponds,
    actual_production_tons_yr: geometry.Q_actual_tons_yr,
    land_area_acres: geometry.A_land_acres,
    land_area_hectares: geometry.A_land_m2 / 10000,
    system_volume_m3: geometry.V_system_m3,
    system_productivity_g_m2_day: system_productivity,
    land_pond_footprint_acres,
    land_total_acres,
    land_cost,
    total_capex: total_capex_with_land,
    total_annual_opex: rollup.total_opex,
    total_annual_overhead: overhead_annual,
    total_annual_cost: aoc,
    sections,
    resources,
    geometry,
    nutrients,
    config: configWithLabor,
    construction,
    financials: {
      mbsp, npv, irr,
      payback_simple_years: payback_simple,
      payback_discounted_years: payback_discounted,
      discount_rate: config.discount_rate,
      tax_rate,
      depreciation_method: config.depreciation_method,
      unit_lifetime_years: config.unit_lifetime_yrs,
      cash_flows, sensitivity, mbsp_by_section, mbsp_by_category,
    },
  };
}
