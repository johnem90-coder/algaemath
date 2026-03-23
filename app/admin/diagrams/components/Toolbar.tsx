"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { ShapeType } from "./nodes";

const FILL_COLORS = [
  { label: "None", value: "transparent" },
  { label: "White", value: "#ffffff" },
  { label: "Gray", value: "#f3f4f6" },
  { label: "Green", value: "#dcfce7" },
  { label: "Blue", value: "#dbeafe" },
  { label: "Yellow", value: "#fef9c3" },
  { label: "Orange", value: "#ffedd5" },
  { label: "Red", value: "#fee2e2" },
];

const TEXT_COLORS = [
  { label: "Black", value: "#111827" },
  { label: "Gray", value: "#6b7280" },
  { label: "Blue", value: "#2563eb" },
  { label: "Red", value: "#dc2626" },
  { label: "Green", value: "#16a34a" },
];

const BORDER_COLORS = [
  { label: "None", value: "none" },
  { label: "Gray", value: "#6b7280" },
  { label: "Black", value: "#1f2937" },
  { label: "Green", value: "#16a34a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Yellow", value: "#ca8a04" },
  { label: "Orange", value: "#ea580c" },
  { label: "Red", value: "#dc2626" },
];

type ColorPanel = "text" | "fill" | "border" | null;

interface ToolbarProps {
  diagramName: string;
  onNameChange: (name: string) => void;
  fillColor: string;
  borderColor: string;
  onFillColorChange: (color: string) => void;
  onBorderColorChange: (color: string) => void;
  onNew: () => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  onExportSVG: () => void;
  onAddShape: (shape: ShapeType) => void;
  onDeleteSelected: () => void;
  onMoveToBack: () => void;
  onMoveToFront: () => void;
  onRotate: (delta: 90 | -90) => void;
  dashed: boolean;
  onDashedChange: (value: boolean) => void;
  borderDashed: boolean;
  onBorderDashedChange: (value: boolean) => void;
  textAlign: "left" | "center" | "right";
  onTextAlignChange: (align: "left" | "center" | "right") => void;
  textColor: string;
  onTextColorChange: (color: string) => void;
  fontBold: boolean;
  onFontBoldChange: (value: boolean) => void;
  fontItalic: boolean;
  onFontItalicChange: (value: boolean) => void;
  onGeneratePondGrid?: () => void;
}

const shapes: { type: ShapeType; label: string; icon: React.ReactNode }[] = [
  {
    type: "rectangle",
    label: "Rectangle",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="3" width="14" height="10" />
      </svg>
    ),
  },
  {
    type: "roundedRect",
    label: "Rounded",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="3" width="14" height="10" rx="3" />
      </svg>
    ),
  },
  {
    type: "chamferedRect",
    label: "Chamfered",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="4,3 12,3 15,6 15,10 12,13 4,13 1,10 1,6" />
      </svg>
    ),
  },
  {
    type: "pill",
    label: "Pill",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="4" width="14" height="8" rx="4" />
      </svg>
    ),
  },
  {
    type: "diamond",
    label: "Diamond",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="8,1 15,8 8,15 1,8" />
      </svg>
    ),
  },
  {
    type: "triangle",
    label: "Triangle",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="8,2 15,14 1,14" />
      </svg>
    ),
  },
];

function Separator() {
  return <div className="mx-1 h-6 w-px bg-border" />;
}

function ColorSwatch({
  value,
  active,
  onClick,
  label,
  isTransparent,
}: {
  value: string;
  active: boolean;
  onClick: () => void;
  label: string;
  isTransparent?: boolean;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className="h-5 w-5 rounded border"
      style={{
        backgroundColor: isTransparent ? "#ffffff" : value,
        backgroundImage: isTransparent
          ? "linear-gradient(to bottom right, transparent calc(50% - 1px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), transparent calc(50% + 1px))"
          : undefined,
        outline: active ? "2px solid #2563eb" : "none",
        outlineOffset: 1,
      }}
    />
  );
}

