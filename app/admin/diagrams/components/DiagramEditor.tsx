"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  ConnectionMode,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { nodeTypes, shapeDefaults, type ShapeType } from "./nodes";
import type { ShapeNodeData } from "./nodes/RectangleNode";
import Toolbar from "./Toolbar";

let idCounter = 0;
function nextId() {
  return `node-${++idCounter}`;
}
function nextEdgeId() {
  return `edge-${++idCounter}`;
}

const defaultEdgeOptions = {
  type: "smoothstep" as const,
  markerEnd: { type: MarkerType.ArrowClosed },
};

function DiagramEditorInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ShapeNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [diagramName, setDiagramName] = useState("untitled");
  const [fillColor, setFillColor] = useState("#ffffff");
  const [borderColor, setBorderColor] = useState("#6b7280");
  const clipboardRef = useRef<Node<ShapeNodeData>[]>([]);

  const { screenToFlowPosition, getViewport } = useReactFlow();

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "s") {
          e.preventDefault();
          handleSave();
        }
        if (e.key === "a") {
          e.preventDefault();
          setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
          setEdges((eds) => eds.map((e) => ({ ...e, selected: true })));
        }
        if (e.key === "c") {
          e.preventDefault();
          clipboardRef.current = nodes.filter((n) => n.selected);
        }
        if (e.key === "v" && clipboardRef.current.length > 0) {
          e.preventDefault();
          const pasted = clipboardRef.current.map((n) => ({
            ...n,
            id: nextId(),
            position: { x: n.position.x + 20, y: n.position.y + 20 },
            selected: true,
            data: { ...n.data },
          }));
          setNodes((nds) => [
            ...nds.map((n) => ({ ...n, selected: false })),
            ...pasted,
          ]);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // --- Handlers ---
  const deleteSelected = useCallback(() => {
    setNodes((nds) => nds.filter((n) => !n.selected));
    setEdges((eds) => eds.filter((e) => !e.selected));
  }, [setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const edge: Edge = {
        ...connection,
        id: nextEdgeId(),
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
      };
      setEdges((eds) => [...eds, edge]);
    },
    [setEdges]
  );

  const onEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      const label = window.prompt("Edge label:", (edge.label as string) || "");
      if (label !== null) {
        setEdges((eds) =>
          eds.map((e) => (e.id === edge.id ? { ...e, label } : e))
        );
      }
    },
    [setEdges]
  );

  const handleAddShape = useCallback(
    (shape: ShapeType) => {
      const defaults = shapeDefaults[shape];
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const newNode: Node<ShapeNodeData> = {
        id: nextId(),
        type: shape,
        position,
        data: {
          label: "",
          fillColor,
          borderColor,
        },
        style: { width: defaults.width, height: defaults.height },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [fillColor, borderColor, screenToFlowPosition, setNodes]
  );

  const handleFillColorChange = useCallback(
    (color: string) => {
      setFillColor(color);
      setNodes((nds) =>
        nds.map((n) =>
          n.selected ? { ...n, data: { ...n.data, fillColor: color } } : n
        )
      );
    },
    [setNodes]
  );

  const handleBorderColorChange = useCallback(
    (color: string) => {
      setBorderColor(color);
      setNodes((nds) =>
        nds.map((n) =>
          n.selected ? { ...n, data: { ...n.data, borderColor: color } } : n
        )
      );
    },
    [setNodes]
  );

  const handleNew = useCallback(() => {
    const name = window.prompt("Diagram name:", "untitled");
    if (name !== null) {
      setDiagramName(name);
      setNodes([]);
      setEdges([]);
      idCounter = 0;
    }
  }, [setNodes, setEdges]);

  const handleSave = useCallback(() => {
    const viewport = getViewport();
    const payload = {
      name: diagramName,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      viewport,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
        style: n.style,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
        type: e.type,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${diagramName || "diagram"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramName, nodes, edges, getViewport]);

  const handleLoad = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          setDiagramName(parsed.name || "untitled");
          setNodes(parsed.nodes || []);
          setEdges(
            (parsed.edges || []).map((e: Edge) => ({
              ...e,
              markerEnd: { type: MarkerType.ArrowClosed },
            }))
          );
          // Reset counter past any loaded IDs
          const maxNum = [...(parsed.nodes || []), ...(parsed.edges || [])]
            .map((item: { id: string }) => {
              const m = item.id.match(/\d+/);
              return m ? parseInt(m[0], 10) : 0;
            })
            .reduce((a: number, b: number) => Math.max(a, b), 0);
          idCounter = maxNum;
        } catch {
          alert("Failed to parse JSON file");
        }
      };
      reader.readAsText(file);
    },
    [setNodes, setEdges]
  );

  const handleExportSVG = useCallback(() => {
    const viewport = document.querySelector(
      ".react-flow__viewport"
    ) as SVGGElement | null;
    if (!viewport) return;

    const svg = viewport.closest("svg");
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${diagramName || "diagram"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [diagramName]);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <Toolbar
        diagramName={diagramName}
        onNameChange={setDiagramName}
        fillColor={fillColor}
        borderColor={borderColor}
        onFillColorChange={handleFillColorChange}
        onBorderColorChange={handleBorderColorChange}
        onNew={handleNew}
        onSave={handleSave}
        onLoad={handleLoad}
        onExportSVG={handleExportSVG}
        onAddShape={handleAddShape}
        onDeleteSelected={deleteSelected}
      />
      <div style={{ width: "100%", height: "calc(100vh - 49px)" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeDoubleClick={onEdgeDoubleClick}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionMode={ConnectionMode.Loose}
          snapToGrid
          snapGrid={[20, 20]}
          fitView
          deleteKeyCode={null}
        >
          <Background gap={20} />
          <MiniMap
            position="bottom-right"
            style={{ width: 160, height: 120 }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function DiagramEditor() {
  return (
    <ReactFlowProvider>
      <DiagramEditorInner />
    </ReactFlowProvider>
  );
}
