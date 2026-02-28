"use client";

import { useEffect, useRef } from "react";
import type { PondAPI } from "@/lib/simulation/pond-types";

interface PondCanvasProps {
  onPondReady: (api: PondAPI) => void;
}

export default function PondCanvas({ onPondReady }: PondCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pondRef = useRef<PondAPI | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let disposed = false;

    import("@/lib/simulation/pond-renderer").then(({ initPond }) => {
      if (disposed) return;
      const { width, height } = container.getBoundingClientRect();
      const api = initPond({ canvas, width, height });
      pondRef.current = api;
      onPondReady(api);
    });

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !pondRef.current) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        pondRef.current.resize(width, height);
      }
    });
    observer.observe(container);

    return () => {
      disposed = true;
      observer.disconnect();
      pondRef.current?.dispose();
      pondRef.current = null;
    };
  }, [onPondReady]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden rounded-xl border bg-[#dde8ee]"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
