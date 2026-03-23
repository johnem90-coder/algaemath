"use client";

import { memo, useState, useCallback, useEffect, useRef, useContext } from "react";
import { Handle, Position, NodeResizer, type NodeProps, type Node } from "@xyflow/react";
import type { ShapeNodeData } from "./RectangleNode";
import { DiagramContext } from "../DiagramContext";

function TriangleNode({ id, data, selected }: NodeProps<Node<ShapeNodeData>>) {
  const { onResizeStart, onResizeDelta } = useContext(DiagramContext);
  const rsW = useRef(0);
  const rsH = useRef(0);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLabel(data.label); }, [data.label]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commitLabel = useCallback(() => {
    setEditing(false);
    data.label = label;
  }, [label, data]);

  const fill = data.fillColor || "#ffffff";
  const stroke = data.borderColor === "none" ? "none" : (data.borderColor || "#6b7280");
  const dashArray = data.borderDashed ? "5 3" : undefined;

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
      <div style={{ position: "absolute", inset: 0 }}>
      {/* SVG fills 100%×100% using normalized viewBox so it scales with resize */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
      >
        <polygon
          points="50,0 100,100 0,100"
          fill={fill}
          stroke={stroke === "none" ? "none" : stroke}
          strokeWidth={stroke === "none" ? 0 : 2}
          strokeDasharray={dashArray}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Label layer on top of SVG */}
      <div
        onDoubleClick={() => setEditing(true)}
        className="relative flex h-full w-full items-end justify-center pb-2 text-sm"
      >
        {editing ? (
          <input
            ref={inputRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => e.key === "Enter" && commitLabel()}
            className="w-3/4 bg-transparent text-center text-sm outline-none"
            style={{ color: data.textColor, fontWeight: data.fontBold ? "bold" : undefined, fontStyle: data.fontItalic ? "italic" : undefined }}
          />
        ) : (
          <span
            className="select-none text-center"
            style={{ color: data.textColor, fontWeight: data.fontBold ? "bold" : undefined, fontStyle: data.fontItalic ? "italic" : undefined }}
          >
            {label}
          </span>
        )}
      </div>
      </div>
    </>
  );
}

export default memo(TriangleNode);
