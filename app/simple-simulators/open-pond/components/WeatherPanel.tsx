"use client";

import { Slider } from "@/components/ui/slider";

const sliderClass =
  "[&_[data-slot=slider-range]]:bg-[hsl(var(--accent-science))] [&_[data-slot=slider-thumb]]:border-[hsl(var(--accent-science))]";

interface WeatherPanelProps {
  clouds: number;
  rain: number;
  windSpeed: number;
  onCloudsChange: (v: number) => void;
  onRainChange: (v: number) => void;
  onWindSpeedChange: (v: number) => void;
}

export default function WeatherPanel({
  clouds,
  rain,
  windSpeed,
  onCloudsChange,
  onRainChange,
  onWindSpeedChange,
}: WeatherPanelProps) {
  return (
    <div className="space-y-5 rounded-xl border p-5">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Weather
      </h3>

      {/* Clouds */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Cloud Cover</label>
          <span className="font-mono text-xs font-semibold tabular-nums">
            {clouds === 0 ? "OFF" : `${clouds}%`}
          </span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[clouds]}
          onValueChange={([v]) => onCloudsChange(v)}
          className={sliderClass}
        />
      </div>

      {/* Rain */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Rain</label>
          <span className="font-mono text-xs font-semibold tabular-nums">
            {rain === 0 ? "OFF" : `${rain}%`}
          </span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[rain]}
          onValueChange={([v]) => onRainChange(v)}
          className={sliderClass}
        />
      </div>

      {/* Wind Speed */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Wind Speed</label>
          <span className="font-mono text-xs font-semibold tabular-nums">
            {windSpeed.toFixed(1)} m/s
          </span>
        </div>
        <Slider
          min={0}
          max={15}
          step={0.5}
          value={[windSpeed]}
          onValueChange={([v]) => onWindSpeedChange(v)}
          className={sliderClass}
        />
      </div>
    </div>
  );
}
