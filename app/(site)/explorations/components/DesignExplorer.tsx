"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { runSimulation } from "@/lib/simulation/simple-outdoor/open-pond-engine";
import {
  DEFAULT_CONFIG,
  type OpenPondConfig,
  type OpenPondTimestep,
} from "@/lib/simulation/simple-outdoor/types";
import type { RawDayData, SeasonWeather } from "@/lib/simulation/weather-types";
import DepthDiagram from "./DepthDiagram";
import LayeredDiagram from "./LayeredDiagram";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ── Constants ────────────────────────────────────────────────────── */

const TOTAL_DAYS = 7;
const DEFAULT_CITY = "dallas";
const DEFAULT_SEASON = "summer";
const DEPTH_MIN = 50; // mm
const DEPTH_MAX = 500; // mm
const DEPTH_STEP = 10; // mm

// Layered Light Distribution constants
const LAYERED_DEPTH_MM = 300; // baseline depth for layered simulation (mm)
const LAYERED_DEPTH_M = LAYERED_DEPTH_MM / 1000; // 0.3 m
const MIN_LAYERS = 1;
const MAX_LAYERS = 10;

const C_DENSITY = "#16a34a"; // green-600
const C_MASS = "hsl(200, 55%, 40%)"; // blue
const C_LIGHT = "rgb(210, 150, 20)"; // golden
const C_ATTEN = "rgb(160, 90, 200)"; // purple
const C_TEMP = "rgb(200, 80, 60)"; // coral
const C_PROD = "hsl(200, 55%, 40%)"; // blue

/* ── Dynamic axis helpers ─────────────────────────────────────────── */

/**
 * Generate intuitive, evenly-spaced ticks from 0 up to (at least) rawMax.
 * Steps follow human-friendly increments: 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, ...
 * Guarantees between 5 and 10 tick marks (inclusive).
 * Returns { ticks: number[], max: number } where max is the rounded-up axis max.
 */
function niceAxis(rawMax: number): { ticks: number[]; max: number } {
  if (rawMax <= 0) return { ticks: [0], max: 0 };
  // Find the order of magnitude
  const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const norm = rawMax / mag; // 1.0 – 9.999...
  // Pick a nice step that yields 5–10 ticks
  const candidates = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10];
  let step = mag;
  for (const c of candidates) {
    const s = c * mag;
    const n = Math.ceil(rawMax / s);
    if (n >= 5 && n <= 10) { step = s; break; }
  }
  // If no candidate worked (shouldn't happen), fall back
  const nTicks = Math.ceil(rawMax / step);
  const niceMax = nTicks * step;
  // Round to avoid floating point noise
  const precision = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  const ticks = Array.from({ length: nTicks + 1 }, (_, i) =>
    Math.round(i * step * 1e10) / 1e10
  );
  return { ticks, max: Math.round(niceMax * 1e10) / 1e10 };
}

/* ── Light & Temperature model options ────────────────────────────── */

interface SimpleModel {
  id: string;
  name: string;
  calc: (x: number) => number;
}

const LIGHT_MODELS: SimpleModel[] = [
  { id: "steele", name: "Steele", calc: (I) => {
    const Iopt = DEFAULT_CONFIG.Iopt;
    if (I <= 0) return 0;
    const r = I / Iopt;
    return r * Math.exp(1 - r);
  }},
  { id: "monod", name: "Monod", calc: (I) => I / (20 + I) },
  { id: "haldane", name: "Haldane", calc: (I) => I / (80 + I + (I * I) / 1000) },
  { id: "webb", name: "Webb", calc: (I) => 1 - Math.exp(-2 * I / 100) },
];

const TEMP_MODELS: SimpleModel[] = [
  { id: "gaussian", name: "Gaussian", calc: (T) => {
    return Math.exp(-DEFAULT_CONFIG.alpha * (T - DEFAULT_CONFIG.Topt) ** 2);
  }},
  { id: "gaussian-asym", name: "Asym. Gaussian", calc: (T) => {
    const d = T - 30;
    return T < 30 ? Math.exp(-0.008 * d * d) : Math.exp(-0.02 * d * d);
  }},
  { id: "quad-exp", name: "Quad. Exp.", calc: (T) => {
    const Topt = 30, Tmin = 10, Tmax = 50;
    if (T < Topt) { const r = (T - Topt) / (Topt - Tmin); return Math.exp(-4 * r * r); }
    else { const r = (T - Topt) / (Tmax - Topt); return Math.exp(-5 * r * r); }
  }},
  { id: "beta", name: "Beta Function", calc: (T) => {
    const Topt = 32, Tmin = 10, Tmax = 47;
    if (T <= Tmin || T >= Tmax) return 0;
    if (T < Topt) { const t = (T - Tmin) / (Topt - Tmin); return Math.pow(t, 3) * Math.exp(-3 * (t - 1)); }
    else { const t = (Tmax - T) / (Tmax - Topt); return Math.pow(t, 5) * Math.exp(-5 * (t - 1)); }
  }},
];

/* ── Chart data types ─────────────────────────────────────────────── */

interface ChartPoint {
  time: number; // fractional day (e.g. 1.5 = day 1, hour 12)
  label: string;
  density: number; // g/L
  totalMass: number; // kg
  densityMax: number; // envelope upper bound (g/L)
  densityMin: number; // envelope lower bound (g/L)
  massMax: number; // envelope upper bound (kg)
  massMin: number; // envelope lower bound (kg)
  densityBand: number; // densityMax - densityMin (for stacked area)
  massBand: number; // massMax - massMin (for stacked area)
  // Under the Hood fields
  lightFactor: number; // fL (0–1)
  parAvgCulture: number; // volume-averaged PAR (µmol/m²/s)
  lightedFraction: number; // lighted depth fraction (0–1)
  tempFactor: number; // fT (0–1)
  pondTemp: number; // pond temperature (°C)
  productivity: number; // g/m²/day
  avgProductivity: number; // 24h average productivity (g/m²/day)
}

interface Envelope {
  densityMax: number[];
  densityMin: number[];
  massMax: number[];
  massMin: number[];
  yMaxDensity: number;
  yMaxMass: number;
  yMaxProductivity: number;
  yMaxPAR: number;
}

/* ── Layered Light helpers ────────────────────────────────────────── */

