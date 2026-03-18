"use client";

import { useEffect } from "react";
import type { TEAResult } from "@/lib/technoeconomics/open-pond";

export interface PanelSelection {
  sectionId: string; // e.g. "inputs", "harvesting", or "all"
  costCategory: string; // e.g. "energy", "equipment_purchase", or "all"
}

const SECTION_LABELS: Record<string, string> = {
  inputs: "Inputs (Water Treatment & Delivery)",
  inoculum: "Inoculum (Scaling Ponds)",
  biomass: "Biomass (Growth Ponds)",
  harvesting: "Harvesting (Dewatering)",
  drying: "Drying (Final Processing)",
  all: "All Sections",
};

const CATEGORY_LABELS: Record<string, string> = {
  equipment_purchase: "Equipment Purchase",
  install_engr_other: "Installation, Engineering & Other",
  capital_cost: "Total CAPEX",
  materials_cost: "Materials / Inputs",
  energy_cost: "Energy",
  maintenance_cost: "Maintenance",
  labor_cost: "Labor",
  operating_cost: "Total OPEX",
  all: "All Cost Categories",
};

interface Props {
  selection: PanelSelection | null;
  isOpen: boolean;
  result: TEAResult;
  onToggle: () => void;
}

export function SectionDetailPanel({ selection, isOpen, result, onToggle }: Props) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onToggle();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onToggle]);

  const sectionLabel = selection ? (SECTION_LABELS[selection.sectionId] ?? selection.sectionId) : "";
  const categoryLabel = selection ? (CATEGORY_LABELS[selection.costCategory] ?? selection.costCategory) : "";

  const title = selection
    ? selection.sectionId === "all"
      ? categoryLabel
      : selection.costCategory === "all"
        ? sectionLabel
        : `${sectionLabel} — ${categoryLabel}`
    : "Section Details";

  return (
    <>
      {/* Backdrop — only when open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={onToggle}
        />
      )}

      {/* Panel + attached tab — both slide together */}
      <div
        className={`fixed inset-y-0 right-0 z-50 transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-[calc(100%-2rem)]"
        }`}
        style={{ width: "min(50vw, 640px)" }}
      >
        {/* Tab — attached to left edge of panel */}
        <button
          onClick={onToggle}
          className="absolute left-0 top-1/2 -translate-x-[calc(100%-1px)] -translate-y-1/2 z-[51] flex items-center justify-center bg-background border border-r-0 rounded-l-md shadow-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          style={{ writingMode: "vertical-rl", padding: "12px 4px" }}
          aria-label={isOpen ? "Close economic details" : "Open economic details"}
        >
          <span className="text-xs font-medium tracking-wide whitespace-nowrap">
            Economic Details
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`mt-1 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Panel body */}
        <div className="h-full w-full bg-background border-l shadow-xl overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-4">
            <h3 className="text-lg font-medium tracking-tight pr-4">{title}</h3>
            <button
              onClick={onToggle}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close panel"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-8">
            {selection ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Detailed breakdown coming soon
                </p>
                <p className="text-xs text-muted-foreground">
                  Section: <span className="font-mono">{selection.sectionId}</span>
                  {" · "}
                  Category: <span className="font-mono">{selection.costCategory}</span>
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Click a cell in the Sections Overview table to view its detailed breakdown here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
