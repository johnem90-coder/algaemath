"use client";

import { memo, useState, useCallback, useEffect, useRef } from "react";
import { Handle, Position, NodeResizer, type NodeProps, type Node } from "@xyflow/react";
import type { ShapeNodeData } from "./RectangleNode";

function DiamondNode({ data, selected }: NodeProps<Node<ShapeNodeData>>) {
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
        minWidth={80}
        minHeight={80}
      />
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ transform: "rotate(45deg)" }}
      >
        <div
          onDoubleClick={() => setEditing(true)}
          className="flex h-full w-full items-center justify-center text-sm shadow-sm"
          style={{
            backgroundColor: data.fillColor || "#ffffff",
            borderColor: data.borderColor || "#6b7280",
            borderWidth: 2,
            borderStyle: "solid",
          }}
        >
          <div style={{ transform: "rotate(-45deg)" }} className="px-2 py-1">
            {editing ? (
              <input
                ref={inputRef}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={commitLabel}
                onKeyDown={(e) => e.key === "Enter" && commitLabel()}
                className="w-full bg-transparent text-center text-sm outline-none"
              />
            ) : (
              <span className="select-none text-center">{label || "Text"}</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(DiamondNode);
