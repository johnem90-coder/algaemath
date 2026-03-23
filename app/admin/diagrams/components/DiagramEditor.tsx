"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  ConnectionMode,
  MarkerType,
  SelectionMode,
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
import InspectorPanel from "./InspectorPanel";
import { DiagramContext } from "./DiagramContext";

const SNAP = 10;
const MAX_HISTORY = 10;
const snapTo = (v: number) => Math.round(v / SNAP) * SNAP;

const nextId = () => crypto.randomUUID();
const nextEdgeId = () => crypto.randomUUID();

const EDGE_STROKE = "#374151";
const EDGE_MARKER_BASE = { type: MarkerType.ArrowClosed, width: 18, height: 10, color: EDGE_STROKE };
const EDGE_DASH = "7 4";
const BORDER_DASH = "6 3";

const defaultEdgeOptions = {
  type: "smoothstep" as const,
  style: { strokeWidth: 2, stroke: EDGE_STROKE },
  markerEnd: EDGE_MARKER_BASE,
};

function DiagramEditorInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ShapeNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [diagramName, setDiagramName] = useState("untitled");
  const [fillColor, setFillColor] = useState("#ffffff");
  const [borderColor, setBorderColor] = useState("#6b7280");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("center");
  const [textColor, setTextColor] = useState("#111827");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const clipboardRef = useRef<Node<ShapeNodeData>[]>([]);
  const savedNames = useRef<Set<string>>(new Set());

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const historyRef = useRef<Array<{ nodes: Node<ShapeNodeData>[]; edges: Edge[] }>>([]);
  const futureRef = useRef<Array<{ nodes: Node<ShapeNodeData>[]; edges: Edge[] }>>([]);

  const snapshot = useCallback(() => {
    historyRef.current = [
      ...historyRef.current.slice(-(MAX_HISTORY - 1)),
      { nodes: nodesRef.current, edges: edgesRef.current },
    ];
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (!historyRef.current.length) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current = [
      { nodes: nodesRef.current, edges: edgesRef.current },
      ...futureRef.current.slice(0, MAX_HISTORY - 1),
    ];
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (!futureRef.current.length) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    historyRef.current = [
      ...historyRef.current.slice(-(MAX_HISTORY - 1)),
      { nodes: nodesRef.current, edges: edgesRef.current },
    ];
    setNodes(next.nodes);
    setEdges(next.edges);
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
  }, [setNodes, setEdges]);

  // Deduplicate snapshot calls when both onNodeDragStart and onSelectionDragStart fire
  const dragSnapshotRef = useRef(false);
  const snapshotOnDragStart = useCallback(() => {
    if (dragSnapshotRef.current) return;
    dragSnapshotRef.current = true;
    snapshot();
  }, [snapshot]);
  const onDragStop = useCallback(() => {
    dragSnapshotRef.current = false;
  }, []);

  // --- Multi-select resize ---
  const resizeStartRef = useRef<Map<string, { w: number; h: number }>>(new Map());

  const handleResizeStart = useCallback((nodeId: string, w: number, h: number) => {
    snapshot();
    const map = new Map<string, { w: number; h: number }>();
    nodesRef.current.forEach((n) => {
      if (n.selected) {
        const nw = n.width ?? (typeof n.style?.width === "number" ? n.style.width : 180);
        const nh = n.height ?? (typeof n.style?.height === "number" ? n.style.height : 60);
        map.set(n.id, { w: nw, h: nh });
      }
    });
    map.set(nodeId, { w, h });
    resizeStartRef.current = map;
  }, [snapshot]);

  const handleResizeDelta = useCallback((nodeId: string, dw: number, dh: number, primaryW: number, primaryH: number) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          // Sync style.width/height for the primary node — React Flow updates node.width/height
          // internally via onNodesChange but style.width/height takes rendering precedence.
          return { ...n, style: { ...n.style, width: primaryW, height: primaryH }, width: primaryW, height: primaryH };
        }
        if (!n.selected) return n;
        const initial = resizeStartRef.current.get(n.id);
        if (!initial) return n;
        const newW = Math.max(20, snapTo(initial.w + dw));
        const newH = Math.max(20, snapTo(initial.h + dh));
        return { ...n, style: { ...n.style, width: newW, height: newH }, width: newW, height: newH };
      })
    );
  }, [setNodes]);

  const edgeDashedActive = useMemo(() => {
    const sel = edges.filter((e) => e.selected);
    return sel.length > 0 && sel.every((e) => !!e.style?.strokeDasharray);
  }, [edges]);

  const borderDashedActive = useMemo(() => {
    const sel = nodes.filter((n) => n.selected);
    return sel.length > 0 && sel.every((n) => !!n.data.borderDashed);
  }, [nodes]);

  const fontBoldActive = useMemo(() => {
    const sel = nodes.filter((n) => n.selected);
    return sel.length > 0 && sel.every((n) => !!n.data.fontBold);
  }, [nodes]);

  const fontItalicActive = useMemo(() => {
    const sel = nodes.filter((n) => n.selected);
    return sel.length > 0 && sel.every((n) => !!n.data.fontItalic);
  }, [nodes]);

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
        if (e.key === "z") {
          e.preventDefault();
          undo();
        }
        if (e.key === "y") {
          e.preventDefault();
          redo();
        }
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
          snapshot();
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
    snapshot();
    const deletedIds = new Set(nodesRef.current.filter((n) => n.selected).map((n) => n.id));
    setNodes((nds) => nds.filter((n) => !n.selected));
    // Remove selected edges AND any edges connected to deleted nodes
    setEdges((eds) => eds.filter((e) => !e.selected && !deletedIds.has(e.source) && !deletedIds.has(e.target)));
  }, [snapshot, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      snapshot();
      const edge: Edge = {
        ...connection,
        id: nextEdgeId(),
        type: "smoothstep",
        style: { strokeWidth: 2, stroke: EDGE_STROKE },
        markerEnd: EDGE_MARKER_BASE,
      };
      setEdges((eds) => [...eds, edge]);
    },
    [snapshot, setEdges]
  );

  const onEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      const label = window.prompt("Edge label:", (edge.label as string) || "");
      if (label !== null) {
        snapshot();
        setEdges((eds) =>
          eds.map((e) => (e.id === edge.id ? { ...e, label } : e))
        );
      }
    },
    [snapshot, setEdges]
  );

  const handleAddShape = useCallback(
    (shape: ShapeType) => {
      snapshot();
      const defaults = shapeDefaults[shape];
      const raw = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const position = { x: snapTo(raw.x), y: snapTo(raw.y) };
      const newNode: Node<ShapeNodeData> = {
        id: nextId(),
        type: shape,
        position,
        data: {
          label: "",
          fillColor,
          borderColor,
          textAlign,
          textColor,
        },
        style: { width: defaults.width, height: defaults.height },
        width: defaults.width,
        height: defaults.height,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [snapshot, fillColor, borderColor, textAlign, textColor, screenToFlowPosition, setNodes]
  );

  const handleGeneratePondGrid = useCallback(() => {
    snapshot();
    const PILL_W = 200, PILL_H = 40;
    const COL_GAP = 20, ROW_GAP = 15;
    const COLS = 2;
    const newNodes: Node<ShapeNodeData>[] = [];
    for (let i = 0; i < 100; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = col * (PILL_W + COL_GAP);
      const y = row * (PILL_H + ROW_GAP);
      newNodes.push({
        id: nextId(),
        type: "pill",
        position: { x, y },
        data: {
          label: String(i + 1),
          fillColor: "#d1fae5",
          borderColor: "#059669",
          textAlign: "center",
          textColor: "#111827",
          equipmentTypeId: "raceway-pond",
        },
        style: { width: PILL_W, height: PILL_H },
        width: PILL_W,
        height: PILL_H,
      });
    }
    setNodes((nds) => [...nds, ...newNodes]);
  }, [snapshot, setNodes]);

  const handleRotate = useCallback((delta: 90 | -90) => {
    snapshot();
    setNodes((nds) => {
      const selected = nds.filter((n) => n.selected);
      if (selected.length === 0) return nds;

      // Compute group bounding box center for multi-select group rotation
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of selected) {
        const w = n.width ?? (typeof n.style?.width === "number" ? n.style.width : 180);
        const h = n.height ?? (typeof n.style?.height === "number" ? n.style.height : 60);
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + w);
        maxY = Math.max(maxY, n.position.y + h);
      }
      const groupCx = (minX + maxX) / 2;
      const groupCy = (minY + maxY) / 2;

      return nds.map((n) => {
        if (!n.selected) return n;

        const w = n.width ?? (typeof n.style?.width === "number" ? n.style.width : 180);
        const h = n.height ?? (typeof n.style?.height === "number" ? n.style.height : 60);

        // Swap width/height when crossing between horizontal (0°/180°) and vertical (90°/270°)
        const current = (n.data.rotation as number) || 0;
        const next = ((current + delta) % 360 + 360) % 360;
        const wasVertical = current === 90 || current === 270;
        const willBeVertical = next === 90 || next === 270;
        const shouldSwap = wasVertical !== willBeVertical;
        const newW = shouldSwap ? h : w;
        const newH = shouldSwap ? w : h;

        // Rotate this node's center around the group center
        const nodeCx = n.position.x + w / 2;
        const nodeCy = n.position.y + h / 2;
        const dx = nodeCx - groupCx;
        const dy = nodeCy - groupCy;
        const rad = (delta * Math.PI) / 180;
        const cos = Math.round(Math.cos(rad)); // ±1 or 0 for 90° increments
        const sin = Math.round(Math.sin(rad));
        const rotatedCx = groupCx + dx * cos - dy * sin;
        const rotatedCy = groupCy + dx * sin + dy * cos;

        const newX = snapTo(rotatedCx - newW / 2);
        const newY = snapTo(rotatedCy - newH / 2);

        return {
          ...n,
          position: { x: newX, y: newY },
          data: { ...n.data, rotation: next },
          width: newW,
          height: newH,
          style: { ...n.style, width: newW, height: newH },
        };
      });
    });
  }, [snapshot, setNodes]);

  const handleAddSection = useCallback(() => {
    snapshot();
    const raw = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const cx = snapTo(raw.x);
    const cy = snapTo(raw.y);

    // Container rectangle: transparent fill, gray dashed border, 600×400
    const containerW = 600, containerH = 400;
    const containerId = nextId();
    const containerNode: Node<ShapeNodeData> = {
      id: containerId,
      type: "rectangle",
      position: { x: cx - containerW / 2, y: cy - containerH / 2 },
      data: {
        label: "",
        fillColor: "transparent",
        borderColor: "#9ca3af",
        borderDashed: true,
        textAlign: "center",
        textColor: "#111827",
      },
      style: { width: containerW, height: containerH },
      width: containerW,
      height: containerH,
    };

    // Section label: bold text, positioned below-left of container
    const labelId = nextId();
    const labelNode: Node<ShapeNodeData> = {
      id: labelId,
      type: "rectangle",
      position: { x: cx - containerW / 2, y: cy + containerH / 2 },
      data: {
        label: "New Section",
        fillColor: "transparent",
        borderColor: "none",
        textAlign: "left",
        textColor: "#111827",
        fontBold: true,
      },
      style: { width: 180, height: 30 },
      width: 180,
      height: 30,
    };

    // Container goes to back (inserted first), label after
    setNodes((nds) => [containerNode, ...nds, labelNode]);
  }, [snapshot, screenToFlowPosition, setNodes]);

  const handleFillColorChange = useCallback(
    (color: string) => {
      snapshot();
      setFillColor(color);
      setNodes((nds) =>
        nds.map((n) =>
          n.selected ? { ...n, data: { ...n.data, fillColor: color } } : n
        )
      );
    },
    [snapshot, setNodes]
  );

  const handleBorderColorChange = useCallback(
    (color: string) => {
      snapshot();
      setBorderColor(color);
      setNodes((nds) =>
        nds.map((n) =>
          n.selected ? { ...n, data: { ...n.data, borderColor: color } } : n
        )
      );
    },
    [snapshot, setNodes]
  );

  const handleTextAlignChange = useCallback((align: "left" | "center" | "right") => {
    snapshot();
    setTextAlign(align);
    setNodes((nds) =>
      nds.map((n) =>
        n.selected ? { ...n, data: { ...n.data, textAlign: align } } : n
      )
    );
  }, [snapshot, setNodes]);

  const handleTextColorChange = useCallback((color: string) => {
    snapshot();
    setTextColor(color);
    setNodes((nds) =>
      nds.map((n) =>
        n.selected ? { ...n, data: { ...n.data, textColor: color } } : n
      )
    );
  }, [snapshot, setNodes]);

  const handleFontBoldChange = useCallback((value: boolean) => {
    snapshot();
    setNodes((nds) =>
      nds.map((n) =>
        n.selected ? { ...n, data: { ...n.data, fontBold: value || undefined } } : n
      )
    );
  }, [snapshot, setNodes]);

  const handleFontItalicChange = useCallback((value: boolean) => {
    snapshot();
    setNodes((nds) =>
      nds.map((n) =>
        n.selected ? { ...n, data: { ...n.data, fontItalic: value || undefined } } : n
      )
    );
  }, [snapshot, setNodes]);

  const handleDashedChange = useCallback((value: boolean) => {
    snapshot();
    setEdges((eds) => eds.map((e) =>
      e.selected
        ? { ...e, style: { ...e.style, strokeDasharray: value ? EDGE_DASH : undefined } }
        : e
    ));
  }, [snapshot, setEdges]);

  const handleBorderDashedChange = useCallback((value: boolean) => {
    snapshot();
    setNodes((nds) => nds.map((n) =>
      n.selected
        ? { ...n, data: { ...n.data, borderDashed: value || undefined } }
        : n
    ));
  }, [snapshot, setNodes]);

  const handleMoveToBack = useCallback(() => {
    snapshot();
    setNodes((nds) => {
      const selected = nds.filter((n) => n.selected);
      const rest = nds.filter((n) => !n.selected);
      return [...selected, ...rest];
    });
  }, [snapshot, setNodes]);

  const handleMoveToFront = useCallback(() => {
    snapshot();
    setNodes((nds) => {
      const selected = nds.filter((n) => n.selected);
      const rest = nds.filter((n) => !n.selected);
      return [...rest, ...selected];
    });
  }, [snapshot, setNodes]);

  const handleNew = useCallback(() => {
    const name = window.prompt("Diagram name:", "untitled");
    if (name !== null) {
      setDiagramName(name);
      setNodes([]);
      setEdges([]);
    }
  }, [setNodes, setEdges]);

  const handleSave = useCallback(() => {
    const name = diagramName || "diagram";
    if (savedNames.current.has(name)) {
      const ok = window.confirm(`"${name}.json" was already saved this session. Save again and overwrite?`);
      if (!ok) return;
    }
    savedNames.current.add(name);
    const viewport = getViewport();
    const payload = {
      name: diagramName,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      viewport,
      nodes: nodes.map((n) => {
        // n.width/n.height are authoritative (set by NodeResizer via applyNodeChanges).
        // n.style.width/height may be stale (creation value) if the node was directly resized.
        const w = n.width ?? (typeof n.style?.width === "number" ? n.style.width : undefined);
        const h = n.height ?? (typeof n.style?.height === "number" ? n.style.height : undefined);
        return {
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
          style: { ...n.style, ...(w != null ? { width: w } : {}), ...(h != null ? { height: h } : {}) },
          width: w,
          height: h,
        };
      }),
      version: 2,
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
        type: e.type,
        style: e.style,
        data: e.data,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.json`;
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
              style: { strokeWidth: 2, stroke: EDGE_STROKE, ...e.style },
              markerEnd: EDGE_MARKER_BASE,
              data: e.data,
            }))
          );
          historyRef.current = [];
          futureRef.current = [];
          setCanUndo(false);
          setCanRedo(false);
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

  const diagramContextValue = useMemo(
    () => ({ snapGrid: SNAP, onResizeStart: handleResizeStart, onResizeDelta: handleResizeDelta }),
    [handleResizeStart, handleResizeDelta]
  );

  return (
    <DiagramContext.Provider value={diagramContextValue}>
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <Toolbar
        diagramName={diagramName}
        onNameChange={setDiagramName}
        fillColor={fillColor}
        borderColor={borderColor}
        onFillColorChange={handleFillColorChange}
        onBorderColorChange={handleBorderColorChange}
        textAlign={textAlign}
        onTextAlignChange={handleTextAlignChange}
        textColor={textColor}
        onTextColorChange={handleTextColorChange}
        fontBold={fontBoldActive}
        onFontBoldChange={handleFontBoldChange}
        fontItalic={fontItalicActive}
        onFontItalicChange={handleFontItalicChange}
        onNew={handleNew}
        onSave={handleSave}
        onLoad={handleLoad}
        onExportSVG={handleExportSVG}
        onAddShape={handleAddShape}
        onDeleteSelected={deleteSelected}
        dashed={edgeDashedActive}
        onDashedChange={handleDashedChange}
        borderDashed={borderDashedActive}
        onBorderDashedChange={handleBorderDashedChange}
        onMoveToBack={handleMoveToBack}
        onMoveToFront={handleMoveToFront}
        onRotate={handleRotate}
        onGeneratePondGrid={handleGeneratePondGrid}
      />
      <div style={{ display: "flex", width: "100%", height: "calc(100vh - 49px)" }}>
        <div style={{ flex: 1 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onNodeDragStart={snapshotOnDragStart}
            onNodeDragStop={onDragStop}
            onSelectionDragStart={snapshotOnDragStart}
            onSelectionDragStop={onDragStop}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionMode={ConnectionMode.Loose}
            snapToGrid
            snapGrid={[SNAP, SNAP]}
            fitView
            deleteKeyCode={null}
            selectionOnDrag
            selectionMode={SelectionMode.Full}
            panOnDrag={[1, 2]}
          >
            <Background gap={SNAP} />
            <MiniMap
              position="bottom-right"
              style={{ width: 160, height: 120 }}
            />
          </ReactFlow>
        </div>
        <div style={{ width: 256, flexShrink: 0 }}>
          <InspectorPanel
            nodes={nodes}
            edges={edges}
            setNodes={setNodes}
            setEdges={setEdges}
            snapshot={snapshot}
            addSection={handleAddSection}
          />
        </div>
      </div>
    </div>
    </DiagramContext.Provider>
  );
}

export default function DiagramEditor() {
  return (
    <ReactFlowProvider>
      <DiagramEditorInner />
    </ReactFlowProvider>
  );
}
