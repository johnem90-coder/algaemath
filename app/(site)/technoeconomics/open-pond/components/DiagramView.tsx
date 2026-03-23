"use client";

import { useMemo, useState } from "react";
import { detectSections, type DiagramNodeGeometry } from "@/lib/technoeconomics/common/section-detection";

// ── Types ──────────────────────────────────────────────────────────

interface DiagramNode extends DiagramNodeGeometry {
  type: string;
  data: DiagramNodeGeometry["data"] & {
    borderDashed?: boolean;
    textAlign?: "left" | "center" | "right";
    textColor?: string;
    fontBold?: boolean;
    fontItalic?: boolean;
    equipmentTypeId?: string;
  };
  style?: { width?: number; height?: number };
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  type: string;
  style?: {
    strokeWidth?: number;
    stroke?: string;
    strokeDasharray?: string;
  };
}

export interface DiagramData {
  name: string;
  version?: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface Props {
  diagram: DiagramData;
  hoveredSection?: string | null;
  activeSection?: string | null;
  activeEquipmentId?: string | null;
  onHoverSection?: (sectionId: string | null) => void;
  onSectionClick?: (sectionId: string) => void;
  onEquipmentClick?: (nodeId: string) => void;
}

// ── Handle position helpers ────────────────────────────────────────

function getHandlePos(node: DiagramNode, handleId: string): [number, number] {
  const { x, y } = node.position;
  const w = node.width;
  const h = node.height;
  switch (handleId) {
    case "top":    return [x + w / 2, y];
    case "right":  return [x + w, y + h / 2];
    case "bottom": return [x + w / 2, y + h];
    case "left":   return [x, y + h / 2];
    default:       return [x + w / 2, y + h / 2];
  }
}

function extend(x: number, y: number, dir: string, offset: number): [number, number] {
  switch (dir) {
    case "top":    return [x, y - offset];
    case "bottom": return [x, y + offset];
    case "left":   return [x - offset, y];
    case "right":  return [x + offset, y];
    default:       return [x, y];
  }
}

// ── Smoothstep path with rounded corners ───────────────────────────

function roundedPath(pts: [number, number][], r: number): string {
  if (pts.length < 2) return "";
  const d: string[] = [`M ${pts[0][0]} ${pts[0][1]}`];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], cur = pts[i], next = pts[i + 1];
    const dx1 = cur[0] - prev[0], dy1 = cur[1] - prev[1];
    const dx2 = next[0] - cur[0], dy2 = next[1] - cur[1];
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (len1 === 0 || len2 === 0) { d.push(`L ${cur[0]} ${cur[1]}`); continue; }
    const clampR = Math.min(r, len1 / 2, len2 / 2);
    d.push(`L ${cur[0] - (dx1 / len1) * clampR} ${cur[1] - (dy1 / len1) * clampR}`);
    d.push(`Q ${cur[0]} ${cur[1]} ${cur[0] + (dx2 / len2) * clampR} ${cur[1] + (dy2 / len2) * clampR}`);
  }
  d.push(`L ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`);
  return d.join(" ");
}

function buildSmoothStepPath(
  sx: number, sy: number, sDir: string,
  tx: number, ty: number, tDir: string,
): string {
  const offset = 25, r = 8;
  const pts: [number, number][] = [[sx, sy]];
  const s1 = extend(sx, sy, sDir, offset);
  pts.push(s1);
  const t1 = extend(tx, ty, tDir, offset);
  const sVert = sDir === "top" || sDir === "bottom";
  const tVert = tDir === "top" || tDir === "bottom";
  if (sVert !== tVert) {
    pts.push(sVert ? [s1[0], t1[1]] : [t1[0], s1[1]]);
  } else if (sVert) {
    const my = (s1[1] + t1[1]) / 2;
    pts.push([s1[0], my], [t1[0], my]);
  } else {
    const mx = (s1[0] + t1[0]) / 2;
    pts.push([mx, s1[1]], [mx, t1[1]]);
  }
  pts.push(t1, [tx, ty]);
  return roundedPath(pts, r);
}

// Section detection is shared with the TEA engine via section-detection.ts

