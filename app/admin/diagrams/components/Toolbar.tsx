"use client";

import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { ShapeType } from "./nodes";

const FILL_COLORS = [
  { label: "White", value: "#ffffff" },
  { label: "Gray", value: "#f3f4f6" },
  { label: "Green", value: "#dcfce7" },
  { label: "Blue", value: "#dbeafe" },
  { label: "Yellow", value: "#fef9c3" },
  { label: "Orange", value: "#ffedd5" },
  { label: "Red", value: "#fee2e2" },
];

const BORDER_COLORS = [
  { label: "Gray", value: "#6b7280" },
  { label: "Black", value: "#1f2937" },
  { label: "Green", value: "#16a34a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Yellow", value: "#ca8a04" },
  { label: "Orange", value: "#ea580c" },
  { label: "Red", value: "#dc2626" },
];

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
    type: "diamond",
    label: "Diamond",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 1 L15 8 L8 15 L1 8 Z" />
      </svg>
    ),
  },
  {
    type: "circle",
    label: "Circle",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6.5" />
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
];

function Separator() {
  return <div className="mx-1 h-6 w-px bg-border" />;
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
  onDeleteSelected,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="flex items-center gap-2 border-b bg-white px-3 py-2 shadow-sm">
      {/* Diagram name */}
      <input
        type="text"
        value={diagramName}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Diagram name"
        className="h-8 w-44 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      <Separator />

      {/* File operations */}
      <Button variant="outline" size="sm" onClick={onNew}>
        New
      </Button>
      <Button variant="outline" size="sm" onClick={onSave}>
        Save
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
      >
        Load
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
      <Button variant="outline" size="sm" onClick={onExportSVG}>
        Export SVG
      </Button>

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

      {/* Fill color */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Fill</span>
        <div className="flex gap-0.5">
          {FILL_COLORS.map((c) => (
            <button
              key={c.value}
              title={c.label}
              onClick={() => onFillColorChange(c.value)}
              className="h-5 w-5 rounded border"
              style={{
                backgroundColor: c.value,
                outline: fillColor === c.value ? "2px solid #2563eb" : "none",
                outlineOffset: 1,
              }}
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
      </div>

      <Separator />

      {/* Border color */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Border</span>
        <div className="flex gap-0.5">
          {BORDER_COLORS.map((c) => (
            <button
              key={c.value}
              title={c.label}
              onClick={() => onBorderColorChange(c.value)}
              className="h-5 w-5 rounded border"
              style={{
                backgroundColor: c.value,
                outline: borderColor === c.value ? "2px solid #2563eb" : "none",
                outlineOffset: 1,
              }}
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
      </div>

      <Separator />

      {/* Delete */}
      <Button variant="destructive" size="sm" onClick={onDeleteSelected}>
        Delete
      </Button>
    </div>
  );
}
