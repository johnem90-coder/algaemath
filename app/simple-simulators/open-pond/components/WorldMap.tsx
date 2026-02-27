"use client";

import { useRef, useCallback, useState } from "react";
import { WORLD_LAND_PATH } from "@/lib/simulation/world-map-path";
import type { SeasonWeather } from "@/lib/simulation/weather-types";

export interface City {
  name: string;
  lat: number;
  lng: number;
  labelLeft?: boolean;
}

export type Season = "summer" | "autumn" | "winter" | "spring";

interface SeasonTheme {
  label: string;
  ocean: string;
  land: string;
  landStroke: string;
  dot: string;
  dotHover: string;
  dotHoverStroke: string;
  label_: string;
  labelHover: string;
  bg: string;
}

const SEASON_THEMES: Record<Season, SeasonTheme> = {
  summer: {
    label: "Summer",
    ocean: "#d6eaf8",
    land: "#8aba78",
    landStroke: "#8aba78",
    dot: "hsl(145, 45%, 42%)",
    dotHover: "hsl(145, 55%, 35%)",
    dotHoverStroke: "hsl(145, 50%, 50%)",
    label_: "rgba(0,0,0,0.55)",
    labelHover: "hsl(145, 40%, 25%)",
    bg: "#d6eaf8",
  },
  autumn: {
    label: "Autumn",
    ocean: "#e8e0d4",
    land: "#c4a04a",
    landStroke: "#c4a04a",
    dot: "hsl(30, 60%, 40%)",
    dotHover: "hsl(30, 70%, 32%)",
    dotHoverStroke: "hsl(30, 55%, 55%)",
    label_: "rgba(60,40,0,0.55)",
    labelHover: "hsl(30, 50%, 22%)",
    bg: "#e8e0d4",
  },
  winter: {
    label: "Winter",
    ocean: "#dce4ec",
    land: "#a8b8c0",
    landStroke: "#a8b8c0",
    dot: "hsl(210, 20%, 45%)",
    dotHover: "hsl(210, 30%, 35%)",
    dotHoverStroke: "hsl(210, 25%, 58%)",
    label_: "rgba(30,40,60,0.55)",
    labelHover: "hsl(210, 25%, 25%)",
    bg: "#dce4ec",
  },
  spring: {
    label: "Spring",
    ocean: "#e4f0e8",
    land: "#a3cc8f",
    landStroke: "#a3cc8f",
    dot: "hsl(145, 45%, 42%)",
    dotHover: "hsl(145, 55%, 35%)",
    dotHoverStroke: "hsl(145, 50%, 50%)",
    label_: "rgba(0,0,0,0.5)",
    labelHover: "hsl(145, 40%, 25%)",
    bg: "#e4f0e8",
  },
};

const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

export const CITIES: City[] = [
  // Australia
  { name: "Sydney", lat: -33.87, lng: 151.21 },
  { name: "Perth", lat: -31.95, lng: 115.86, labelLeft: true },
  { name: "Alice Springs", lat: -23.7, lng: 133.88 },
  // India
  { name: "Delhi", lat: 28.61, lng: 77.21 },
  { name: "Pune", lat: 18.52, lng: 73.86 },
  { name: "Bangalore", lat: 12.97, lng: 77.59 },
  // United States
  { name: "Gainesville", lat: 29.65, lng: -82.32 },
  { name: "Dallas", lat: 32.78, lng: -96.8 },
  { name: "San Diego", lat: 32.72, lng: -117.16, labelLeft: true },
  { name: "Honolulu", lat: 21.31, lng: -157.86 },
  // South America
  { name: "Lima", lat: -12.05, lng: -77.04 },
  { name: "Santiago", lat: -33.45, lng: -70.67, labelLeft: true },
  { name: "Natal", lat: -5.79, lng: -35.21 },
  // Central America
  { name: "Mexico City", lat: 19.43, lng: -99.13 },
  // Southeast Asia
  { name: "Ho Chi Minh City", lat: 10.82, lng: 106.63 },
  // Middle East
  { name: "Muscat", lat: 23.59, lng: 58.54 },
  { name: "Jeddah", lat: 21.49, lng: 39.19 },
  // North Africa
  { name: "Cairo", lat: 30.04, lng: 31.24 },
  { name: "Tripoli", lat: 32.9, lng: 13.18 },
  { name: "Casablanca", lat: 33.57, lng: -7.59, labelLeft: true },
  // Europe
  { name: "Madrid", lat: 40.42, lng: -3.7, labelLeft: true },
  { name: "Rome", lat: 41.9, lng: 12.5 },
  { name: "Paris", lat: 48.86, lng: 2.35, labelLeft: true },
  { name: "Berlin", lat: 52.52, lng: 13.41 },
  // Sub-Saharan Africa
  { name: "Dakar", lat: 14.69, lng: -17.44 },
  { name: "Lagos", lat: 6.52, lng: 3.38 },
  { name: "Mombasa", lat: -4.05, lng: 39.67 },
  { name: "Cape Town", lat: -33.93, lng: 18.42 },
  { name: "Johannesburg", lat: -26.2, lng: 28.04 },
];

