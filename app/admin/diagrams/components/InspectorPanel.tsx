"use client";

import { useMemo, useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { ShapeNodeData } from "./nodes/RectangleNode";
import { EQUIPMENT_TYPES } from "@/lib/technoeconomics/common/equipment-registry";
import { STREAM_TYPES } from "@/lib/technoeconomics/common/stream-types";
import { detectSections } from "@/lib/technoeconomics/common/section-detection";
import { DEFAULT_TEA_CONFIG } from "@/lib/technoeconomics/open-pond/config";

// ── Filter split calculation ───────────────────────────────────────
// Given culture concentration and output slurry water content,
// compute what fraction of input volume becomes slurry vs filtrate.
function computeFilterSplit(outputWaterContentPct: number): { slurryFraction: number; filtrateFraction: number } {
  const C_in = DEFAULT_TEA_CONFIG.density_at_harvest_g_L; // g/L (e.g., 0.362)
  const waterFrac = outputWaterContentPct / 100; // e.g., 0.75
  const C_out = (1 - waterFrac) * 1000; // g/L (e.g., 250 g/L at 75% water)
  if (C_out <= 0 || C_in <= 0) return { slurryFraction: 0, filtrateFraction: 1 };
  const slurryFraction = Math.min(1, C_in / C_out);
  return { slurryFraction, filtrateFraction: 1 - slurryFraction };
}

// ── Types ──────────────────────────────────────────────────────────

interface Props {
  nodes: Node<ShapeNodeData>[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node<ShapeNodeData>[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  snapshot: () => void;
  addSection: () => void;
}

// ── Equipment type grouped by category ─────────────────────────────

interface GroupedType {
  category: string;
  types: { id: string; name: string }[];
}

function getGroupedEquipmentTypes(): GroupedType[] {
  const categoryOrder = ["source", "tank", "pump", "filter", "hopper", "mix-tank", "dryer", "storage", "pond"];
  const categoryLabels: Record<string, string> = {
    source: "Sources",
    tank: "Tanks",
    pump: "Pumps",
    filter: "Filters",
    hopper: "Hoppers",
    "mix-tank": "Mix Tanks",
    dryer: "Dryers",
    storage: "Storage",
    pond: "Ponds",
  };

  const groups = new Map<string, { id: string; name: string }[]>();
  for (const entry of Object.values(EQUIPMENT_TYPES)) {
    const list = groups.get(entry.category) ?? [];
    list.push({ id: entry.id, name: entry.name });
    groups.set(entry.category, list);
  }

  return categoryOrder
    .filter((cat) => groups.has(cat))
    .map((cat) => ({
      category: categoryLabels[cat] ?? cat,
      types: groups.get(cat)!,
    }));
}

// ── Component ──────────────────────────────────────────────────────

export default function InspectorPanel({ nodes, edges, setNodes, setEdges, snapshot, addSection }: Props) {
  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const selectedEdges = useMemo(() => edges.filter((e) => e.selected), [edges]);
  const groupedTypes = useMemo(getGroupedEquipmentTypes, []);

  const singleNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const singleEdge = selectedEdges.length === 1 && selectedNodes.length === 0 ? selectedEdges[0] : null;

  // Section detection
  const detectedSections = useMemo(() => {
    const mapped = nodes.map((n) => ({
      id: n.id,
      position: n.position,
      width: n.width ?? (typeof n.style?.width === "number" ? n.style.width : 180),
      height: n.height ?? (typeof n.style?.height === "number" ? n.style.height : 60),
      data: n.data,
    }));
    return detectSections(mapped);
  }, [nodes]);

  // Detect if the selected node is a section label ("X Section" pattern)
  const sectionLabelMatch = singleNode?.data.label.match(/^(.+?)\s+Section$/);
  const isSectionLabel = !!sectionLabelMatch;
  const currentSectionName = sectionLabelMatch?.[1] ?? "";
  const currentSectionId = currentSectionName.toLowerCase();

  // Detect if the selected node is a section container (empty label, transparent, bordered)
  const isSectionContainer = singleNode
    ? !singleNode.data.label
      && singleNode.data.fillColor === "transparent"
      && singleNode.data.borderColor !== "none"
    : false;
  const containerSectionId = isSectionContainer && singleNode
    ? detectedSections.nodeToSection.get(singleNode.id)
    : undefined;

  // Counts for summary
  const equipmentNodeCount = useMemo(
    () => nodes.filter((n) => n.data.equipmentTypeId).length,
    [nodes]
  );
  const streamEdgeCount = useMemo(
    () => edges.filter((e) => (e.data as Record<string, unknown>)?.streamType).length,
    [edges]
  );

  // ── Handlers ─────────────────────────────────────────────────

  const handleSectionNameChange = useCallback((newName: string) => {
    if (!singleNode || !newName.trim()) return;
    snapshot();
    const newLabel = `${newName.trim()} Section`;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === singleNode.id
          ? { ...n, data: { ...n.data, label: newLabel } }
          : n
      )
    );
    // Also update the node's internal label state (for the editing component)
    singleNode.data.label = newLabel;
  }, [singleNode, snapshot, setNodes]);

  function handleEquipmentTypeChange(typeId: string) {
    if (!singleNode) return;
    snapshot();
    setNodes((nds) =>
      nds.map((n) =>
        n.id === singleNode.id
          ? {
              ...n,
              data: {
                ...n.data,
                equipmentTypeId: typeId || undefined,
                equipmentParams: typeId ? n.data.equipmentParams : undefined,
              },
            }
          : n
      )
    );

    // Auto-assign stream types to outgoing edges when equipment type is set
    if (typeId) {
      const newEntry = EQUIPMENT_TYPES[typeId];
      if (!newEntry) return;

      const outEdges = edges.filter((e) => e.source === singleNode.id);
      if (outEdges.length === 0) return;

      if (newEntry.passThrough) {
        // Pass-through: output = input stream. Find incoming stream type.
        const inEdges = edges.filter((e) => e.target === singleNode.id);
        const inStream = inEdges
          .map((e) => (e.data as Record<string, unknown>)?.streamType as string | undefined)
          .find((s) => s);
        if (inStream) {
          setEdges((eds) =>
            eds.map((e) =>
              e.source === singleNode.id && !(e.data as Record<string, unknown>)?.streamType
                ? { ...e, data: { ...((e.data as Record<string, unknown>) ?? {}), streamType: inStream } }
                : e
            )
          );
        }
      } else if (newEntry.outputStreams.length === 1) {
        // Single specific output: assign to all outgoing edges that don't have a stream yet
        const stream = newEntry.outputStreams[0];
        setEdges((eds) =>
          eds.map((e) =>
            e.source === singleNode.id && !(e.data as Record<string, unknown>)?.streamType
              ? { ...e, data: { ...((e.data as Record<string, unknown>) ?? {}), streamType: stream } }
              : e
          )
        );
      }
      // Multi-output (e.g., slant-screen with 2 outputs): don't auto-assign, user picks
    }
  }

  function handleStreamTypeChange(streamType: string) {
    if (!singleEdge) return;
    snapshot();
    setEdges((eds) =>
      eds.map((e) =>
        e.id === singleEdge.id
          ? {
              ...e,
              data: {
                ...((e.data as Record<string, unknown>) ?? {}),
                streamType: streamType || undefined,
              },
            }
          : e
      )
    );
  }

  function handleSplitFractionChange(value: string) {
    if (!singleEdge) return;
    snapshot();
    const num = parseFloat(value);
    setEdges((eds) =>
      eds.map((e) =>
        e.id === singleEdge.id
          ? {
              ...e,
              data: {
                ...((e.data as Record<string, unknown>) ?? {}),
                splitFraction: isNaN(num) || num >= 1 ? undefined : Math.max(0, Math.min(1, num)),
              },
            }
          : e
      )
    );
  }

  /** Update output water content on a filter node and auto-set split fractions on edges */
  function handleFilterWaterContent(value: string) {
    if (!singleNode) return;
    snapshot();
    const pct = parseFloat(value);
    // Save the water content as an equipment param
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== singleNode.id) return n;
        const params = { ...(n.data.equipmentParams ?? {}) };
        if (isNaN(pct)) { delete params.outputWaterContentPct; }
        else { params.outputWaterContentPct = Math.max(0, Math.min(99.99, pct)); }
        return { ...n, data: { ...n.data, equipmentParams: params } };
      })
    );
    // Auto-set split fractions on output edges
    if (!isNaN(pct)) {
      const { slurryFraction, filtrateFraction } = computeFilterSplit(pct);
      setEdges((eds) =>
        eds.map((e) => {
          if (e.source !== singleNode.id) return e;
          const d = (e.data as Record<string, unknown>) ?? {};
          const stream = d.streamType as string | undefined;
          if (stream === "biomass-slurry") {
            return { ...e, data: { ...d, splitFraction: slurryFraction } };
          }
          if (stream === "filtrate-return") {
            return { ...e, data: { ...d, splitFraction: filtrateFraction } };
          }
          return e;
        })
      );
    }
  }

  /** Update stream type or split fraction on any edge by ID (used by node inspector output edges) */
  function updateEdgeData(edgeId: string, field: "streamType" | "splitFraction", value: string) {
    snapshot();
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id !== edgeId) return e;
        const prev = (e.data as Record<string, unknown>) ?? {};
        if (field === "streamType") {
          return { ...e, data: { ...prev, streamType: value || undefined } };
        }
        const num = parseFloat(value);
        return { ...e, data: { ...prev, splitFraction: isNaN(num) || num >= 1 ? undefined : Math.max(0, Math.min(1, num)) } };
      })
    );
  }

  function handleParamChange(key: string, value: string) {
    if (!singleNode) return;
    snapshot();
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== singleNode.id) return n;
        const params = { ...(n.data.equipmentParams ?? {}) };
        if (value === "") {
          delete params[key];
        } else {
          const num = Number(value);
          params[key] = isNaN(num) ? value : num;
        }
        return { ...n, data: { ...n.data, equipmentParams: params } };
      })
    );
  }

  // ── Render: Section label inspector ─────────────────────────

  if (singleNode && isSectionLabel) {
    const equipCount = detectedSections.sections
      .find((s) => s.sectionId === currentSectionId)
      ?.nodeIds.size ?? 0;

    return (
      <div className="flex flex-col h-full overflow-y-auto bg-white border-l text-xs">
        <div className="px-3 py-2 border-b bg-emerald-50 font-semibold text-[11px] uppercase tracking-wide text-emerald-700">
          Section Label
        </div>

        {/* Section Name */}
        <div className="px-3 py-2 border-b">
          <div className="text-[10px] text-gray-400 mb-1">Section Name</div>
          <input
            type="text"
            value={currentSectionName}
            onChange={(e) => handleSectionNameChange(e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-xs bg-white font-medium"
            placeholder="e.g. Inputs"
          />
          <div className="text-[10px] text-gray-400 mt-1">
            ID: <span className="font-mono text-gray-600">{currentSectionId}</span>
          </div>
        </div>

        {/* Section info */}
        <div className="px-3 py-2 border-b text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>Nodes in section:</span>
            <span className="font-mono font-medium text-gray-700">{equipCount}</span>
          </div>
        </div>

        <div className="px-3 py-2 text-gray-400">
          <div className="text-[10px]">
            Rename this label to change the section name. The label must end with &quot;Section&quot;
            (e.g. &quot;Harvesting Section&quot;).
          </div>
          <div className="text-[10px] mt-1">ID: {singleNode.id}</div>
        </div>
      </div>
    );
  }

  // ── Render: Section container inspector ────────────────────

  if (singleNode && isSectionContainer) {
    return (
      <div className="flex flex-col h-full overflow-y-auto bg-white border-l text-xs">
        <div className="px-3 py-2 border-b bg-emerald-50 font-semibold text-[11px] uppercase tracking-wide text-emerald-700">
          Section Container
        </div>
        <div className="px-3 py-2 border-b">
          <div className="text-[10px] text-gray-400 mb-0.5">Matched Section</div>
          <div className="font-medium text-gray-800">
            {containerSectionId
              ? <span className="font-mono">{containerSectionId}</span>
              : <span className="text-amber-600 italic">No matching label found</span>
            }
          </div>
        </div>
        <div className="px-3 py-2 text-gray-400">
          <div className="text-[10px]">
            This container groups equipment into a section. Place a label node
            nearby with &quot;Name Section&quot; (e.g. &quot;Drying Section&quot;) to name it.
          </div>
          <div className="text-[10px] mt-1">ID: {singleNode.id}</div>
        </div>
      </div>
    );
  }

  // ── Render: Equipment node inspector ───────────────────────

  if (singleNode) {
    const typeId = singleNode.data.equipmentTypeId ?? "";
    const entry = typeId ? EQUIPMENT_TYPES[typeId] : null;
    const params = singleNode.data.equipmentParams ?? {};

    return (
      <div className="flex flex-col h-full overflow-y-auto bg-white border-l text-xs">
        <div className="px-3 py-2 border-b bg-gray-50 font-semibold text-[11px] uppercase tracking-wide text-gray-500">
          Node Inspector
        </div>

        {/* Label */}
        <div className="px-3 py-2 border-b">
          <div className="text-[10px] text-gray-400 mb-0.5">Label</div>
          <div className="font-medium text-gray-800 truncate">
            {singleNode.data.label || <span className="text-gray-300 italic">empty</span>}
          </div>
        </div>

        {/* Section membership */}
        {(() => {
          const sid = detectedSections.nodeToSection.get(singleNode.id);
          return sid ? (
            <div className="px-3 py-1.5 border-b">
              <span className="text-[10px] text-gray-400">Section: </span>
              <span className="text-[10px] font-mono text-emerald-700">{sid}</span>
            </div>
          ) : null;
        })()}

        {/* Equipment Type */}
        <div className="px-3 py-2 border-b">
          <div className="text-[10px] text-gray-400 mb-1">Equipment Type</div>
          <select
            value={typeId}
            onChange={(e) => handleEquipmentTypeChange(e.target.value)}
            className="w-full border rounded px-2 py-1 text-xs bg-white"
          >
            <option value="">None (visual only)</option>
            {groupedTypes.map((group) => (
              <optgroup key={group.category} label={group.category}>
                {group.types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Type info badges */}
        {entry && (
          <div className="px-3 py-2 border-b space-y-1">
            <div className="flex gap-1 flex-wrap">
              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px]">
                {entry.defaultEnergyType === "none" ? "No energy" : entry.defaultEnergyType}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px]">
                {entry.maintenanceClass}
              </span>
              {!entry.hasInstallationFactors && (
                <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[10px]">
                  fully installed
                </span>
              )}
            </div>
          </div>
        )}

        {/* Equipment params */}
        {entry && (
          <div className="px-3 py-2 border-b">
            <div className="text-[10px] text-gray-400 mb-1">Parameters</div>

            {/* Common params by type */}
            {typeId === "cone-roof-tank" && (
              <ParamField
                label="Buffer Days Config Key"
                paramKey="bufferDaysKey"
                value={String(params.bufferDaysKey ?? "")}
                placeholder="e.g. tank1_buffer_days"
                onChange={handleParamChange}
              />
            )}
            {typeId === "inoculum-pond" && (
              <ParamField
                label="Tier Index"
                paramKey="tierIndex"
                value={String(params.tierIndex ?? "")}
                placeholder="0, 1, or 2"
                onChange={handleParamChange}
              />
            )}
            {entry?.category === "filter" && !entry.passThrough && (
              <div className="text-[10px] text-gray-400 italic">
                Set output water content in the Connections section below.
              </div>
            )}

            {/* Generic param editor */}
            <div className="mt-2">
              <div className="text-[10px] text-gray-400 mb-0.5">Custom Params</div>
              {Object.entries(params).map(([key, val]) => (
                <div key={key} className="flex gap-1 mb-1">
                  <span className="text-[10px] text-gray-500 min-w-[60px]">{key}:</span>
                  <input
                    type="text"
                    value={String(val)}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                    className="flex-1 border rounded px-1 py-0.5 text-[10px]"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connections — inputs auto-derived from upstream, outputs from equipment type */}
        {(() => {
          const nodeIds = new Set(nodes.map((n) => n.id));
          // Only show edges where both endpoints exist (filter out orphans)
          const outEdges = edges.filter((e) => e.source === singleNode.id && nodeIds.has(e.target));
          const inEdges = edges.filter((e) => e.target === singleNode.id && nodeIds.has(e.source));
          if (outEdges.length === 0 && inEdges.length === 0) return null;

          const nodeLabel = (id: string) => {
            const n = nodes.find((n) => n.id === id);
            return n?.data.label || id;
          };

          // Resolve actual input streams from upstream edges
          const resolveUpstreamStream = (edge: Edge): string | null => {
            // Check if the upstream node set a stream type on this edge (from its output side)
            const d = (edge.data as Record<string, unknown>) ?? {};
            if (d.streamType) return d.streamType as string;
            return null;
          };

          const actualInputStreams = inEdges
            .map((e) => resolveUpstreamStream(e))
            .filter((s): s is string => s !== null);

          // Determine output options for this equipment
          const isFilter = entry?.category === "filter" && !entry.passThrough;
          const isMultiOutput = entry && !entry.passThrough && entry.outputStreams.length > 1;
          const outputOptions: string[] = entry
            ? entry.passThrough
              ? actualInputStreams.length > 0
                ? [...new Set(actualInputStreams)] // pass-through: output = input stream
                : entry.outputStreams              // fallback to defined outputs
              : entry.outputStreams                 // transforming: use defined outputs
            : [];

          // Warning: equipment expects more outputs than edges exist
          const expectedOutputCount = entry && !entry.passThrough ? entry.outputStreams.length : 0;
          const missingOutputs = expectedOutputCount > outEdges.length && outEdges.length > 0;

          // Stream label lookup
          const streamLabel = (id: string) => STREAM_TYPES.find((s) => s.id === id)?.label ?? id;

          return (
            <div className="px-3 py-2 border-b">
              <div className="text-[10px] text-gray-400 mb-1.5">Connections</div>

              {/* Input edges — read-only, derived from upstream */}
              {inEdges.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] text-gray-400 mb-0.5">Inputs</div>
                  {inEdges.map((e) => {
                    const upstream = resolveUpstreamStream(e);
                    return (
                      <div key={e.id} className="mb-1 pl-1 border-l-2 border-gray-200">
                        <div className="text-[10px] text-gray-600 truncate">
                          &larr; {nodeLabel(e.source)}
                        </div>
                        <div className="text-[10px] font-mono text-gray-500">
                          {upstream
                            ? <span className="text-cyan-700">{streamLabel(upstream)}</span>
                            : <span className="text-gray-300 italic">not set upstream</span>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Output edges — auto-assigned or user-selected from equipment outputs */}
              {outEdges.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-400 mb-0.5">Outputs</div>

                  {/* Filter water content control — replaces raw split fraction for filters */}
                  {isFilter && isMultiOutput && outEdges.length > 1 && (() => {
                    const wc = params.outputWaterContentPct as number | undefined;
                    const splits = wc != null ? computeFilterSplit(wc) : null;
                    return (
                      <div className="mb-2 p-1.5 rounded bg-blue-50 border border-blue-100">
                        <div className="text-[10px] text-gray-500 mb-1">Output Slurry Water Content</div>
                        <div className="flex items-center gap-1 mb-1">
                          <input
                            type="number"
                            min={0}
                            max={99.99}
                            step={1}
                            value={wc ?? ""}
                            placeholder="e.g. 75"
                            onChange={(ev) => handleFilterWaterContent(ev.target.value)}
                            className="flex-1 border rounded px-1.5 py-1 text-[11px] font-mono bg-white"
                          />
                          <span className="text-[10px] text-gray-500">%</span>
                        </div>
                        {splits && (
                          <div className="text-[10px] text-gray-500 space-y-0.5">
                            <div className="flex justify-between">
                              <span>Slurry vol:</span>
                              <span className="font-mono">{(splits.slurryFraction * 100).toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Filtrate vol:</span>
                              <span className="font-mono">{(splits.filtrateFraction * 100).toFixed(2)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {outEdges.map((e) => {
                    const d = (e.data as Record<string, unknown>) ?? {};
                    const currentStream = (d.streamType as string) ?? "";
                    const hasSplit = outEdges.length > 1 && !isFilter; // filters use water content instead

                    return (
                      <div key={e.id} className="mb-1.5 pl-1 border-l-2 border-blue-200">
                        <div className="text-[10px] text-gray-600 truncate mb-0.5">
                          &rarr; {nodeLabel(e.target)}
                        </div>
                        {outputOptions.length > 0 ? (
                          <select
                            value={currentStream}
                            onChange={(ev) => updateEdgeData(e.id, "streamType", ev.target.value)}
                            className="w-full border rounded px-1 py-0.5 text-[10px] bg-white mb-0.5"
                          >
                            <option value="">Select output...</option>
                            {outputOptions.map((s) => (
                              <option key={s} value={s}>{streamLabel(s)}</option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={currentStream}
                            onChange={(ev) => updateEdgeData(e.id, "streamType", ev.target.value)}
                            className="w-full border rounded px-1 py-0.5 text-[10px] bg-white mb-0.5"
                          >
                            <option value="">No stream</option>
                            {STREAM_TYPES.map((s) => (
                              <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                          </select>
                        )}
                        {/* Show computed split as read-only for filters */}
                        {isFilter && !!currentStream && d.splitFraction != null && (
                          <div className="text-[10px] text-gray-400 font-mono">
                            split: {((d.splitFraction as number) * 100).toFixed(2)}%
                          </div>
                        )}
                        {/* Raw split input for non-filter multi-output */}
                        {hasSplit && !!currentStream && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 shrink-0">Split:</span>
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.01}
                              value={(d.splitFraction as number) ?? ""}
                              placeholder="1.0"
                              onChange={(ev) => updateEdgeData(e.id, "splitFraction", ev.target.value)}
                              className="flex-1 border rounded px-1 py-0.5 text-[10px] font-mono bg-white"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {isMultiOutput && !isFilter && outEdges.length > 1 && (
                    <div className="text-[10px] text-gray-400 mt-1 italic">
                      Assign each output edge a different stream and set split fractions.
                    </div>
                  )}
                </div>
              )}

              {/* Warnings */}
              {missingOutputs && (
                <div className="mt-1.5 px-1.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px]">
                  This equipment produces {expectedOutputCount} output streams
                  ({entry!.outputStreams.map(streamLabel).join(" + ")})
                  but only {outEdges.length} arrow{outEdges.length === 1 ? "" : "s"} connected.
                </div>
              )}
            </div>
          );
        })()}

        {/* Node ID */}
        <div className="px-3 py-2 text-gray-400">
          <div className="text-[10px]">ID: {singleNode.id}</div>
        </div>
      </div>
    );
  }

  // ── Render: Edge inspector ───────────────────────────────────

  if (singleEdge) {
    const edgeData = (singleEdge.data as Record<string, unknown>) ?? {};
    const streamType = (edgeData.streamType as string) ?? "";
    const splitFraction = edgeData.splitFraction as number | undefined;
    const streamDef = STREAM_TYPES.find((s) => s.id === streamType);

    return (
      <div className="flex flex-col h-full overflow-y-auto bg-white border-l text-xs">
        <div className="px-3 py-2 border-b bg-gray-50 font-semibold text-[11px] uppercase tracking-wide text-gray-500">
          Edge Inspector
        </div>

        {/* Stream Type */}
        <div className="px-3 py-2 border-b">
          <div className="text-[10px] text-gray-400 mb-1">Stream Type</div>
          <select
            value={streamType}
            onChange={(e) => handleStreamTypeChange(e.target.value)}
            className="w-full border rounded px-2 py-1 text-xs bg-white"
          >
            <option value="">None (visual only)</option>
            {STREAM_TYPES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Split fraction — for edges where equipment has multiple outputs */}
        {streamDef && (
          <div className="px-3 py-2 border-b">
            <div className="text-[10px] text-gray-400 mb-1">Split Fraction</div>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={splitFraction === undefined ? "" : splitFraction}
              placeholder="1.0 (full flow)"
              onChange={(e) => handleSplitFractionChange(e.target.value)}
              className="w-full border rounded px-2 py-1 text-xs bg-white font-mono"
            />
            <div className="text-[10px] text-gray-400 mt-1">
              Fraction of the stream&apos;s flow carried by this edge (0–1).
              Leave blank for full flow. Use when equipment has multiple outputs,
              e.g., a filter splitting into slurry (0.30) and filtrate (0.70).
            </div>
          </div>
        )}

        {/* Stream info */}
        {streamDef && (
          <div className="px-3 py-2 border-b">
            <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 text-[10px]">
              {streamDef.unit}
            </span>
          </div>
        )}

        {/* Edge details */}
        <div className="px-3 py-2 text-gray-400 space-y-0.5">
          <div className="text-[10px]">ID: {singleEdge.id}</div>
          <div className="text-[10px]">Source: {singleEdge.source}</div>
          <div className="text-[10px]">Target: {singleEdge.target}</div>
        </div>
      </div>
    );
  }

  // ── Render: Summary (nothing selected) ───────────────────────

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white border-l text-xs">
      <div className="px-3 py-2 border-b bg-gray-50 font-semibold text-[11px] uppercase tracking-wide text-gray-500">
        Inspector
      </div>
      <div className="px-3 py-4 text-gray-500 space-y-3">
        <p>Select a node or edge to inspect its properties.</p>

        {/* Detected sections */}
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Sections</div>
          {detectedSections.sections.length > 0 ? (
            <div className="space-y-0.5">
              {detectedSections.sections.map((sec) => (
                <div key={sec.sectionId} className="flex justify-between">
                  <span className="font-mono text-emerald-700">{sec.sectionId}</span>
                  <span className="font-mono text-gray-600">{sec.nodeIds.size} nodes</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 italic">No sections detected</div>
          )}
          <button
            onClick={addSection}
            className="mt-2 w-full px-2 py-1.5 border border-dashed border-emerald-300 rounded text-emerald-700 hover:bg-emerald-50 transition-colors text-[11px] font-medium"
          >
            + New Section
          </button>
        </div>

        {/* Counts */}
        <div className="space-y-1 pt-1 border-t">
          <div className="flex justify-between">
            <span>Equipment nodes:</span>
            <span className="font-mono font-medium text-gray-700">{equipmentNodeCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Stream edges:</span>
            <span className="font-mono font-medium text-gray-700">{streamEdgeCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Total nodes:</span>
            <span className="font-mono font-medium text-gray-700">{nodes.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Total edges:</span>
            <span className="font-mono font-medium text-gray-700">{edges.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Param input field helper ───────────────────────────────────

function ParamField({
  label,
  paramKey,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  paramKey: string;
  value: string;
  placeholder: string;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="mb-1.5">
      <div className="text-[10px] text-gray-400 mb-0.5">{label}</div>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(paramKey, e.target.value)}
        className="w-full border rounded px-2 py-1 text-[10px] bg-white"
      />
    </div>
  );
}