// ── Node shape renderer ────────────────────────────────────────────

function renderNode(node: DiagramNode) {
  const { x, y } = node.position;
  const w = node.width;
  const h = node.height;
  const { fillColor, borderColor, borderDashed, label, textAlign, textColor, fontBold, fontItalic, rotation } = node.data as typeof node.data & { rotation?: number };

  const fill = fillColor || "#ffffff";
  const stroke = borderColor === "none" || !borderColor ? "none" : borderColor;
  const strokeWidth = stroke === "none" ? 0 : 1.5;
  const dashArray = borderDashed ? "5 3" : undefined;

  let anchor: "start" | "middle" | "end";
  let textX: number;
  if (textAlign === "left")       { anchor = "start";  textX = x + 8; }
  else if (textAlign === "right") { anchor = "end";    textX = x + w - 8; }
  else                            { anchor = "middle"; textX = x + w / 2; }

  let shape: React.ReactNode;
  switch (node.type) {
    case "roundedRect":
      shape = <rect x={x} y={y} width={w} height={h} rx={8} ry={8} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} />;
      break;
    case "pill": {
      const r = Math.min(w, h) / 2;
      shape = <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} />;
      break;
    }
    case "chamferedRect": {
      const c = Math.min(10, w / 4, h / 4);
      const pts = `${x+c},${y} ${x+w-c},${y} ${x+w},${y+c} ${x+w},${y+h-c} ${x+w-c},${y+h} ${x+c},${y+h} ${x},${y+h-c} ${x},${y+c}`;
      shape = <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} />;
      break;
    }
    case "diamond": {
      const pts = `${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}`;
      shape = <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} />;
      break;
    }
    case "triangle": {
      const pts = `${x+w/2},${y} ${x+w},${y+h} ${x},${y+h}`;
      shape = <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} />;
      break;
    }
    default:
      shape = <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} />;
  }

  const cx = x + w / 2, cy = y + h / 2;
  return (
    <g key={node.id} transform={rotation ? `rotate(${rotation} ${cx} ${cy})` : undefined}>
      {shape}
      {label && (
        <text
          x={textX} y={y + h / 2} dy="0.35em" textAnchor={anchor}
          fill={textColor || "#1f2937"} fontSize={16}
          fontWeight={fontBold ? 700 : 400}
          fontStyle={fontItalic ? "italic" : "normal"}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {label}
        </text>
      )}
    </g>
  );
}

// ── Main component ─────────────────────────────────────────────────

