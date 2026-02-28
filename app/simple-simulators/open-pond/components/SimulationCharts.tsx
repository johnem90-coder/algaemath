"use client";

import { useMemo } from "react";
import type {
  OpenPondTimestep,
  OpenPondConfig,
} from "@/lib/simulation/simple-outdoor/types";
import { Slider } from "@/components/ui/slider";

/* ── SVG chart constants ───────────────────────────────────────────── */

const VB_W = 500;
const VB_H = 360;
const CHART_L = 70;
const CHART_T = 10;
const CHART_R = VB_W - 15;
const CHART_B = VB_H - 45;
const CHART_W = CHART_R - CHART_L;
const CHART_H = CHART_B - CHART_T;

/* ── Chart colours ─────────────────────────────────────────────────── */

const C_BIOMASS = "#16a34a"; // green-600
const C_PROD = "hsl(200, 55%, 40%)"; // blue — matches DataStrip productivity
const C_PROD_AVG = "hsl(200, 55%, 28%)"; // darker blue for 24h avg
const C_ACCUM = "#4ade80"; // green-400 (lighter green)
const C_HARVEST = "#6b7280"; // gray-500

/* ── Props ─────────────────────────────────────────────────────────── */

interface Props {
  simResults: OpenPondTimestep[] | null;
  simIndex: number;
  config: OpenPondConfig;
  onConfigChange: (updates: Partial<OpenPondConfig>) => void;
  totalDays: number;
  onTotalDaysChange: (days: number) => void;
  simRunning: boolean;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function niceMax(raw: number): number {
  if (raw <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  if (norm <= 1) return mag;
  if (norm <= 1.5) return 1.5 * mag;
  if (norm <= 2) return 2 * mag;
  if (norm <= 3) return 3 * mag;
  if (norm <= 5) return 5 * mag;
  return 10 * mag;
}

function niceTicks(max: number, count: number): number[] {
  if (max <= 0) return [0];
  const step = max / count;
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(Math.round(step * i * 1000) / 1000);
  }
  return ticks;
}

function formatVal(v: number): string {
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

/* ── Data computation ──────────────────────────────────────────────── */

interface SeriesData {
  path: string;
  lastPx: number;
  lastPy: number;
  lastVal: number;
}

interface ChartData {
  primary: SeriesData | null;
  secondary: SeriesData | null; // 24h avg or cumulative harvest
  yMin: number;
  yMax: number;
  ticks: number[];
  dayTicks: number[];
  totalHours: number;
  harvestMarkers: { px: number }[];
}

const MIN_DISPLAY_DAYS = 5;

function buildChartData(
  kind: "biomass" | "productivity" | "accumulated",
  simResults: OpenPondTimestep[],
  simIndex: number,
): ChartData {
  const end = Math.min(simIndex + 1, simResults.length);

  // Current progress in hours
  const currentHour =
    end > 0
      ? (simResults[end - 1].day - 1) * 24 + simResults[end - 1].hour
      : 0;
  // Display range: at least MIN_DISPLAY_DAYS, grows with data
  const displayDays = Math.max(MIN_DISPLAY_DAYS, Math.ceil(currentHour / 24));
  const displayHours = displayDays * 24;

  const hours: number[] = [];
  const values: number[] = [];
  const values2: number[] = []; // secondary series
  const harvestMarkers: { px: number }[] = [];

  // Accumulated biomass tracking
  let harvestedTotal = 0;

  for (let i = 0; i < end; i++) {
    const ts = simResults[i];
    const h = (ts.day - 1) * 24 + ts.hour;
    hours.push(h);

    if (kind === "biomass") {
      values.push(ts.biomass_concentration);
    } else if (kind === "productivity") {
      values.push(ts.productivity_areal);
      // 24h trailing average
      if (i >= 23) {
        let sum = 0;
        for (let j = i - 23; j <= i; j++) sum += simResults[j].productivity_areal;
        values2.push(sum / 24);
      } else {
        // Partial average for first 24 hours
        let sum = 0;
        for (let j = 0; j <= i; j++) sum += simResults[j].productivity_areal;
        values2.push(sum / (i + 1));
      }
    } else {
      // Accumulated: primary = current pond mass, secondary = cumulative harvested
      if (ts.harvest_occurred) {
        harvestedTotal += ts.harvest_mass_kg;
      }
      const pondMass_kg = (ts.biomass_concentration * ts.culture_volume * 1000) / 1000;
      values.push(pondMass_kg); // pond mass — drops when harvested
      values2.push(harvestedTotal); // cumulative harvested — rises with each harvest
    }

    // Mark harvest events
    if (ts.harvest_occurred) {
      const px = CHART_L + (h / displayHours) * CHART_W;
      harvestMarkers.push({ px });
    }
  }

  // Auto-scale Y across both series
  let rawMax = 0;
  for (const v of values) if (v > rawMax) rawMax = v;
  for (const v of values2) if (v > rawMax) rawMax = v;
  const yMax = niceMax(rawMax);
  const yMin = 0;
  const ticks = niceTicks(yMax, 4);

  // Build path using displayHours for x mapping
  const buildPath = (vals: number[]): SeriesData | null => {
    if (vals.length === 0) return null;
    const pts: string[] = [];
    let lastPx = 0;
    let lastPy = 0;
    for (let i = 0; i < vals.length; i++) {
      const px = CHART_L + (hours[i] / displayHours) * CHART_W;
      const clamped = Math.max(yMin, Math.min(yMax, vals[i]));
      const py = CHART_B - ((clamped - yMin) / (yMax - yMin)) * CHART_H;
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      lastPx = px;
      lastPy = py;
    }
    return {
      path: `M${pts.join(" L")}`,
      lastPx,
      lastPy,
      lastVal: vals[vals.length - 1],
    };
  };

  // Day ticks (1, 2, 3, ...)
  const dayTicks: number[] = [];
  for (let d = 0; d <= displayDays; d++) dayTicks.push(d * 24);

  return {
    primary: buildPath(values),
    secondary: values2.length > 0 ? buildPath(values2) : null,
    yMin,
    yMax,
    ticks,
    dayTicks,
    totalHours: displayHours,
    harvestMarkers,
  };
}

/* ── Single chart renderer ─────────────────────────────────────────── */

function MiniChart({
  title,
  yLabel,
  color,
  secondaryColor,
  secondaryLabel,
  data,
  showHarvestMarkers,
  topRightTag,
}: {
  title: string;
  yLabel: string;
  color: string;
  secondaryColor?: string;
  secondaryLabel?: string;
  data: ChartData;
  showHarvestMarkers?: boolean;
  topRightTag?: { label: string; value: string; color: string; width: number };
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 mb-1 ml-1">
        <span className="text-xs font-semibold text-foreground">{title}</span>
        {secondaryLabel && secondaryColor && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span
              className="inline-block w-4 border-t-2 border-dashed"
              style={{ borderColor: secondaryColor }}
            />
            {secondaryLabel}
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full max-h-[215px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Axes */}
        <line
          x1={CHART_L} y1={CHART_T} x2={CHART_L} y2={CHART_B}
          stroke="var(--border)" strokeWidth="1"
        />
        <line
          x1={CHART_L} y1={CHART_B} x2={CHART_R} y2={CHART_B}
          stroke="var(--border)" strokeWidth="1"
        />

        {/* Y-axis ticks + grid */}
        {data.ticks.map((val) => {
          const py =
            CHART_B - ((val - data.yMin) / (data.yMax - data.yMin)) * CHART_H;
          return (
            <g key={`y-${val}`}>
              <line
                x1={CHART_L - 3} y1={py} x2={CHART_L} y2={py}
                stroke="var(--muted-foreground)" strokeWidth="0.8"
              />
              <line
                x1={CHART_L} y1={py} x2={CHART_R} y2={py}
                stroke="var(--border)" strokeWidth="0.5" strokeOpacity="0.3"
              />
              <text
                x={CHART_L - 8} y={py + 4.5}
                textAnchor="end" className="font-mono" fontSize="13"
                fill="var(--muted-foreground)"
              >
                {formatVal(val)}
              </text>
            </g>
          );
        })}

        {/* X-axis ticks (days) */}
        {data.dayTicks.map((h) => {
          const px = CHART_L + (h / data.totalHours) * CHART_W;
          if (px > CHART_R + 1) return null;
          return (
            <g key={`x-${h}`}>
              <line
                x1={px} y1={CHART_B} x2={px} y2={CHART_B + 4}
                stroke="var(--muted-foreground)" strokeWidth="0.8"
              />
              <text
                x={px} y={CHART_B + 18}
                textAnchor="middle" className="font-mono" fontSize="13"
                fill="var(--muted-foreground)"
              >
                {h / 24}
              </text>
            </g>
          );
        })}

        {/* Y-axis label */}
        <text
          x={CHART_L - 50} y={CHART_T + CHART_H / 2}
          textAnchor="middle" className="font-mono" fontSize="14"
          fill="var(--muted-foreground)"
          transform={`rotate(-90, ${CHART_L - 50}, ${CHART_T + CHART_H / 2})`}
        >
          {yLabel}
        </text>

        {/* X-axis label */}
        <text
          x={CHART_L + CHART_W / 2} y={CHART_B + 36}
          textAnchor="middle" className="font-mono" fontSize="14"
          fill="var(--muted-foreground)"
        >
          Simulation Time (days)
        </text>

        {/* Top-right tag (e.g. 24h avg) */}
        {topRightTag && (
          <g>
            <rect
              x={CHART_R - topRightTag.width - 5} y={CHART_T + 4}
              width={topRightTag.width} height={22} rx={4}
              fill={topRightTag.color} fillOpacity="0.25"
            />
            <text
              x={CHART_R - topRightTag.width + 2} y={CHART_T + 19}
              className="font-mono" fontSize="12"
            >
              <tspan fill={topRightTag.color} fontWeight="800">{topRightTag.label} </tspan>
              <tspan fill={topRightTag.color} fontWeight="800">{topRightTag.value}</tspan>
            </text>
          </g>
        )}

        {/* Harvest event markers */}
        {showHarvestMarkers &&
          data.harvestMarkers.map((m, i) => (
            <line
              key={`h-${i}`}
              x1={m.px} y1={CHART_T} x2={m.px} y2={CHART_B}
              stroke={C_HARVEST} strokeWidth="1" strokeDasharray="4 3"
              strokeOpacity="0.5"
            />
          ))}

        {/* Secondary series (dashed) */}
        {data.secondary && secondaryColor && (
          <g>
            <path
              d={data.secondary.path}
              fill="none"
              stroke={secondaryColor}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeDasharray="6 3"
            />
            <circle
              cx={data.secondary.lastPx} cy={data.secondary.lastPy}
              r={3} fill={secondaryColor}
              stroke="var(--background)" strokeWidth={1.5}
            />
          </g>
        )}

        {/* Primary series */}
        {data.primary && (
          <g>
            <path
              d={data.primary.path}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <circle
              cx={data.primary.lastPx} cy={data.primary.lastPy}
              r={4} fill={color}
              stroke="var(--background)" strokeWidth={2}
            />
            {/* Value label with halo — repositions near top/right edges */}
            {(() => {
              const px = data.primary.lastPx;
              const py = data.primary.lastPy;
              // Vertical: smoothly transition from above (-8) to below (+18) near chart top
              const tY = Math.max(0, Math.min(1, 1 - (py - CHART_T) / 40));
              const offY = -8 + tY * 26;
              // Horizontal: flip to left side when close to right edge
              const nearRight = px > CHART_R - 45;
              const offX = nearRight ? -8 : 8;
              const anchor = nearRight ? "end" : "start";
              return (
                <>
                  <text
                    x={px + offX} y={py + offY}
                    textAnchor={anchor} className="font-mono" fontSize="13"
                    stroke="var(--background)" strokeWidth={4}
                    strokeLinejoin="round" strokeOpacity={0.75}
                    fill="none" fontWeight="600"
                  >
                    {formatVal(data.primary.lastVal)}
                  </text>
                  <text
                    x={px + offX} y={py + offY}
                    textAnchor={anchor} className="font-mono" fontSize="13"
                    fill={color} fontWeight="600"
                  >
                    {formatVal(data.primary.lastVal)}
                  </text>
                </>
              );
            })()}
          </g>
        )}
      </svg>
    </div>
  );
}

/* ── Harvest mode selector ─────────────────────────────────────────── */

const HARVEST_MODES = [
  { value: "none" as const, label: "No Harvest" },
  { value: "semi-continuous" as const, label: "Semi-Continuous" },
  { value: "batch" as const, label: "Batch" },
];

/* ── Main component ────────────────────────────────────────────────── */

export default function SimulationCharts({
  simResults,
  simIndex,
  config,
  onConfigChange,
  totalDays,
  onTotalDaysChange,
  simRunning,
}: Props) {
  const biomassData = useMemo(
    () =>
      simResults && simResults.length > 0
        ? buildChartData("biomass", simResults, Math.max(simIndex, 1))
        : null,
    [simResults, simIndex],
  );

  const prodData = useMemo(
    () =>
      simResults && simResults.length > 0
        ? buildChartData("productivity", simResults, Math.max(simIndex, 1))
        : null,
    [simResults, simIndex],
  );

  const accumData = useMemo(
    () =>
      simResults && simResults.length > 0
        ? buildChartData("accumulated", simResults, Math.max(simIndex, 1))
        : null,
    [simResults, simIndex],
  );

  const hasHarvest = config.harvest_mode !== "none";

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        {/* Simulation days */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">
            Simulation Days
          </label>
          <div className="flex items-center gap-2">
            <Slider
              min={3}
              max={14}
              step={1}
              value={[totalDays]}
              onValueChange={([v]) => onTotalDaysChange(v)}
              className="w-28"
              disabled={simRunning}
            />
            <span className="text-xs font-mono tabular-nums w-4 text-right">
              {totalDays}
            </span>
          </div>
        </div>

        {/* Harvest mode */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">
            Harvest Mode
          </label>
          <div className="flex rounded-md border border-border overflow-hidden">
            {HARVEST_MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => onConfigChange({ harvest_mode: m.value })}
                disabled={simRunning}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${config.harvest_mode === m.value
                  ? "bg-foreground text-background"
                  : "bg-background text-muted-foreground hover:bg-muted"
                  } ${simRunning ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Semi-continuous: min density to maintain */}
        {config.harvest_mode === "semi-continuous" && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              Min Density (g/L)
            </label>
            <div className="flex items-center gap-2">
              <Slider
                min={0.3}
                max={2}
                step={0.1}
                value={[config.harvest_threshold]}
                onValueChange={([v]) =>
                  onConfigChange({ harvest_threshold: v })
                }
                className="w-24"
                disabled={simRunning}
              />
              <span className="text-xs font-mono tabular-nums w-6 text-right">
                {config.harvest_threshold.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {/* Batch: trigger density */}
        {config.harvest_mode === "batch" && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              Harvest at (g/L)
            </label>
            <div className="flex items-center gap-2">
              <Slider
                min={0.5}
                max={2}
                step={0.1}
                value={[config.harvest_threshold]}
                onValueChange={([v]) =>
                  onConfigChange({ harvest_threshold: v })
                }
                className="w-24"
                disabled={simRunning}
              />
              <span className="text-xs font-mono tabular-nums w-6 text-right">
                {config.harvest_threshold.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {/* Batch: restart density */}
        {config.harvest_mode === "batch" && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              Restart at (g/L)
            </label>
            <div className="flex items-center gap-2">
              <Slider
                min={0.3}
                max={Math.max(0.3, config.harvest_threshold / 2)}
                step={0.1}
                value={[config.harvest_target]}
                onValueChange={([v]) =>
                  onConfigChange({ harvest_target: v })
                }
                className="w-24"
                disabled={simRunning}
              />
              <span className="text-xs font-mono tabular-nums w-6 text-right">
                {config.harvest_target.toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Biomass Density */}
        {biomassData ? (
          <MiniChart
            title="Biomass Density"
            yLabel="X (g/L)"
            color={C_BIOMASS}
            data={biomassData}
            showHarvestMarkers={hasHarvest}
          />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-muted-foreground/30">
            <span className="text-sm text-muted-foreground">
              Run simulation to see biomass density
            </span>
          </div>
        )}

        {/* Areal Productivity */}
        {prodData ? (
          <MiniChart
            title="Areal Productivity"
            yLabel="P (g/m²/day)"
            color={C_PROD}
            secondaryColor={C_PROD_AVG}
            secondaryLabel="24h avg"
            data={prodData}
            showHarvestMarkers={hasHarvest}
            topRightTag={
              prodData.secondary
                ? {
                  label: "24h avg:",
                  value: `${formatVal(prodData.secondary.lastVal)} g/m²/d`,
                  color: C_PROD_AVG,
                  width: 160,
                }
                : undefined
            }
          />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-muted-foreground/30">
            <span className="text-sm text-muted-foreground">
              Run simulation to see areal productivity
            </span>
          </div>
        )}

        {/* Pond / Harvested Biomass */}
        {accumData ? (
          <MiniChart
            title="Biomass (pond)"
            yLabel="M (kg)"
            color={C_ACCUM}
            secondaryColor={hasHarvest ? C_HARVEST : undefined}
            secondaryLabel={hasHarvest ? "cumulative harvested" : undefined}
            data={accumData}
            showHarvestMarkers={hasHarvest}
            topRightTag={
              hasHarvest && accumData.secondary
                ? {
                  label: "harvested:",
                  value: `${formatVal(accumData.secondary.lastVal)} kg`,
                  color: C_HARVEST,
                  width: 145,
                }
                : undefined
            }
          />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-muted-foreground/30">
            <span className="text-sm text-muted-foreground">
              Run simulation to see pond biomass
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