/**
 * Scale weather radiation by a factor (1/N for N layers).
 * Each layer receives an equal fraction of the total solar radiation.
 * All other weather fields (temperature, humidity, wind, etc.) remain unchanged.
 */
function scaleWeatherRadiation(raw: RawDayData[], factor: number): RawDayData[] {
  return raw.map((day) => ({
    ...day,
    hours: day.hours.map((h) => ({
      ...h,
      directRadiation: h.directRadiation * factor,
      diffuseRadiation: h.diffuseRadiation * factor,
      shortwaveRadiation: h.shortwaveRadiation * factor,
    })),
  }));
}

/**
 * Run a layered simulation: N identical layers, each with depth/N and light/N.
 * Since all layers are identical, we only need one simulation run.
 * Returns combined timesteps with per-layer density and summed total mass.
 */
function runLayeredSimulation(
  raw: RawDayData[],
  numLayers: number,
  totalDays: number,
  lightFactorFn?: (par: number) => number,
  tempFactorFn?: (T: number) => number,
): { timesteps: OpenPondTimestep[]; totalVolume: number } {
  const layerDepth = LAYERED_DEPTH_M / numLayers;
  const scaledWeather = scaleWeatherRadiation(raw, 1 / numLayers);
  const cfg: OpenPondConfig = {
    ...DEFAULT_CONFIG,
    depth: layerDepth,
    harvest_mode: "none",
    lightFactorFn,
    tempFactorFn,
  };
  const { timesteps } = runSimulation(scaledWeather, cfg, totalDays);
  // Total volume = N × layer volume = original volume (A_surface × 0.3m)
  const totalVolume = timesteps.length > 0
    ? timesteps[0].culture_volume * numLayers
    : 0;
  return { timesteps, totalVolume };
}

/* ── Component ────────────────────────────────────────────────────── */