export default function Toolbar({
  diagramName,
  onNameChange,
  fillColor,
  borderColor,
  onFillColorChange,
  onBorderColorChange,
  onNew,
  onSave,
  onLoad,
  onExportSVG,
  onAddShape,
  onDeleteSelected: _onDeleteSelected,
  onMoveToBack,
  onMoveToFront,
  dashed,
  onDashedChange,
  borderDashed,
  onBorderDashedChange,
  textAlign,
  onTextAlignChange,
  textColor,
  onTextColorChange,
  fontBold,
  onFontBoldChange,
  fontItalic,
  onFontItalicChange,
  onRotate,
  onGeneratePondGrid,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [fileMenuPos, setFileMenuPos] = useState({ top: 0, left: 0 });
  const fileButtonRef = useRef<HTMLButtonElement>(null);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const [colorPanel, setColorPanel] = useState<ColorPanel>(null);

  useEffect(() => {
    if (!fileMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node) &&
        fileButtonRef.current && !fileButtonRef.current.contains(e.target as Node)
      ) {
        setFileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [fileMenuOpen]);

  const openFileMenu = useCallback(() => {
    if (fileButtonRef.current) {
      const rect = fileButtonRef.current.getBoundingClientRect();
      setFileMenuPos({ top: rect.bottom + 4, left: rect.left });
    }
    setFileMenuOpen((o) => !o);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onLoad(file);
        e.target.value = "";
      }
    },
    [onLoad]
  );

  const toggleColorPanel = (panel: ColorPanel) =>
    setColorPanel((cur) => (cur === panel ? null : panel));

  const dashActive = dashed || borderDashed;
  const handleDashToggle = () => {
    const next = !dashActive;
    onDashedChange(next);
    onBorderDashedChange(next);
  };

  return (
    <div className="flex items-center gap-2 border-b bg-white px-3 py-2 shadow-sm overflow-x-auto">
      {/* Diagram name */}
      <input
        type="text"
        value={diagramName}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Diagram name"
        className="h-8 w-44 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      <Separator />

      {/* File dropdown */}
      <Button
        ref={fileButtonRef}
        variant="outline"
        size="sm"
        onClick={openFileMenu}
      >
        File ▾
      </Button>
      {fileMenuOpen && (
        <div
          ref={fileMenuRef}
          style={{
            position: "fixed",
            top: fileMenuPos.top,
            left: fileMenuPos.left,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            minWidth: 140,
            zIndex: 1000,
          }}
        >
          {[
            { label: "New", action: () => { onNew(); setFileMenuOpen(false); } },
            { label: "Save (Ctrl+S)", action: () => { onSave(); setFileMenuOpen(false); } },
            { label: "Load…", action: () => { fileInputRef.current?.click(); setFileMenuOpen(false); } },
            { label: "Export SVG", action: () => { onExportSVG(); setFileMenuOpen(false); } },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "7px 14px",
                fontSize: 13,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <Separator />

      {/* Shape buttons */}
      {shapes.map((s) => (
        <Button
          key={s.type}
          variant="outline"
          size="icon-sm"
          title={s.label}
          onClick={() => onAddShape(s.type)}
        >
          {s.icon}
        </Button>
      ))}

      <Separator />

      {/* Dash edge/border (combined) */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleDashToggle}
        style={dashActive ? { background: "#dbeafe", borderColor: "#2563eb" } : {}}
        title="Toggle dashed on selected edges and node borders"
      >
        Dash
      </Button>

      <Separator />

      {/* Text alignment */}
      {(["left", "center", "right"] as const).map((align) => (
        <Button
          key={align}
          variant="outline"
          size="icon-sm"
          title={`Align ${align}`}
          onClick={() => onTextAlignChange(align)}
          style={textAlign === align ? { background: "#dbeafe", borderColor: "#2563eb" } : {}}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {align === "left" && (<><line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="7" x2="9" y2="7"/><line x1="1" y1="11" x2="11" y2="11"/></>)}
            {align === "center" && (<><line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="7" x2="11" y2="7"/><line x1="2" y1="11" x2="12" y2="11"/></>)}
            {align === "right" && (<><line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="7" x2="13" y2="7"/><line x1="3" y1="11" x2="13" y2="11"/></>)}
          </svg>
        </Button>
      ))}

      <Separator />

      {/* Text formatting */}
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onFontBoldChange(!fontBold)}
        style={fontBold ? { background: "#dbeafe", borderColor: "#2563eb" } : {}}
        title="Bold"
      >
        <span style={{ fontWeight: "bold", fontSize: 13 }}>B</span>
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onFontItalicChange(!fontItalic)}
        style={fontItalic ? { background: "#dbeafe", borderColor: "#2563eb" } : {}}
        title="Italic"
      >
        <span style={{ fontStyle: "italic", fontSize: 13 }}>I</span>
      </Button>

      <Separator />

      {/* Color panel toggles */}
      {(["text", "fill", "border"] as const).map((panel) => (
        <Button
          key={panel}
          variant="outline"
          size="sm"
          onClick={() => toggleColorPanel(panel)}
          style={colorPanel === panel ? { background: "#dbeafe", borderColor: "#2563eb" } : {}}
          title={`${panel.charAt(0).toUpperCase() + panel.slice(1)} color`}
        >
          {panel.charAt(0).toUpperCase() + panel.slice(1)}
        </Button>
      ))}

      {/* Active color panel swatches */}
      {colorPanel === "text" && (
        <>
          <Separator />
          <div className="flex gap-0.5 items-center">
            {TEXT_COLORS.map((c) => (
              <ColorSwatch
                key={c.value}
                value={c.value}
                label={c.label}
                active={textColor === c.value}
                onClick={() => onTextColorChange(c.value)}
              />
            ))}
            <input
              type="color"
              value={textColor}
              onChange={(e) => onTextColorChange(e.target.value)}
              className="h-5 w-5 cursor-pointer rounded border p-0"
              title="Custom text color"
            />
          </div>
        </>
      )}

      {colorPanel === "fill" && (
        <>
          <Separator />
          <div className="flex gap-0.5 items-center">
            {FILL_COLORS.map((c) => (
              <ColorSwatch
                key={c.value}
                value={c.value}
                label={c.label}
                active={fillColor === c.value}
                onClick={() => onFillColorChange(c.value)}
                isTransparent={c.value === "transparent"}
              />
            ))}
            <input
              type="color"
              value={fillColor}
              onChange={(e) => onFillColorChange(e.target.value)}
              className="h-5 w-5 cursor-pointer rounded border p-0"
              title="Custom fill color"
            />
          </div>
        </>
      )}

      {colorPanel === "border" && (
        <>
          <Separator />
          <div className="flex gap-0.5 items-center">
            {BORDER_COLORS.map((c) => (
              <ColorSwatch
                key={c.value}
                value={c.value}
                label={c.label}
                active={borderColor === c.value}
                onClick={() => onBorderColorChange(c.value)}
                isTransparent={c.value === "none"}
              />
            ))}
            <input
              type="color"
              value={borderColor}
              onChange={(e) => onBorderColorChange(e.target.value)}
              className="h-5 w-5 cursor-pointer rounded border p-0"
              title="Custom border color"
            />
          </div>
        </>
      )}

      <Separator />

      {/* Rotate */}
      <Button variant="outline" size="icon-sm" onClick={() => onRotate(-90)} title="Rotate 90° counter-clockwise">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 7a5 5 0 1 0 5-5H4" />
          <polyline points="4,0 4,4 8,4" transform="scale(-1,1) translate(-8,0)" />
        </svg>
      </Button>
      <Button variant="outline" size="icon-sm" onClick={() => onRotate(90)} title="Rotate 90° clockwise">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 7a5 5 0 1 1-5-5h3" />
          <polyline points="10,0 10,4 6,4" />
        </svg>
      </Button>

      <Separator />

      {/* Layer order */}
      <Button variant="outline" size="sm" onClick={onMoveToBack} title="Move selected to back">
        To back
      </Button>
      <Button variant="outline" size="sm" onClick={onMoveToFront} title="Move selected to front">
        To front
      </Button>

      {/* Generate pond grid */}
      {onGeneratePondGrid && (
        <>
          <Separator />
          <Button variant="outline" size="sm" onClick={onGeneratePondGrid} title="Auto-place 100 raceway pond pills in a 2-column grid">
            Pond Grid
          </Button>
        </>
      )}
    </div>
  );
}
