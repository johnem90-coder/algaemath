"use client";

import type { OpenPondTimestep } from "@/lib/simulation/simple-outdoor/types";

const COMPASS_DIRS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

function degToCompass(d: number): string {
  return COMPASS_DIRS[Math.round(d / 22.5) % 16];
}

interface DataStripProps {
  density: number;
  timeOfDay: number;
  windSpeed: number;
  windDirection: number;
  clouds: number;
  simTimestep: OpenPondTimestep | null;
}

function DataCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-xl font-bold tabular-nums leading-none"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">{unit}</div>
    </div>
  );
}

export default function DataStrip({
  density,
  timeOfDay,
  windSpeed,
  windDirection,
  clouds,
  simTimestep,
}: DataStripProps) {
  // Use simulation values when available, fall back to simple estimates
  const irradiance = simTimestep
    ? Math.round(simTimestep.par_avg_culture)
    : 0;
  const pondTemp = simTimestep
    ? simTimestep.pond_temperature
    : 0;
  const growthRate = simTimestep
    ? simTimestep.net_growth_rate
    : 0;
  const productivity = simTimestep
    ? simTimestep.productivity_areal
    : 0;

  const hasData = simTimestep !== null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <DataCard
        label="PAR (culture avg)"
        value={hasData ? irradiance.toString() : "—"}
        unit={"\u00B5mol/m\u00B2/s"}
        color="hsl(30, 65%, 42%)"
      />
      <DataCard
        label="Pond Temp"
        value={hasData ? pondTemp.toFixed(1) : "—"}
        unit={"\u00B0C"}
        color="hsl(0, 60%, 45%)"
      />
      <DataCard
        label="Density"
        value={density.toFixed(2)}
        unit="g/L"
        color="hsl(145, 45%, 32%)"
      />
      <DataCard
        label="Growth Rate"
        value={hasData ? growthRate.toFixed(3) : "—"}
        unit="/day"
        color="hsl(145, 45%, 32%)"
      />
      <DataCard
        label="Productivity"
        value={hasData ? productivity.toFixed(1) : "—"}
        unit="g/m\u00B2/day"
        color="hsl(200, 55%, 40%)"
      />
      <DataCard
        label="Wind"
        value={windSpeed.toFixed(1)}
        unit={`m/s  ${degToCompass(windDirection)}`}
        color="hsl(220, 65%, 37%)"
      />
    </div>
  );
}