export function DiagramView({
  diagram,
  hoveredSection,
  activeSection,
  activeEquipmentId,
  onHoverSection,
  onSectionClick,
  onEquipmentClick,
}: Props) {
  const { nodes, edges } = diagram;
  const [hoveredEquipmentId, setHoveredEquipmentId] = useState<string | null>(null);

  const nodeMap = useMemo(() => {
    const m = new Map<string, DiagramNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const { sections, nodeToSection } = useMemo(() => detectSections(nodes), [nodes]);

  // Derive section from hovered/active equipment, falling back to explicit section props
  const equipmentSectionId = (hoveredEquipmentId && nodeToSection.get(hoveredEquipmentId))
    || (activeEquipmentId && nodeToSection.get(activeEquipmentId))
    || null;
  const highlightedSection = hoveredSection || equipmentSectionId || activeSection || null;

  // Group nodes by section
  const { sectionGroups, unassigned } = useMemo(() => {
    const groups: Record<string, DiagramNode[]> = {};
    const rest: DiagramNode[] = [];
    for (const n of nodes) {
      const sid = nodeToSection.get(n.id);
      if (sid) (groups[sid] ??= []).push(n);
      else rest.push(n);
    }
    return { sectionGroups: groups, unassigned: rest };
  }, [nodes, nodeToSection]);

  // Bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + n.width);
    maxY = Math.max(maxY, n.position.y + n.height);
  }
  const pad = 30;

  // Container rect for the highlighted section (for blue overlay)
  const highlightedBounds = highlightedSection
    ? sections.find((s) => s.sectionId === highlightedSection)?.containerBounds ?? null
    : null;

  return (
    <div className="w-full overflow-hidden rounded-lg border bg-white">
      <svg
        viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
        className="w-full h-auto"
        style={{ maxHeight: 480 }}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => onHoverSection?.(null)}
      >
        <defs>
          <marker id="dv-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <path d="M 0 0 L 8 3 L 0 6 Z" fill="#374151" />
          </marker>
        </defs>

        {/* ── Layer 1: Edges ── */}
        {edges.map((edge) => {
          const srcNode = nodeMap.get(edge.source);
          const tgtNode = nodeMap.get(edge.target);
          if (!srcNode || !tgtNode) return null;
          const [sx, sy] = getHandlePos(srcNode, edge.sourceHandle);
          const [tx, ty] = getHandlePos(tgtNode, edge.targetHandle);
          return (
            <path
              key={edge.id}
              d={buildSmoothStepPath(sx, sy, edge.sourceHandle, tx, ty, edge.targetHandle)}
              fill="none"
              stroke={edge.style?.stroke || "#374151"}
              strokeWidth={edge.style?.strokeWidth || 1.5}
              strokeDasharray={edge.style?.strokeDasharray}
              markerEnd="url(#dv-arrow)"
            />
          );
        })}

        {/* ── Layer 2: All nodes (plain, no highlights) ── */}
        {sections.map((sec) => {
          const sectionNodes = sectionGroups[sec.sectionId] || [];
          return (
            <g
              key={sec.sectionId}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => onHoverSection?.(sec.sectionId)}
              onClick={() => onSectionClick?.(sec.sectionId)}
            >
              {sectionNodes.map((node) => {
                const isEquipment = !!node.data.equipmentTypeId;
                if (isEquipment && onEquipmentClick) {
                  return (
                    <g
                      key={node.id}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={(e) => { e.stopPropagation(); setHoveredEquipmentId(node.id); }}
                      onMouseLeave={() => setHoveredEquipmentId(null)}
                      onClick={(e) => { e.stopPropagation(); onEquipmentClick(node.id); }}
                    >
                      {renderNode(node)}
                    </g>
                  );
                }
                return renderNode(node);
              })}
            </g>
          );
        })}
        {unassigned.length > 0 && (
          <g>
            {unassigned.map(renderNode)}
          </g>
        )}

        {/* ── Layer 3: Section dim overlay (grey, on top — dims section contents) ── */}
        {highlightedBounds && (
          <>
            <rect
              x={highlightedBounds.x - 3}
              y={highlightedBounds.y - 3}
              width={highlightedBounds.w + 6}
              height={highlightedBounds.h + 6}
              fill="rgba(107, 114, 128, 0.12)"
              stroke="#6b7280"
              strokeWidth={2}
              rx={6}
              ry={6}
              pointerEvents="none"
            />
            {/* Re-render section label on top of dim so it stays readable */}
            {(() => {
              const sec = sections.find((s) => s.sectionId === highlightedSection);
              if (!sec) return null;
              const labelNode = nodes.find(
                (n) => sec.nodeIds.has(n.id) && /Section$/.test(n.data.label)
              );
              return labelNode ? renderNode(labelNode) : null;
            })()}
          </>
        )}

        {/* ── Layer 4: Equipment highlight — "reveals" through the dim overlay ── */}
        {(() => {
          const highlightId = activeEquipmentId || hoveredEquipmentId;
          if (!highlightId) return null;
          const node = nodeMap.get(highlightId);
          if (!node) return null;
          const isActive = activeEquipmentId === highlightId;
          return (
            <g
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => { e.stopPropagation(); setHoveredEquipmentId(highlightId); }}
              onMouseLeave={() => setHoveredEquipmentId(null)}
              onClick={(e) => { e.stopPropagation(); onEquipmentClick?.(highlightId); }}
            >
              {/* White backing to punch through the dim overlay */}
              <rect
                x={node.position.x - 4}
                y={node.position.y - 4}
                width={node.width + 8}
                height={node.height + 8}
                fill="white"
                stroke="#374151"
                strokeWidth={isActive ? 2.5 : 2}
                rx={5}
                pointerEvents="none"
              />
              {/* Re-render the node on top with original colors */}
              {renderNode(node)}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
