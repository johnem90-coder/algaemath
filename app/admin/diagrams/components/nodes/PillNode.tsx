"use client";

import { memo, useState, useCallback, useEffect, useRef, useContext } from "react";
import { Handle, Position, NodeResizer, type NodeProps, type Node } from "@xyflow/react";
import type { ShapeNodeData } from "./RectangleNode";
import { DiagramContext } from "../DiagramContext";

function PillNode({ id, data, selected }: NodeProps<Node<ShapeNodeData>>) {
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
        className="flex h-full w-full items-center text-sm shadow-sm overflow-hidden px-1.5 py-1"
        style={{
          backgroundColor: data.fillColor || "#ffffff",
          borderColor: data.borderColor === "none" ? "transparent" : (data.borderColor || "#6b7280"),
          borderWidth: data.borderColor === "none" ? 0 : 2,
          borderStyle: data.borderDashed ? "dashed" : "solid",
          borderRadius: 9999,
          justifyContent: data.textAlign === "left" ? "flex-start" : data.textAlign === "right" ? "flex-end" : "center",
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
          <span className="select-none" style={{ textAlign: data.textAlign || "center", width: "100%", color: data.textColor, fontWeight: data.fontBold ? "bold" : undefined, fontStyle: data.fontItalic ? "italic" : undefined, overflowWrap: "break-word", minWidth: 0 }}>{label}</span>
        )}
      </div>
    </>
  );
}

export default memo(PillNode);
