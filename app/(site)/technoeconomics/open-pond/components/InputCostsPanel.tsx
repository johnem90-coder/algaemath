"use client";

import { useEffect } from "react";
import type { TEAResult } from "@/lib/technoeconomics/open-pond";
import { InputVariablesTable } from "./InputVariablesTable";

interface Props {
  isOpen: boolean;
  result: TEAResult;
  onToggle: () => void;
}

export function InputCostsPanel({ isOpen, result, onToggle }: Props) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onToggle();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onToggle]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={onToggle}
        />
      )}

      {/* Panel + attached tab — both slide together */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-[calc(-100%+2rem)]"
        }`}
        style={{ width: "min(30vw, 420px)" }}
      >
        {/* Tab — attached to right edge of panel */}
        <button
          onClick={onToggle}
          className="absolute right-0 top-1/2 translate-x-[calc(100%-1px)] -translate-y-1/2 z-[51] flex items-center justify-center bg-background border border-l-0 rounded-r-md shadow-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          style={{ writingMode: "vertical-rl", padding: "12px 4px" }}
          aria-label={isOpen ? "Close system inputs" : "Open system inputs"}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`mb-1 transition-transform duration-300 ${isOpen ? "" : "rotate-180"}`}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="text-xs font-medium tracking-wide whitespace-nowrap">
            System Inputs
          </span>
        </button>

        {/* Panel body */}
        <div className="h-full w-full bg-background border-r shadow-xl overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-4">
            <h3 className="text-sm font-medium tracking-tight">System Inputs</h3>
            <button
              onClick={onToggle}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close panel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-4">
            <InputVariablesTable result={result} />
          </div>
        </div>
      </div>
    </>
  );
}
