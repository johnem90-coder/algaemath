"use client";

const COMPASS_DIRS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

function degToCompass(d: number): string {
  return COMPASS_DIRS[Math.round(d / 22.5) % 16];
}

function computeIrradiance(hour: number, clouds: number): number {
  if (hour < 6 || hour > 18) return 0;
  const elev = Math.sin(((hour - 6) / 12) * Math.PI);
  const clearSky = elev * 2000;
  return Math.round(clearSky * (1 - clouds * 0.007));
}

function computeCultureTemp(hour: number, clouds: number): number {
  const baseTemp = 22;
  const solarGain = hour >= 6 && hour <= 18
    ? Math.sin(((hour - 6) / 12) * Math.PI) * 12
    : 0;
  const cloudCooling = clouds * 0.03;
  return baseTemp + solarGain - cloudCooling;
}

interface DataStripProps {
  density: number;
  timeOfDay: number;
  windSpeed: number;
  windDirection: number;
  clouds: number;
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
}: DataStripProps) {
  const irradiance = computeIrradiance(timeOfDay, clouds);
  const cultureTemp = computeCultureTemp(timeOfDay, clouds);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <DataCard
        label="Irradiance"
        value={irradiance.toString()}
        unit={"\u00B5mol m\u00B2/s"}
        color="hsl(30, 65%, 42%)"
      />
      <DataCard
        label="Wind"
        value={windSpeed.toFixed(1)}
        unit={`m/s  ${degToCompass(windDirection)}`}
        color="hsl(220, 65%, 37%)"
      />
      <DataCard
        label="Culture Temp"
        value={cultureTemp.toFixed(1)}
        unit={"\u00B0C"}
        color="hsl(30, 65%, 42%)"
      />
      <DataCard
        label="Density"
        value={density.toFixed(2)}
        unit="g/L"
        color="hsl(145, 45%, 32%)"
      />
    </div>
  );
}
