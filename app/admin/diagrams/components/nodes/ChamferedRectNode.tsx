"use client";

import { memo, useState, useCallback, useEffect, useRef, useContext } from "react";
import { Handle, Position, NodeResizer, type NodeProps, type Node } from "@xyflow/react";
import type { ShapeNodeData } from "./RectangleNode";
import { DiagramContext } from "../DiagramContext";

function ChamferedRectNode({ id, data, selected, width, height }: NodeProps<Node<ShapeNodeData>>) {
  const { onResizeStart, onResizeDelta } = useContext(DiagramContext);
  const rsW = useRef(0);
  const rsH = useRef(0);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(data.label);
  }, [data.label]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitLabel = useCallback(() => {
    setEditing(false);
    data.label = label;
  }, [label, data]);

  // Chamfer size in pixels = 28% of the shorter dimension.
  // Convert to viewBox percentages so the SVG scales correctly.
  const w = width ?? 180;
  const h = height ?? 60;
  const chamferPx = Math.min(w, h) * 0.28;
  const cx = (chamferPx / w) * 100;
  const cy = (chamferPx / h) * 100;
  const points = [
    `${cx},0`,
    `${100 - cx},0`,
    `100,${cy}`,
    `100,${100 - cy}`,
    `${100 - cx},100`,
    `${cx},100`,
    `0,${100 - cy}`,
    `0,${cy}`,
  ].join(" ");

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={20}
        minHeight={20}
        onResizeStart={(_, p) => { rsW.current = p.width; rsH.current = p.height; onResizeStart(id, p.width, p.height); }}
        onResize={(_, p) => onResizeDelta(id, p.width - rsW.current, p.height - rsH.current, p.width, p.height)}
      />
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
      <div
        onDoubleClick={() => setEditing(true)}
        style={{ position: "relative", width: "100%", height: "100%" }}
      >
        {/* Shape fill + border via SVG */}
        <svg
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "visible" }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polygon
            points={points}
            fill={data.fillColor || "#ffffff"}
            stroke={data.borderColor === "none" ? "none" : (data.borderColor || "#6b7280")}
            strokeWidth={data.borderColor === "none" ? 0 : 2}
            strokeDasharray={data.borderDashed && data.borderColor !== "none" ? "6 3" : undefined}
            vectorEffect="non-scaling-stroke"
            filter="drop-shadow(0 1px 2px rgb(0 0 0 / 0.1))"
          />
        </svg>
        {/* Content */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: data.textAlign === "left" ? "flex-start" : data.textAlign === "right" ? "flex-end" : "center",
            padding: "4px 6px",
            overflow: "hidden",
          }}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => e.key === "Enter" && commitLabel()}
              className="w-full bg-transparent text-sm outline-none"
              style={{ textAlign: data.textAlign || "center", color: data.textColor, fontWeight: data.fontBold ? "bold" : undefined, fontStyle: data.fontItalic ? "italic" : undefined }}
            />
          ) : (
            <span className="select-none text-sm" style={{ textAlign: data.textAlign || "center", width: "100%", color: data.textColor, fontWeight: data.fontBold ? "bold" : undefined, fontStyle: data.fontItalic ? "italic" : undefined, overflowWrap: "break-word", minWidth: 0 }}>{label}</span>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(ChamferedRectNode);
