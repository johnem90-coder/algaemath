"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────

interface FacilityNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  data: {
    label?: string;
    fillColor?: string;
    borderColor?: string;
    borderDashed?: boolean;
    textAlign?: "left" | "center" | "right";
    textColor?: string;
    fontBold?: boolean;
    fontItalic?: boolean;
    equipmentTypeId?: string;
  };
}

interface FacilityDiagram {
  name: string;
  version?: number;
  nodes: FacilityNode[];
  edges: unknown[];
  fullViewBox?: { x: number; y: number; width: number; height: number };
}

interface Props {
  nPonds: number;
}

// ── Word-wrap helper for SVG text ───────────────────────────────────
// Approximates character width as 0.58× fontSize and splits on spaces.

function wrapWords(text: string, maxWidth: number, fontSize: number): string[] {
  const avgCW = fontSize * 0.58;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (cur && test.length * avgCW > maxWidth) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

// ── Node shape renderer (no interactive overhead) ────────────────────

function renderNode(node: FacilityNode) {
  const { x, y } = node.position;
  const w = node.width;
  const h = node.height;
  const { fillColor, borderColor, borderDashed, label, textAlign, textColor, fontBold, fontItalic, rotation } = node.data as typeof node.data & { rotation?: number };

  const fill = fillColor || "#ffffff";
  const stroke = borderColor === "none" || !borderColor ? "none" : borderColor;
  const strokeWidth = stroke === "none" ? 0 : 1.5;
  const dashArray = borderDashed ? "5 3" : undefined;

  const padX = 6;
  const fontSize = 12;

  let anchor: "start" | "middle" | "end";
  let textX: number;
  if (textAlign === "left")        { anchor = "start";  textX = x + padX; }
  else if (textAlign === "right")  { anchor = "end";    textX = x + w - padX; }
  else                             { anchor = "middle"; textX = x + w / 2; }

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

  // Rotation is encoded via swapped dimensions in the editor; no SVG transform needed.
  void rotation;

  // Word-wrap and vertically centre the text block within the node.
  const clipId = `fc-${node.id}`;
  const lines = label ? wrapWords(label, w - padX * 2, fontSize) : [];
  const lineH = fontSize * 1.35;
  const blockH = lines.length * lineH;
  // y-position of the first baseline so the whole block is centred
  const textStartY = y + h / 2 - blockH / 2 + fontSize * 0.85;

  return (
    <g key={node.id}>
      <clipPath id={clipId}>
        <rect x={x} y={y} width={w} height={h} />
      </clipPath>
      {shape}
      {lines.length > 0 && (
        <text
          textAnchor={anchor}
          fill={textColor || "#1f2937"} fontSize={fontSize}
          fontWeight={fontBold ? 700 : 400}
          fontStyle={fontItalic ? "italic" : "normal"}
          fontFamily="system-ui, -apple-system, sans-serif"
          clipPath={`url(#${clipId})`}
        >
          {lines.map((line, i) => (
            <tspan key={i} x={textX} y={textStartY + i * lineH}>{line}</tspan>
          ))}
        </text>
      )}
    </g>
  );
}

// ── Main component ─────────────────────────────────────────────────

export default function FacilityView({ nPonds }: Props) {
  // We keep two diagram slots so we can crossfade: the "shown" one stays visible
  // while the incoming one fades in on top, then becomes the new shown one.
  const [shown, setShown] = useState<{ key: number; data: FacilityDiagram } | null>(null);
  const [incoming, setIncoming] = useState<{ key: number; data: FacilityDiagram } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const keyRef = useRef(0);

  useEffect(() => {
    const n = Math.max(10, Math.min(120, nPonds));
    setNotFound(false);
    let cancelled = false;

    fetch(`/diagrams/facility/open-raceway-pond-facility-${n}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<FacilityDiagram>;
      })
      .then((data) => {
        if (cancelled) return;
        const key = ++keyRef.current;
        setIncoming({ key, data });
      })
      .catch(() => { if (!cancelled) setNotFound(true); });

    return () => { cancelled = true; };
  }, [nPonds]);

  // Once the incoming SVG has faded in, promote it to shown and clear incoming.
  const handleIncomingAnimationEnd = () => {
    if (incoming) {
      setShown(incoming);
      setIncoming(null);
    }
  };

  // Placeholder — files not yet generated
  if (notFound) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground rounded-xl border border-dashed">
        <div className="text-center">
          <p className="text-sm font-medium">Facility Diagram</p>
          <p className="text-xs mt-1">Author master diagram in admin editor</p>
        </div>
      </div>
    );
  }

  // First load — nothing shown yet, show pulse placeholder
  if (!shown && !incoming) {
    return (
      <div className="w-full h-full flex items-center justify-center rounded-xl border border-dashed animate-pulse bg-muted/30" />
    );
  }

  function buildSvg(d: FacilityDiagram) {
    const nodes = d.nodes || [];
    let vx: number, vy: number, vw: number, vh: number;
    if (d.fullViewBox) {
      ({ x: vx, y: vy, width: vw, height: vh } = d.fullViewBox);
    } else {
      const pad = 30;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of nodes) {
        const { x, y } = node.position;
        const nw = node.width || 0;
        const nh = node.height || 0;
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x + nw > maxX) maxX = x + nw; if (y + nh > maxY) maxY = y + nh;
      }
      vx = minX - pad; vy = minY - pad;
      vw = maxX - minX + pad * 2; vh = maxY - minY + pad * 2;
    }
    return { nodes, vx, vy, vw, vh };
  }

  const shownSvg = shown ? buildSvg(shown.data) : null;
  const incomingSvg = incoming ? buildSvg(incoming.data) : null;

  return (
    <div className="relative w-full h-full">
      {/* Previously shown diagram — stays visible underneath while next fades in */}
      {shownSvg && (
        <svg
          key={shown!.key}
          viewBox={`${shownSvg.vx} ${shownSvg.vy} ${shownSvg.vw} ${shownSvg.vh}`}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {shownSvg.nodes.map((node) => renderNode(node))}
        </svg>
      )}
      {/* Incoming diagram — fades in on top, then becomes the new shown */}
      {incomingSvg && (
        <svg
          key={incoming!.key}
          viewBox={`${incomingSvg.vx} ${incomingSvg.vy} ${incomingSvg.vw} ${incomingSvg.vh}`}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ animation: "facilityFadeIn 120ms ease-out forwards" }}
          onAnimationEnd={handleIncomingAnimationEnd}
        >
          {incomingSvg.nodes.map((node) => renderNode(node))}
        </svg>
      )}
      <style>{`@keyframes facilityFadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  );
}