export default function DesignExplorer() {
  const [depthMm, setDepthMm] = useState([DEFAULT_CONFIG.depth * 1000]); // mm
  const [weather, setWeather] = useState<RawDayData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);
  const [underTheHoodOpen, setUnderTheHoodOpen] = useState(false);
  const [variableDepthOpen, setVariableDepthOpen] = useState(true);
  const [layeredLightOpen, setLayeredLightOpen] = useState(false);
  const [numLayers, setNumLayers] = useState([2]); // 1–10 layers
  const [layeredHoodOpen, setLayeredHoodOpen] = useState(false);
  const [lightModelId, setLightModelId] = useState("steele");
  const [tempModelId, setTempModelId] = useState("gaussian");

  // Responsive margin for Under the Hood charts with right Y-axis
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const hoodRightMargin = isMobile ? 12 : 40;

  // Load weather profile once on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetch(`/weather/${DEFAULT_CITY}.json`)
      .then((r) => r.json())
      .then((data: Record<string, SeasonWeather>) => {
        const season = data[DEFAULT_SEASON];
        if (season?.profile?.hours) {
          // Wrap the averaged profile as a single RawDayData — engine cycles it
          const raw: RawDayData[] = [
            { date: "2024-06-15", hours: season.profile.hours },
          ];
          setWeather(raw);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Resolved model objects
  const lightModel = LIGHT_MODELS.find((m) => m.id === lightModelId) ?? LIGHT_MODELS[0];
  const tempModel = TEMP_MODELS.find((m) => m.id === tempModelId) ?? TEMP_MODELS[0];

  // Build config from slider + selected models
  const config = useMemo<OpenPondConfig>(
    () => ({
      ...DEFAULT_CONFIG,
      depth: depthMm[0] / 1000, // mm → m
      harvest_mode: "none",
      lightFactorFn: lightModel.calc,
      tempFactorFn: tempModel.calc,
    }),
    [depthMm, lightModel, tempModel],
  );

  // Pre-compute envelope: run sim at many depths to find min/max at each timestep
  const envelope = useMemo<Envelope | null>(() => {
    if (!weather) return null;
    const depths = [];
    for (let d = DEPTH_MIN; d <= DEPTH_MAX; d += DEPTH_STEP) depths.push(d);

    const numSteps = TOTAL_DAYS * 24;
    const densityMax = new Array(numSteps).fill(-Infinity);
    const densityMin = new Array(numSteps).fill(Infinity);
    const massMax = new Array(numSteps).fill(-Infinity);
    const massMin = new Array(numSteps).fill(Infinity);
    let peakProductivity = 0;
    let peakPAR = 0;

    for (const d of depths) {
      const cfg = { ...DEFAULT_CONFIG, depth: d / 1000, harvest_mode: "none" as const, lightFactorFn: lightModel.calc, tempFactorFn: tempModel.calc };
      const { timesteps } = runSimulation(weather, cfg, TOTAL_DAYS);
      for (let i = 0; i < timesteps.length; i++) {
        const ts = timesteps[i];
        const mass = ts.biomass_concentration * ts.culture_volume; // (g/L) × (m³) → kg (×1000 L/m³ ÷ 1000 g/kg cancel)
        if (ts.biomass_concentration > densityMax[i]) densityMax[i] = ts.biomass_concentration;
        if (ts.biomass_concentration < densityMin[i]) densityMin[i] = ts.biomass_concentration;
        if (mass > massMax[i]) massMax[i] = mass;
        if (mass < massMin[i]) massMin[i] = mass;
        if (ts.productivity_areal > peakProductivity) peakProductivity = ts.productivity_areal;
        if (ts.par_avg_culture > peakPAR) peakPAR = ts.par_avg_culture;
      }
    }

    return {
      densityMax,
      densityMin,
      massMax,
      massMin,
      yMaxDensity: Math.ceil(Math.max(...densityMax) * 2) / 2, // round up to nearest 0.5
      yMaxMass: Math.ceil(Math.max(...massMax) / 50) * 50, // round up to nearest 50 kg
      yMaxProductivity: Math.ceil(peakProductivity / 25) * 25, // round up to nearest 25
      yMaxPAR: Math.ceil(peakPAR / 100) * 100, // round up to nearest 100
    };
  }, [weather, lightModel, tempModel]);

  // Run simulation whenever config or weather changes
  const chartData = useMemo<ChartPoint[]>(() => {
    if (!weather || !envelope) return [];
    const { timesteps } = runSimulation(weather, config, TOTAL_DAYS);

    // Compute 24h average productivity per simulation day
    const dailyAvgProd: number[] = [];
    for (let d = 0; d < TOTAL_DAYS; d++) {
      const daySlice = timesteps.slice(d * 24, (d + 1) * 24);
      const avg = daySlice.reduce((s, t) => s + t.productivity_areal, 0) / 24;
      dailyAvgProd.push(avg);
    }

    return timesteps.map((ts, i) => ({
      time: i / 24, // continuous fractional day from step index
      label: `Day ${ts.day}, ${ts.hour}:00`,
      density: ts.biomass_concentration,
      totalMass: ts.biomass_concentration * ts.culture_volume, // (g/L) × (m³) → kg
      densityMax: envelope.densityMax[i],
      densityMin: envelope.densityMin[i],
      massMax: envelope.massMax[i],
      massMin: envelope.massMin[i],
      densityBand: envelope.densityMax[i] - envelope.densityMin[i],
      massBand: envelope.massMax[i] - envelope.massMin[i],
      lightFactor: ts.light_factor,
      parAvgCulture: ts.par_avg_culture,
      lightedFraction: ts.lighted_depth_fraction,
      tempFactor: ts.temperature_factor,
      pondTemp: ts.pond_temperature,
      productivity: ts.productivity_areal,
      avgProductivity: dailyAvgProd[Math.floor(i / 24)],
    }));
  }, [weather, config, envelope]);

  // ── Layered Light: envelope (sweep layers 1–10) ──────────────────
  const layeredEnvelope = useMemo<Envelope | null>(() => {
    if (!weather) return null;
    const numSteps = TOTAL_DAYS * 24;
    const densityMax = new Array(numSteps).fill(-Infinity);
    const densityMin = new Array(numSteps).fill(Infinity);
    const massMax = new Array(numSteps).fill(-Infinity);
    const massMin = new Array(numSteps).fill(Infinity);
    let peakProductivity = 0;
    let peakPAR = 0;

    for (let n = MIN_LAYERS; n <= MAX_LAYERS; n++) {
      const { timesteps, totalVolume } = runLayeredSimulation(weather, n, TOTAL_DAYS, lightModel.calc, tempModel.calc);
      for (let i = 0; i < timesteps.length; i++) {
        const ts = timesteps[i];
        // Per-layer density is the simulation density; total mass = density × totalVolume
        const totalMass = ts.biomass_concentration * totalVolume;
        // Areal productivity sums across N layers (each layer produces independently over the same footprint)
        const totalProductivity = ts.productivity_areal * n;
        if (ts.biomass_concentration > densityMax[i]) densityMax[i] = ts.biomass_concentration;
        if (ts.biomass_concentration < densityMin[i]) densityMin[i] = ts.biomass_concentration;
        if (totalMass > massMax[i]) massMax[i] = totalMass;
        if (totalMass < massMin[i]) massMin[i] = totalMass;
        if (totalProductivity > peakProductivity) peakProductivity = totalProductivity;
        if (ts.par_avg_culture > peakPAR) peakPAR = ts.par_avg_culture;
      }
    }

    return {
      densityMax,
      densityMin,
      massMax,
      massMin,
      yMaxDensity: Math.ceil(Math.max(...densityMax) * 2) / 2,
      yMaxMass: Math.ceil(Math.max(...massMax) / 50) * 50,
      yMaxProductivity: Math.ceil(peakProductivity / 25) * 25,
      yMaxPAR: Math.ceil(peakPAR / 100) * 100,
    };
  }, [weather, lightModel, tempModel]);

  // ── Layered Light: simulation for current layer count ───────────
  const layers = numLayers[0];
  const layeredChartData = useMemo<ChartPoint[]>(() => {
    if (!weather || !layeredEnvelope) return [];
    const { timesteps, totalVolume } = runLayeredSimulation(weather, layers, TOTAL_DAYS, lightModel.calc, tempModel.calc);

    // Compute 24h average productivity per simulation day (summed across all layers)
    const dailyAvgProd: number[] = [];
    for (let d = 0; d < TOTAL_DAYS; d++) {
      const daySlice = timesteps.slice(d * 24, (d + 1) * 24);
      const avg = daySlice.reduce((s, t) => s + t.productivity_areal * layers, 0) / 24;
      dailyAvgProd.push(avg);
    }

    return timesteps.map((ts, i) => ({
      time: i / 24,
      label: `Day ${ts.day}, ${ts.hour}:00`,
      density: ts.biomass_concentration,
      totalMass: ts.biomass_concentration * totalVolume,
      densityMax: layeredEnvelope.densityMax[i],
      densityMin: layeredEnvelope.densityMin[i],
      massMax: layeredEnvelope.massMax[i],
      massMin: layeredEnvelope.massMin[i],
      densityBand: layeredEnvelope.densityMax[i] - layeredEnvelope.densityMin[i],
      massBand: layeredEnvelope.massMax[i] - layeredEnvelope.massMin[i],
      lightFactor: ts.light_factor,
      parAvgCulture: ts.par_avg_culture,
      lightedFraction: ts.lighted_depth_fraction,
      tempFactor: ts.temperature_factor,
      pondTemp: ts.pond_temperature,
      productivity: ts.productivity_areal * layers,
      avgProductivity: dailyAvgProd[Math.floor(i / 24)],
    }));
  }, [weather, layers, layeredEnvelope, lightModel, tempModel]);

  // Pre-compute nice axis scales
  const axisDensity = niceAxis(envelope?.yMaxDensity ?? 2);
  const axisMass = niceAxis(envelope?.yMaxMass ?? 500);
  const axisProductivity = niceAxis(envelope?.yMaxProductivity ?? 100);
  const axisLayeredDensity = niceAxis(layeredEnvelope?.yMaxDensity ?? 0.5);
  const axisLayeredMass = niceAxis(layeredEnvelope?.yMaxMass ?? 600);
  const axisLayeredProductivity = niceAxis(layeredEnvelope?.yMaxProductivity ?? 120);

  // Slider thumb position tracking (Variable Depth)
  const depth = depthMm[0];
  const fraction = 1 - (depth - DEPTH_MIN) / (DEPTH_MAX - DEPTH_MIN);
  const thumbTop = 10 + fraction * 188;

  // Slider thumb position tracking (Layered Light)
  const layeredFraction = 1 - (layers - MIN_LAYERS) / (MAX_LAYERS - MIN_LAYERS);
  const layeredThumbTop = 10 + layeredFraction * 188;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Loading weather data…
      </div>
    );
  }

  // Shared x-axis config for under-the-hood charts
  const hoodXAxis = {
    dataKey: "time" as const,
    type: "number" as const,
    domain: [0, TOTAL_DAYS] as [number, number],
    ticks: [0, 1, 2, 3, 4, 5, 6, 7],
    tickFormatter: (v: number) => `${v}`,
    label: {
      value: "Day",
      position: "insideBottom" as const,
      offset: -8,
      style: { fontSize: 11, fill: "#6b7280" },
    },
    tick: { fontSize: 10 },
  };

  return (
    <div className="space-y-0">

    {/* ── Variable Depth ────────────────────────────────────────── */}
    <div className="border-b">
      <button
        onClick={() => setVariableDepthOpen((prev) => !prev)}
        className="flex w-full items-center justify-between py-4 text-sm font-semibold tracking-tight text-foreground hover:text-foreground/80 transition-colors"
      >
        <span>Variable Depth</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            variableDepthOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {variableDepthOpen && (
      <div className="space-y-0 pb-4">
      {/* ── Mobile horizontal slider ── */}
      <div className="md:hidden mb-3 select-none">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-foreground">Culture Depth (mm)</span>
          <span className="text-sm font-mono font-bold" style={{ color: 'hsl(var(--accent-science))' }}>{depth} mm</span>
        </div>
        <Slider
          min={DEPTH_MIN}
          max={DEPTH_MAX}
          step={DEPTH_STEP}
          value={depthMm}
          onValueChange={setDepthMm}
          className="w-full [&_span:first-child]:!bg-border [&_span_span]:!bg-[hsl(var(--accent-science))] [&_span[role=slider]]:!border-[hsl(var(--accent-science))] [&_span[role=slider]]:!bg-background"
        />
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] font-mono text-muted-foreground">{DEPTH_MIN} Shallow</span>
          <span className="text-[10px] font-mono text-muted-foreground">{DEPTH_MAX} Deep</span>
        </div>
      </div>

      {/* ── Pond visual (mobile: full width) ── */}
      <div className="md:hidden min-h-[260px] h-[260px] mb-3 overflow-hidden">
        <DepthDiagram depthMm={depth} />
      </div>

      <div className="flex flex-col md:flex-row md:items-start md:gap-8 md:py-4 select-none">
      {/* ── Depth slider (desktop only) ── */}
      <div className="hidden md:flex flex-col items-center shrink-0 w-44 border-2 border-dashed border-muted-foreground/30 rounded-lg px-4 py-4 relative mt-6">
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-medium text-foreground whitespace-nowrap">
          Culture Depth (mm)
        </span>
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background px-2 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
          ↕ drag to adjust
        </span>
        <span className="text-sm font-mono font-medium text-foreground mb-2">
          Deep
        </span>
        <div className="h-52 relative w-full flex justify-center">
          <span
            className="absolute text-sm font-mono font-bold pointer-events-none whitespace-nowrap"
            style={{
              left: "calc(50% - 20px)",
              top: thumbTop,
              transform: "translate(-100%, -50%)",
              color: "hsl(var(--accent-science))",
            }}
          >
            d
          </span>
          <Slider
            orientation="vertical"
            min={DEPTH_MIN}
            max={DEPTH_MAX}
            step={DEPTH_STEP}
            value={depthMm}
            onValueChange={setDepthMm}
            className="h-full [&_span:first-child]:!bg-border [&_span_span]:!bg-[hsl(var(--accent-science))] [&_span[role=slider]]:!border-[hsl(var(--accent-science))] [&_span[role=slider]]:!bg-background"
          />
          <span
            className="absolute text-sm font-mono font-bold pointer-events-none leading-tight"
            style={{
              left: "calc(50% + 16px)",
              top: thumbTop - 1,
              transform: "translateY(-20%)",
              color: "hsl(var(--accent-science))",
            }}
          >
            {depth}
            <br />
            <span
              className="text-[10px] font-normal text-muted-foreground"
              style={{ marginTop: "-3px", display: "block", lineHeight: "1.1" }}
            >
              mm
            </span>
          </span>
        </div>
        <span className="text-sm font-mono font-medium text-foreground mt-2 mb-0">
          Shallow
        </span>
      </div>

      {/* ── Pond visual (desktop only) ── */}
      <div className="hidden md:block flex-1 min-w-0 w-full min-h-[320px] h-[320px]">
        <DepthDiagram depthMm={depth} />
      </div>

      {/* ── Charts ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4 md:shrink-0">
        {/* Density chart */}
        <div className="w-full md:w-[320px] touch-pan-y">
          <h3 className="text-xs font-medium text-foreground/70 mb-2">
            Biomass Density
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 24, left: 0 }}
            >
              <XAxis
                dataKey="time"
                type="number"
                domain={[0, TOTAL_DAYS]}
                ticks={[0, 1, 2, 3, 4, 5, 6, 7]}
                tickFormatter={(v: number) => `${v}`}
                label={{
                  value: "Day",
                  position: "insideBottom",
                  offset: -8,
                  style: { fontSize: 11, fill: "#6b7280" },
                }}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                domain={[0, axisDensity.max]}
                ticks={axisDensity.ticks}
                interval={0}
                tickFormatter={(v: number) => v.toFixed(1)}
                tick={{ fontSize: 10 }}
                label={{
                  value: "Density (g/L)",
                  angle: -90,
                  position: "center",
                  dx: -8,
                  style: { fontSize: 10, fill: "#6b7280" },
                }}
              />
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <Area
                type="monotone"
                dataKey="densityMin"
                stackId="densityEnv"
                fill="transparent"
                stroke="none"
                activeDot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="densityBand"
                stackId="densityEnv"
                fill={C_DENSITY}
                fillOpacity={0.15}
                stroke="none"
                activeDot={false}
                isAnimationActive={false}
              />
              <Tooltip cursor={false} content={() => null} />
              <Line
                dataKey="density"
                stroke={C_DENSITY}
                strokeWidth={2}
                dot={false}
                activeDot={(props: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                  const { cx, cy, payload } = props;
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={3} fill={C_DENSITY} stroke="none" />
                      <text x={cx + 8} y={cy + 4} fontSize={11} fontFamily="monospace" fill="#444">{payload.density.toFixed(3)}</text>
                    </g>
                  );
                }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Total biomass chart */}
        <div className="w-full md:w-[320px] touch-pan-y">
          <h3 className="text-xs font-medium text-foreground/70 mb-2">
            Total Biomass
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 24, left: 0 }}
            >
              <XAxis
                dataKey="time"
                type="number"
                domain={[0, TOTAL_DAYS]}
                ticks={[0, 1, 2, 3, 4, 5, 6, 7]}
                tickFormatter={(v: number) => `${v}`}
                label={{
                  value: "Day",
                  position: "insideBottom",
                  offset: -8,
                  style: { fontSize: 11, fill: "#6b7280" },
                }}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                domain={[0, axisMass.max]}
                ticks={axisMass.ticks}
                interval={0}
                tickFormatter={(v: number) => v.toFixed(0)}
                tick={{ fontSize: 10 }}
                label={{
                  value: "Biomass (kg)",
                  angle: -90,
                  position: "center",
                  dx: -8,
                  style: { fontSize: 10, fill: "#6b7280" },
                }}
              />
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <Area
                type="monotone"
                dataKey="massMin"
                stackId="massEnv"
                fill="transparent"
                stroke="none"
                activeDot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="massBand"
                stackId="massEnv"
                fill={C_MASS}
                fillOpacity={0.15}
                stroke="none"
                activeDot={false}
                isAnimationActive={false}
              />
              <Tooltip cursor={false} content={() => null} />
              <Line
                dataKey="totalMass"
                stroke={C_MASS}
                strokeWidth={2}
                dot={false}
                activeDot={(props: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                  const { cx, cy, payload } = props;
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={3} fill={C_MASS} stroke="none" />
                      <text x={cx + 8} y={cy + 4} fontSize={11} fontFamily="monospace" fill="#444">{payload.totalMass.toFixed(1)}</text>
                    </g>
                  );
                }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      </div>

    {/* ── Under the Hood ──────────────────────────────────────────── */}
    <div className="border-t pt-2">
      <button
        onClick={() => setUnderTheHoodOpen((prev) => !prev)}
        className="flex w-full items-center justify-between py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Under the Hood</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            underTheHoodOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {underTheHoodOpen && (
        <div className="flex flex-col gap-4 md:grid md:grid-cols-3 md:gap-1 pb-6">
          {/* Light Response (fL) + PAR avg */}
          <div className="touch-pan-y">
            <h3 className="text-xs font-medium text-foreground/70 mb-2 flex items-center gap-2">
              Light Response
              <span className="flex items-center gap-1 flex-wrap">
                {LIGHT_MODELS.map((m) => (
                  <span
                    key={m.id}
                    onClick={() => setLightModelId(m.id)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-normal cursor-pointer transition-colors ${
                      m.id === lightModelId
                        ? "bg-foreground/15 text-foreground font-medium"
                        : "bg-muted text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                    }`}
                  >
                    {m.name}
                  </span>
                ))}
              </span>
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: hoodRightMargin, bottom: 24, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis {...hoodXAxis} />
                <YAxis
                  domain={[0, 1]}
                  ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
                  interval={0}
                  tickFormatter={(v: number) => v.toFixed(1)}
                  tick={{ fontSize: 10 }}
                  label={{
                    value: "fL (-)",
                    angle: -90,
                    position: "center",
                    dx: -8,
                    style: { fontSize: 10, fill: "#6b7280" },
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 700]}
                  ticks={[0, 100, 200, 300, 400, 500, 600, 700]}
                  tickFormatter={(v: number) => v.toFixed(0)}
                  tick={isMobile ? false : { fontSize: 9, fill: "#c0c0c0" }}
                  stroke={isMobile ? "transparent" : "#c0c0c0"}
                  width={isMobile ? 0 : undefined}
                  hide={isMobile}
                  label={isMobile ? undefined : {
                    value: "Avg Intensity (µmol/m²/s)",
                    angle: 90,
                    position: "outside",
                    dx: 2,
                    style: { fontSize: 9, fill: "#c0c0c0" },
                  }}
                />
                <Tooltip cursor={false} content={() => null} />
                <Line
                  dataKey="lightFactor"
                  stroke={C_LIGHT}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={(props: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                    const { cx, cy, payload } = props;
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={3} fill={C_LIGHT} stroke="none" />
                        <text x={cx + 8} y={cy - 2} fontSize={11} fontFamily="monospace" fill="#444">{payload.lightFactor.toFixed(3)}</text>
                        <text x={cx + 8} y={cy + 12} fontSize={10} fontFamily="monospace" fill="#c0c0c0">{Math.round(payload.parAvgCulture)}</text>
                      </g>
                    );
                  }}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  dataKey="parAvgCulture"
                  stroke={C_LIGHT}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  strokeOpacity={0.5}
                  dot={false}
                  activeDot={{ r: 2, fill: C_LIGHT, stroke: "none", strokeOpacity: 0.5 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            {isMobile && <p className="text-[9px] text-right text-muted-foreground/50 -mt-1">dashed = Avg Intensity (µmol/m²/s)</p>}
          </div>

          {/* Temperature Response (fT) + pond temp */}
          <div className="touch-pan-y">
            <h3 className="text-xs font-medium text-foreground/70 mb-2 flex items-center gap-2">
              Temperature Response
              <span className="flex items-center gap-1 flex-wrap">
                {TEMP_MODELS.map((m) => (
                  <span
                    key={m.id}
                    onClick={() => setTempModelId(m.id)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-normal cursor-pointer transition-colors ${
                      m.id === tempModelId
                        ? "bg-foreground/15 text-foreground font-medium"
                        : "bg-muted text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                    }`}
                  >
                    {m.name}
                  </span>
                ))}
              </span>
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: hoodRightMargin, bottom: 24, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis {...hoodXAxis} />
                <YAxis
                  domain={[0, 1]}
                  ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
                  interval={0}
                  tickFormatter={(v: number) => v.toFixed(1)}
                  tick={{ fontSize: 10 }}
                  label={{
                    value: "fT (-)",
                    angle: -90,
                    position: "center",
                    dx: -8,
                    style: { fontSize: 10, fill: "#6b7280" },
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[10, 50]}
                  ticks={[10, 20, 30, 40, 50]}
                  tickFormatter={(v: number) => v.toFixed(0)}
                  tick={isMobile ? false : { fontSize: 9, fill: "#c0c0c0" }}
                  stroke={isMobile ? "transparent" : "#c0c0c0"}
                  width={isMobile ? 0 : undefined}
                  hide={isMobile}
                  label={isMobile ? undefined : {
                    value: "Culture Temp (°C)",
                    angle: 90,
                    position: "outside",
                    dx: 2,
                    style: { fontSize: 9, fill: "#c0c0c0" },
                  }}
                />
                <Tooltip cursor={false} content={() => null} />
                <Line
                  dataKey="tempFactor"
                  stroke={C_TEMP}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={(props: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                    const { cx, cy, payload } = props;
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={3} fill={C_TEMP} stroke="none" />
                        <text x={cx + 8} y={cy - 2} fontSize={11} fontFamily="monospace" fill="#444">{payload.tempFactor.toFixed(3)}</text>
                        <text x={cx + 8} y={cy + 12} fontSize={10} fontFamily="monospace" fill="#c0c0c0">{Math.round(payload.pondTemp)}°C</text>
                      </g>
                    );
                  }}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  dataKey="pondTemp"
                  stroke={C_TEMP}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  strokeOpacity={0.5}
                  dot={false}
                  activeDot={{ r: 2, fill: C_TEMP, stroke: "none", strokeOpacity: 0.5 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            {isMobile && <p className="text-[9px] text-right text-muted-foreground/50 -mt-1">dashed = Culture Temp (°C)</p>}
          </div>

          {/* Productivity */}
          <div className="touch-pan-y">
            <h3 className="text-xs font-medium text-foreground/70 mb-2">
              Productivity
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: 12, bottom: 24, left: 0 }}
              >
                <XAxis {...hoodXAxis} />
                <YAxis
                  domain={[0, axisProductivity.max]}
                  ticks={axisProductivity.ticks}
                  interval={0}
                  tickFormatter={(v: number) => v.toFixed(0)}
                  tick={{ fontSize: 10 }}
                  label={{
                    value: "Productivity (g/m²/day)",
                    angle: -90,
                    position: "center",
                    dx: -8,
                    style: { fontSize: 10, fill: "#6b7280" },
                  }}
                />
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <Tooltip cursor={false} content={() => null} />
                <Line
                  dataKey="productivity"
                  stroke={C_PROD}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={(props: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                    const { cx, cy, payload } = props;
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={3} fill={C_PROD} stroke="none" />
                        <text x={cx + 8} y={cy - 2} fontSize={11} fontFamily="monospace" fill="#444">{payload.productivity.toFixed(1)}</text>
                        <text x={cx + 8} y={cy + 12} fontSize={10} fontFamily="monospace" fill="#c0c0c0">avg {payload.avgProductivity.toFixed(0)}</text>
                      </g>
                    );
                  }}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="avgProductivity"
                  stroke={C_PROD}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  strokeOpacity={0.6}
                  dot={false}
                  activeDot={{ r: 2, fill: C_PROD, stroke: "none", strokeOpacity: 0.6 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            {isMobile && <p className="text-[9px] text-right text-muted-foreground/50 -mt-1">dashed = Avg Productivity (g/m²/day)</p>}
          </div>
        </div>
      )}
    </div>
    </div>
    )}
    </div>

    {/* ── Layered Light Distribution ────────────────────────────── */}
    <div className="border-b">
      <button
        onClick={() => setLayeredLightOpen((prev) => !prev)}
        className="flex w-full items-center justify-between py-4 text-sm font-semibold tracking-tight text-foreground hover:text-foreground/80 transition-colors"
      >
        <span>Layered Light Distribution</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            layeredLightOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {layeredLightOpen && (
      <div className="space-y-0 pb-4">
      {/* ── Mobile horizontal slider ── */}
      <div className="md:hidden mb-3 select-none">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-foreground">Number of Layers</span>
          <span className="text-sm font-mono font-bold" style={{ color: 'hsl(var(--accent-science))' }}>{layers} {layers === 1 ? 'layer' : 'layers'}</span>
        </div>
        <Slider
          min={MIN_LAYERS}
          max={MAX_LAYERS}
          step={1}
          value={numLayers}
          onValueChange={setNumLayers}
          className="w-full [&_span:first-child]:!bg-border [&_span_span]:!bg-[hsl(var(--accent-science))] [&_span[role=slider]]:!border-[hsl(var(--accent-science))] [&_span[role=slider]]:!bg-background"
        />
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] font-mono text-muted-foreground">{MIN_LAYERS} Fewer</span>
          <span className="text-[10px] font-mono text-muted-foreground">{MAX_LAYERS} More</span>
        </div>
      </div>

      {/* ── Pond visual (mobile: full width) ── */}
      <div className="md:hidden min-h-[260px] h-[260px] mb-3 overflow-hidden">
        <LayeredDiagram layers={layers} />
      </div>

      <div className="flex flex-col md:flex-row md:items-start md:gap-8 md:py-4 select-none">
      {/* ── Layers slider (desktop only) ── */}
      <div className="hidden md:flex flex-col items-center shrink-0 w-44 border-2 border-dashed border-muted-foreground/30 rounded-lg px-4 py-4 relative mt-6">
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-medium text-foreground whitespace-nowrap">
          Number of Layers
        </span>
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background px-2 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
          ↕ drag to adjust
        </span>
        <span className="text-sm font-mono font-medium text-foreground mb-2">
          More
        </span>
        <div className="h-52 relative w-full flex justify-center">
          <span
            className="absolute text-sm font-mono font-bold pointer-events-none whitespace-nowrap"
            style={{
              left: "calc(50% - 20px)",
              top: layeredThumbTop,
              transform: "translate(-100%, -50%)",
              color: "hsl(var(--accent-science))",
            }}
          >
            N
          </span>
          <Slider
            orientation="vertical"
            min={MIN_LAYERS}
            max={MAX_LAYERS}
            step={1}
            value={numLayers}
            onValueChange={setNumLayers}
            className="h-full [&_span:first-child]:!bg-border [&_span_span]:!bg-[hsl(var(--accent-science))] [&_span[role=slider]]:!border-[hsl(var(--accent-science))] [&_span[role=slider]]:!bg-background"
          />
          <span
            className="absolute text-sm font-mono font-bold pointer-events-none leading-tight"
            style={{
              left: "calc(50% + 16px)",
              top: layeredThumbTop - 1,
              transform: "translateY(-20%)",
              color: "hsl(var(--accent-science))",
            }}
          >
            {layers}
            <br />
            <span
              className="text-[10px] font-normal text-muted-foreground"
              style={{ marginTop: "-3px", display: "block", lineHeight: "1.1" }}
            >
              {layers === 1 ? "layer" : "layers"}
            </span>
          </span>
        </div>
        <span className="text-sm font-mono font-medium text-foreground mt-2 mb-0">
          Fewer
        </span>
      </div>

      {/* ── Pond visual (desktop only) ── */}
      <div className="hidden md:block flex-1 min-w-0 w-full min-h-[320px] h-[320px]">
        <LayeredDiagram layers={layers} />
      </div>

      {/* ── Charts ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4 md:shrink-0">
        {/* Density chart */}
        <div className="w-full md:w-[320px] touch-pan-y">
          <h3 className="text-xs font-medium text-foreground/70 mb-2">
            Biomass Density
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={layeredChartData}
              margin={{ top: 8, right: 16, bottom: 24, left: 0 }}
            >
              <XAxis
                dataKey="time"
                type="number"
                domain={[0, TOTAL_DAYS]}
                ticks={[0, 1, 2, 3, 4, 5, 6, 7]}
                tickFormatter={(v: number) => `${v}`}
                label={{
                  value: "Day",
                  position: "insideBottom",
                  offset: -8,
                  style: { fontSize: 11, fill: "#6b7280" },
                }}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                domain={[0, axisLayeredDensity.max]}
                ticks={axisLayeredDensity.ticks}
                interval={0}
                tickFormatter={(v: number) => v.toFixed(1)}
                tick={{ fontSize: 10 }}
                label={{
                  value: "Density (g/L)",
                  angle: -90,
                  position: "center",
                  dx: -8,
                  style: { fontSize: 10, fill: "#6b7280" },
                }}
              />
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <Area
                type="monotone"
                dataKey="densityMin"
                stackId="densityEnv"
                fill="transparent"
                stroke="none"
                activeDot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="densityBand"
                stackId="densityEnv"
                fill={C_DENSITY}
                fillOpacity={0.15}
                stroke="none"
                activeDot={false}
                isAnimationActive={false}
              />
              <Tooltip cursor={false} content={() => null} />
              <Line
                dataKey="density"
                stroke={C_DENSITY}
                strokeWidth={2}
                dot={false}
                activeDot={(props: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                  const { cx, cy, payload } = props;
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={3} fill={C_DENSITY} stroke="none" />
                      <text x={cx + 8} y={cy + 4} fontSize={11} fontFamily="monospace" fill="#444">{payload.density.toFixed(3)}</text>
                    </g>
                  );
                }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Total biomass chart */}
        <div className="w-full md:w-[320px] touch-pan-y">
          <h3 className="text-xs font-medium text-foreground/70 mb-2">
            Total Biomass (all layers)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={layeredChartData}
              margin={{ top: 8, right: 16, bottom: 24, left: 0 }}
            >
              <XAxis
                dataKey="time"
                type="number"
                domain={[0, TOTAL_DAYS]}
                ticks={[0, 1, 2, 3, 4, 5, 6, 7]}
                tickFormatter={(v: number) => `${v}`}
                label={{
                  value: "Day",
                  position: "insideBottom",
                  offset: -8,
                  style: { fontSize: 11, fill: "#6b7280" },
                }}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                domain={[0, axisLayeredMass.max]}
                ticks={axisLayeredMass.ticks}
                interval={0}
                tickFormatter={(v: number) => v.toFixed(0)}
                tick={{ fontSize: 10 }}
                label={{
                  value: "Biomass (kg)",
                  angle: -90,
                  position: "center",
                  dx: -8,
                  style: { fontSize: 10, fill: "#6b7280" },
                }}
              />
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <Area
                type="monotone"
                dataKey="massMin"
                stackId="massEnv"
                fill="transparent"
                stroke="none"
                activeDot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="massBand"
                stackId="massEnv"
                fill={C_MASS}
                fillOpacity={0.15}
                stroke="none"
                activeDot={false}
                isAnimationActive={false}
              />
              <Tooltip cursor={false} content={() => null} />
              <Line
                dataKey="totalMass"
                stroke={C_MASS}
                strokeWidth={2}
                dot={false}
                activeDot={(props: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                  const { cx, cy, payload } = props;
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={3} fill={C_MASS} stroke="none" />
                      <text x={cx + 8} y={cy + 4} fontSize={11} fontFamily="monospace" fill="#444">{payload.totalMass.toFixed(1)}</text>
                    </g>
                  );
                }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      </div>

    {/* ── Under the Hood (Layered Light) ──────────────────────────── */}
    <div className="border-t pt-2">
      <button
        onClick={() => setLayeredHoodOpen((prev) => !prev)}
        className="flex w-full items-center justify-between py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Under the Hood</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            layeredHoodOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {layeredHoodOpen && (
        <div className="flex flex-col gap-4 md:grid md:grid-cols-3 md:gap-1 pb-6">
          {/* Light Response (fL) + PAR avg — per layer */}
          <div className="touch-pan-y">
            <h3 className="text-xs font-medium text-foreground/70 mb-2 flex items-center gap-2">
              Light Response
              <span className="flex items-center gap-1 flex-wrap">
                {LIGHT_MODELS.map((m) => (
                  <span
                    key={m.id}
                    onClick={() => setLightModelId(m.id)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-normal cursor-pointer transition-colors ${
                      m.id === lightModelId
                        ? "bg-foreground/15 text-foreground font-medium"
                        : "bg-muted text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                    }`}
                  >
                    {m.name}
                  </span>
                ))}
              </span>
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart
                data={layeredChartData}
                margin={{ top: 8, right: hoodRightMargin, bottom: 24, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis {...hoodXAxis} />
                <YAxis
                  domain={[0, 1]}
                  ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
                  interval={0}
                  tickFormatter={(v: number) => v.toFixed(1)}
                  tick={{ fontSize: 10 }}
                  label={{
                    value: "fL (-)",
                    angle: -90,
                    position: "center",
                    dx: -8,
                    style: { fontSize: 10, fill: "#6b7280" },
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, layeredEnvelope?.yMaxPAR ?? 700]}
                  tickFormatter={(v: number) => v.toFixed(0)}
                  tick={isMobile ? false : { fontSize: 9, fill: "#c0c0c0" }}
                  stroke={isMobile ? "transparent" : "#c0c0c0"}
                  width={isMobile ? 0 : undefined}
                  hide={isMobile}
                  label={isMobile ? undefined : {
                    value: "Avg Intensity (µmol/m²/s)",
                    angle: 90,
                    position: "outside",
                    dx: 2,
                    style: { fontSize: 9, fill: "#c0c0c0" },
                  }}
                />
                <Tooltip cursor={false} content={() => null} />
                <Line
                  dataKey="lightFactor"
                  stroke={C_LIGHT}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={(props: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                    const { cx, cy, payload } = props;
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={3} fill={C_LIGHT} stroke="none" />
                        <text x={cx + 8} y={cy - 2} fontSize={11} fontFamily="monospace" fill="#444">{payload.lightFactor.toFixed(3)}</text>
                        <text x={cx + 8} y={cy + 12} fontSize={10} fontFamily="monospace" fill="#c0c0c0">{Math.round(payload.parAvgCulture)}</text>
                      </g>
                    );
                  }}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  dataKey="parAvgCulture"
                  stroke={C_LIGHT}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  strokeOpacity={0.5}
                  dot={false}
                  activeDot={{ r: 2, fill: C_LIGHT, stroke: "none", strokeOpacity: 0.5 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            {isMobile && <p className="text-[9px] text-right text-muted-foreground/50 -mt-1">dashed = Avg Intensity (µmol/m²/s)</p>}
          </div>

          {/* Temperature Response (fT) + pond temp — per layer */}
          <div className="touch-pan-y">
            <h3 className="text-xs font-medium text-foreground/70 mb-2 flex items-center gap-2">
              Temperature Response
              <span className="flex items-center gap-1 flex-wrap">
                {TEMP_MODELS.map((m) => (
                  <span
                    key={m.id}
                    onClick={() => setTempModelId(m.id)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-normal cursor-pointer transition-colors ${
                      m.id === tempModelId
                        ? "bg-foreground/15 text-foreground font-medium"
                        : "bg-muted text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                    }`}
                  >
                    {m.name}
                  </span>
                ))}
              </span>
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart
                data={layeredChartData}
                margin={{ top: 8, right: hoodRightMargin, bottom: 24, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis {...hoodXAxis} />
                <YAxis
                  domain={[0, 1]}
                  ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
                  interval={0}
                  tickFormatter={(v: number) => v.toFixed(1)}
                  tick={{ fontSize: 10 }}
                  label={{
                    value: "fT (-)",
                    angle: -90,
                    position: "center",
                    dx: -8,
                    style: { fontSize: 10, fill: "#6b7280" },
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[10, 50]}
                  ticks={[10, 20, 30, 40, 50]}
                  tickFormatter={(v: number) => v.toFixed(0)}
                  tick={isMobile ? false : { fontSize: 9, fill: "#c0c0c0" }}
                  stroke={isMobile ? "transparent" : "#c0c0c0"}
                  width={isMobile ? 0 : undefined}
                  hide={isMobile}
                  label={isMobile ? undefined : {
                    value: "Culture Temp (°C)",
                    angle: 90,
                    position: "outside",
                    dx: 2,
                    style: { fontSize: 9, fill: "#c0c0c0" },
                  }}
                />
                <Tooltip cursor={false} content={() => null} />
                <Line
                  dataKey="tempFactor"
                  stroke={C_TEMP}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={(props: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                    const { cx, cy, payload } = props;
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={3} fill={C_TEMP} stroke="none" />
                        <text x={cx + 8} y={cy - 2} fontSize={11} fontFamily="monospace" fill="#444">{payload.tempFactor.toFixed(3)}</text>
                        <text x={cx + 8} y={cy + 12} fontSize={10} fontFamily="monospace" fill="#c0c0c0">{Math.round(payload.pondTemp)}°C</text>
                      </g>
                    );
                  }}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  dataKey="pondTemp"
                  stroke={C_TEMP}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  strokeOpacity={0.5}
                  dot={false}
                  activeDot={{ r: 2, fill: C_TEMP, stroke: "none", strokeOpacity: 0.5 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            {isMobile && <p className="text-[9px] text-right text-muted-foreground/50 -mt-1">dashed = Culture Temp (°C)</p>}
          </div>

          {/* Productivity — total across all layers */}
          <div className="touch-pan-y">
            <h3 className="text-xs font-medium text-foreground/70 mb-2">
              Productivity (all layers)
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart
                data={layeredChartData}
                margin={{ top: 8, right: 12, bottom: 24, left: 0 }}
              >
                <XAxis {...hoodXAxis} />
                <YAxis
                  domain={[0, axisLayeredProductivity.max]}
                  ticks={axisLayeredProductivity.ticks}
                  interval={0}
                  tickFormatter={(v: number) => v.toFixed(0)}
                  tick={{ fontSize: 10 }}
                  label={{
                    value: "Productivity (g/m²/day)",
                    angle: -90,
                    position: "center",
                    dx: -8,
                    style: { fontSize: 10, fill: "#6b7280" },
                  }}
                />
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <Tooltip cursor={false} content={() => null} />
                <Line
                  dataKey="productivity"
                  stroke={C_PROD}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={(props: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                    const { cx, cy, payload } = props;
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={3} fill={C_PROD} stroke="none" />
                        <text x={cx + 8} y={cy - 2} fontSize={11} fontFamily="monospace" fill="#444">{payload.productivity.toFixed(1)}</text>
                        <text x={cx + 8} y={cy + 12} fontSize={10} fontFamily="monospace" fill="#c0c0c0">avg {payload.avgProductivity.toFixed(0)}</text>
                      </g>
                    );
                  }}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="avgProductivity"
                  stroke={C_PROD}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  strokeOpacity={0.6}
                  dot={false}
                  activeDot={{ r: 2, fill: C_PROD, stroke: "none", strokeOpacity: 0.6 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            {isMobile && <p className="text-[9px] text-right text-muted-foreground/50 -mt-1">dashed = Avg Productivity (g/m²/day)</p>}
          </div>
        </div>
      )}
    </div>
    </div>
      )}
    </div>

    </div>
  );
}
