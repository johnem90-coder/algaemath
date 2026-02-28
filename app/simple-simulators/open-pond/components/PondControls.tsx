"use client";

import { Slider } from "@/components/ui/slider";
import WindIndicator from "./WindIndicator";

const COMPASS_DIRS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

function degToCompass(d: number): string {
  return COMPASS_DIRS[Math.round(d / 22.5) % 16];
}

const sliderClass =
  "[&_[data-slot=slider-range]]:bg-[hsl(var(--accent-science))] [&_[data-slot=slider-thumb]]:border-[hsl(var(--accent-science))]";

interface PondControlsProps {
  density: number;
  timeOfDay: number;
  windDirection: number;
  onDensityChange: (v: number) => void;
  onTimeChange: (v: number) => void;
  onWindDirectionChange: (v: number) => void;
}

export default function PondControls({
  density,
  timeOfDay,
  windDirection,
  onDensityChange,
  onTimeChange,
  onWindDirectionChange,
}: PondControlsProps) {
  const hh = Math.floor(timeOfDay);
  const mm = Math.round((timeOfDay - hh) * 60);
  const timeStr = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

  return (
    <div className="space-y-5 rounded-xl border p-5">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Pond Controls
      </h3>

      {/* Biomass Density */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">
            Biomass Density
          </label>
          <span className="font-mono text-xs font-semibold tabular-nums text-[hsl(var(--accent-science))]">
            {density.toFixed(2)} g/L
          </span>
        </div>
        <Slider
          min={0.05}
          max={4.0}
          step={0.05}
          value={[density]}
          onValueChange={([v]) => onDensityChange(v)}
          className={sliderClass}
        />
      </div>

      {/* Time of Day */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Time of Day</label>
          <span className="font-mono text-xs font-semibold tabular-nums">
            {timeStr}
          </span>
        </div>
        <Slider
          min={0}
          max={24}
          step={0.1}
          value={[timeOfDay]}
          onValueChange={([v]) => onTimeChange(v)}
          className={sliderClass}
        />
      </div>

      {/* Wind Direction */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">
            Wind Direction
          </label>
          <div className="flex items-center gap-2">
            <WindIndicator degrees={windDirection} />
            <span className="font-mono text-xs font-semibold tabular-nums">
              {degToCompass(windDirection)} {windDirection}&deg;
            </span>
          </div>
        </div>
        <Slider
          min={0}
          max={355}
          step={5}
          value={[windDirection]}
          onValueChange={([v]) => onWindDirectionChange(v)}
          className={sliderClass}
        />
      </div>
    </div>
  );
}