// Equirectangular projection: lng → x, lat → y (flipped)
function project(lat: number, lng: number): [number, number] {
  return [lng, -lat];
}

interface WorldMapProps {
  selectedCity: string | null;
  season: Season;
  weatherData: SeasonWeather | null;
  onCityChange: (city: string | null) => void;
  onSeasonChange: (season: Season) => void;
}

export default function WorldMap({
  selectedCity,
  season,
  weatherData,
  onCityChange,
  onSeasonChange,
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [showData, setShowData] = useState(false);
  const dragStart = useRef({ x: 0, scrollLeft: 0 });
  const didDrag = useRef(false);

  const theme = SEASON_THEMES[season];

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = containerRef.current;
      if (!el) return;
      setIsDragging(true);
      didDrag.current = false;
      dragStart.current = { x: e.clientX, scrollLeft: el.scrollLeft };
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const el = containerRef.current;
      if (!el) return;
      const dx = e.clientX - dragStart.current.x;
      if (Math.abs(dx) > 3) didDrag.current = true;
      el.scrollLeft = dragStart.current.scrollLeft - dx;
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleCityClick = useCallback(
    (cityName: string) => {
      if (didDrag.current) return;
      onCityChange(selectedCity === cityName ? null : cityName);
    },
    [selectedCity, onCityChange]
  );

  const headerText = selectedCity ?? "Select a City";
  const hasData = selectedCity && weatherData;

  return (
    <div
      className="relative flex h-full w-[38%] shrink-0 flex-col overflow-hidden rounded-xl border"
      style={{ backgroundColor: theme.bg, transition: "background-color 0.4s" }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent-science))]" />
          {hasData ? (
            <button
              onClick={() => setShowData((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
            >
              {headerText}
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                className={`transition-transform ${showData ? "rotate-180" : ""}`}
              >
                <path
                  d="M1.5 3L4 5.5L6.5 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : (
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {headerText}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {SEASONS.map((s) => (
            <button
              key={s}
              onClick={() => onSeasonChange(s)}
              className={`rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide transition-colors ${
                season === s
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              }`}
            >
              {SEASON_THEMES[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Map area */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-x-hidden overflow-y-hidden"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <svg
          viewBox="-180 -90 360 180"
          width="200%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          shapeRendering="geometricPrecision"
          style={{ minWidth: "200%" }}
        >
          {/* Ocean background */}
          <rect
            x="-180"
            y="-90"
            width="360"
            height="180"
            fill={theme.ocean}
            style={{ transition: "fill 0.4s" }}
          />

          {/* Land masses */}
          <path
            d={WORLD_LAND_PATH}
            fill={theme.land}
            stroke={theme.landStroke}
            strokeWidth="0.3"
            strokeLinejoin="round"
            style={{ transition: "fill 0.4s, stroke 0.4s" }}
          />

          {/* City dots + labels */}
          {CITIES.map((city) => {
            const [cx, cy] = project(city.lat, city.lng);
            const isHovered = hoveredCity === city.name;
            const isSelected = selectedCity === city.name;
            const active = isHovered || isSelected;

            return (
              <g
                key={city.name}
                style={{ cursor: "pointer", pointerEvents: "all" }}
                onPointerEnter={() => setHoveredCity(city.name)}
                onPointerLeave={() => setHoveredCity(null)}
                onClick={() => handleCityClick(city.name)}
              >
                {/* Larger invisible hit target */}
                <circle cx={cx} cy={cy} r="4" fill="transparent" />

                {/* Visible dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? "2" : isHovered ? "2" : "1.5"}
                  fill={
                    isSelected
                      ? "hsl(0, 70%, 50%)"
                      : isHovered
                        ? theme.dotHover
                        : theme.dot
                  }
                  stroke={
                    isSelected
                      ? "hsl(0, 70%, 70%)"
                      : isHovered
                        ? theme.dotHoverStroke
                        : "none"
                  }
                  strokeWidth={active ? "0.5" : "0"}
                  shapeRendering="geometricPrecision"
                />

                {/* Label */}
                <text
                  x={city.labelLeft ? cx - 2.5 : cx + 2.5}
                  y={cy + 1}
                  textAnchor={city.labelLeft ? "end" : "start"}
                  fill={
                    isSelected
                      ? "hsl(0, 60%, 35%)"
                      : isHovered
                        ? theme.labelHover
                        : theme.label_
                  }
                  fontSize="3"
                  fontWeight={active ? 600 : 400}
                  fontFamily="var(--font-geist-mono), monospace"
                >
                  {city.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Data dropdown overlay */}
      {showData && weatherData && (
        <div className="absolute inset-x-0 top-[33px] bottom-0 z-10 flex flex-col border-t bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-3 py-1.5 border-b">
            <span className="text-[9px] font-medium text-muted-foreground">
              {weatherData.startDate} to {weatherData.endDate} &middot; {weatherData.raw.length} days
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const rows = weatherData.raw.flatMap((day) =>
                    day.hours.map((h) =>
                      [day.date, h.hour, h.temperature, h.relativeHumidity, h.dewPoint, h.cloudCover, h.windSpeed, h.windDirection, h.precipitation, h.directRadiation, h.diffuseRadiation, h.shortwaveRadiation, h.soilTemperature, h.solarElevation, h.solarAzimuth].join(",")
                    )
                  );
                  const csv = ["Date,Hour,Temp(C),RH(%),DewPt(C),Cloud(%),Wind(m/s),WindDir(deg),Precip(mm),DirectRad(W/m2),DiffuseRad(W/m2),GHI(W/m2),SoilTemp(C),SolarElev(deg),SolarAz(deg)", ...rows].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${weatherData.location}-${weatherData.season}-weather.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-[9px] font-medium text-muted-foreground hover:text-foreground"
              >
                Download CSV
              </button>
              <button
                onClick={() => setShowData(false)}
                className="text-[9px] font-medium text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-max min-w-full border-collapse font-mono text-[9px]">
              <thead>
                <tr className="sticky top-0 bg-background/90 backdrop-blur-sm">
                  <th className="sticky left-0 z-20 bg-background/90 border-b border-r px-2 py-1.5 text-left font-semibold text-muted-foreground">
                    Date
                  </th>
                  <th className="sticky left-[68px] z-20 bg-background/90 border-b border-r px-2 py-1.5 text-left font-semibold text-muted-foreground">
                    Hour
                  </th>
                  <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground whitespace-nowrap">
                    Temp (°C)
                  </th>
                  <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground whitespace-nowrap">
                    RH (%)
                  </th>
                  <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground whitespace-nowrap">
                    Dew Pt (°C)
                  </th>
                  <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground whitespace-nowrap">
                    Cloud (%)
                  </th>
                  <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground whitespace-nowrap">
                    Wind (m/s)
                  </th>
                  <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground whitespace-nowrap">
                    Wind Dir (°)
                  </th>
                  <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground whitespace-nowrap">
                    Precip (mm)
                  </th>
                  <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground whitespace-nowrap">
                    Direct (W/m²)
                  </th>
                  <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground whitespace-nowrap">
                    Diffuse (W/m²)
                  </th>
                  <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground whitespace-nowrap">
                    GHI (W/m²)
                  </th>
                  <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground whitespace-nowrap">
                    Soil (°C)
                  </th>
                  <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground whitespace-nowrap">
                    Sun Elev (°)
                  </th>
                  <th className="border-b px-2 py-1.5 text-right font-semibold text-muted-foreground whitespace-nowrap">
                    Sun Az (°)
                  </th>
                </tr>
              </thead>
              <tbody>
                {weatherData.raw.map((day) =>
                  day.hours.map((h) => (
                    <tr
                      key={`${day.date}-${h.hour}`}
                      className="hover:bg-foreground/5"
                    >
                      <td className="sticky left-0 bg-background/80 border-r px-2 py-0.5 text-muted-foreground tabular-nums">
                        {h.hour === 0 ? day.date : ""}
                      </td>
                      <td className="sticky left-[68px] bg-background/80 border-r px-2 py-0.5 tabular-nums">
                        {String(h.hour).padStart(2, "0")}:00
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {h.temperature.toFixed(1)}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {h.relativeHumidity.toFixed(0)}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {h.dewPoint.toFixed(1)}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {h.cloudCover}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {h.windSpeed.toFixed(1)}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {h.windDirection}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {h.precipitation.toFixed(1)}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {h.directRadiation.toFixed(0)}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {h.diffuseRadiation.toFixed(0)}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {h.shortwaveRadiation.toFixed(0)}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {h.soilTemperature.toFixed(1)}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {h.solarElevation.toFixed(1)}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {h.solarAzimuth.toFixed(0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
