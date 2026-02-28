"use client";

import { useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  DEFAULT_CONFIG,
  type OpenPondConfig,
  type OpenPondTimestep,
} from "@/lib/simulation/simple-outdoor/types";
import { lightEquations } from "@/lib/equations/light";
import { attenuationEquations } from "@/lib/equations/attenuation";
import { temperatureEquations } from "@/lib/equations/temperature";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";

/* ── KaTeX helper ──────────────────────────────────────────────────── */

function renderLatex(latex: string): string {
  return katex.renderToString(latex, {
    displayMode: true,
    throwOnError: false,
    fleqn: true,
  });
}

/* ── Types ─────────────────────────────────────────────────────────── */

interface ModelParam {
  symbol: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  color?: string;
  defaultValue: number;
  configKey?: keyof OpenPondConfig;
  getSimValue?: (ts: OpenPondTimestep) => number;
  /** If true, slider is never user-draggable (sim-driven only) */
  readOnly?: boolean;
}

type AxisConfig = { label: string; domain: [number, number]; ticks: number[] };

interface ModelConfig {
  id: string;
  name: string;
  calc: (x: number, params: Record<string, number>) => number;
  parameters: ModelParam[];
  xAxis: AxisConfig;
  yAxis: AxisConfig | ((params: Record<string, number>) => AxisConfig);
  color: string;
  getSimX?: (
    ts: OpenPondTimestep,
  ) => { x: number; labelPrefix: string } | null;
  latex: string;
  renderLiveEq: (
    params: Record<string, number>,
    ts: OpenPondTimestep | null,
  ) => React.ReactNode;
  /** Extract the y-value for the time-series chart from a timestep */
  getTimeSeriesValue?: (ts: OpenPondTimestep) => number;
  /** Extract the raw x-input from a timestep so we can recompute via model.calc (overrides getTimeSeriesValue) */
  getTimeSeriesX?: (ts: OpenPondTimestep) => number;
  /** Second time-series value (rendered as dashed line) */
  getTimeSeriesValue2?: (ts: OpenPondTimestep) => number;
  /** Y-axis label for the time-series chart (e.g. "f_L") */
  timeSeriesLabel?: string;
}

/* ── Equation definitions from lib/equations ───────────────────────── */

const EQ_LIGHT = Object.fromEntries(lightEquations.map((e) => [e.id, e]));
const EQ_ATT = Object.fromEntries(attenuationEquations.map((e) => [e.id, e]));
const EQ_TEMP = Object.fromEntries(temperatureEquations.map((e) => [e.id, e]));

/* ── Shared colors ─────────────────────────────────────────────────── */

const C_LIGHT = "rgb(210, 150, 20)";
const C_EXT = "rgb(160, 90, 200)";
const C_DENSITY = "rgb(40, 160, 100)";
const C_TEMP = "rgb(200, 80, 60)";
const C_IAVG = "rgb(220, 180, 50)";

/* ── Shared axis configs ──────────────────────────────────────────── */

const LIGHT_XAXIS: AxisConfig = {
  label: "PAR Intensity (\u00B5mol/m\u00B2/s)",
  domain: [0, 1500],
  ticks: [0, 250, 500, 750, 1000, 1250, 1500],
};
const LIGHT_YAXIS: AxisConfig = {
  label: "f_L (-)",
  domain: [0, 1],
  ticks: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
};
const TEMP_XAXIS: AxisConfig = {
  label: "Temperature (\u00B0C)",
  domain: [0, 50],
  ticks: [0, 10, 20, 30, 40, 50],
};
const TEMP_YAXIS: AxisConfig = {
  label: "f_T (-)",
  domain: [0, 1],
  ticks: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
};
const ATT_XAXIS: AxisConfig = (() => {
  const d_mm = DEFAULT_CONFIG.depth * 1000;
  const step = Math.round(d_mm / 4);
  const ticks = Array.from({ length: 5 }, (_, i) => i * step);
  return { label: "Depth, z (mm)", domain: [0, d_mm] as [number, number], ticks };
})();
const ATT_YAXIS: AxisConfig = {
  label: "I(z) (\u00B5mol/m\u00B2/s)",
  domain: [0, 2000] as [number, number],
  ticks: [0, 400, 800, 1200, 1600, 2000],
};

/* ── Symbol display helper ─────────────────────────────────────── */

function symbolToLatex(symbol: string): string {
  const map: Record<string, string> = {
    Iopt: "I_{opt}",
    Topt: "T_{opt}",
    "I₀": "I_0",
  };
  return map[symbol] || symbol;
}

/* ── Helpers for live equation "no data" state ────────────────────── */

function noSimData() {
  return <span className="text-muted-foreground">Run simulation to see live values</span>;
}

/* ── Light Response Models ────────────────────────────────────────── */

const LIGHT_RESPONSE_MODELS: ModelConfig[] = [
  {
    id: "steele",
    name: "Steele",
    calc: (I, p) => {
      const Iopt = p["Iopt"];
      if (I <= 0) return 0;
      const r = I / Iopt;
      return r * Math.exp(1 - r);
    },
    parameters: [
      { symbol: "Iopt", label: "Optimal Intensity", unit: "\u00B5mol/m\u00B2/s", min: 100, max: 500, step: 10, color: C_LIGHT, configKey: "Iopt", defaultValue: DEFAULT_CONFIG.Iopt },
    ],
    xAxis: LIGHT_XAXIS,
    yAxis: LIGHT_YAXIS,
    color: C_LIGHT,
    getSimX: (ts) => ({ x: ts.par_avg_culture, labelPrefix: "f_L" }),
    latex: EQ_LIGHT["steele"].latexNormalized,
    renderLiveEq: (params, ts) => {
      const Iopt = params["Iopt"];
      const I = ts?.par_avg_culture;
      if (I == null) return noSimData();
      const fL = I > 0 ? (I / Iopt) * Math.exp(1 - I / Iopt) : 0;
      return (
        <>
          <div>
            f<sub>L</sub> = (<span style={{ color: C_LIGHT }}>{I.toFixed(0)}</span>{" / "}<span style={{ color: C_LIGHT }}>{Iopt}</span>{") \u00B7 e"}
            <sup>{"1 \u2212 "}<span style={{ color: C_LIGHT }}>{I.toFixed(0)}</span>{"/"}<span style={{ color: C_LIGHT }}>{Iopt}</span></sup>
          </div>
          <div className="mt-1">f<sub>L</sub> = <strong>{fL.toFixed(3)}</strong></div>
        </>
      );
    },
    getTimeSeriesX: (ts) => ts.par_avg_culture,
    timeSeriesLabel: "f_L",
  },
  {
    id: "monod",
    name: "Monod",
    calc: (I, p) => {
      const Ks = p["K_s"];
      return I / (Ks + I);
    },
    parameters: [
      { symbol: "K_s", label: "Half-Saturation", unit: "\u00B5mol/m\u00B2/s", min: 5, max: 200, step: 1, color: C_LIGHT, defaultValue: 20 },
    ],
    xAxis: LIGHT_XAXIS,
    yAxis: LIGHT_YAXIS,
    color: C_LIGHT,
    getSimX: (ts) => ({ x: ts.par_avg_culture, labelPrefix: "f_L" }),
    latex: EQ_LIGHT["monod"].latexNormalized,
    renderLiveEq: (params, ts) => {
      const Ks = params["K_s"];
      const I = ts?.par_avg_culture;
      if (I == null) return noSimData();
      const fL = I / (Ks + I);
      return (
        <>
          <div>f<sub>L</sub> = <span style={{ color: C_LIGHT }}>{I.toFixed(0)}</span>{" / ("}<span style={{ color: C_LIGHT }}>{Ks}</span>{" + "}<span style={{ color: C_LIGHT }}>{I.toFixed(0)}</span>{")"}</div>
          <div className="mt-1">f<sub>L</sub> = <strong>{fL.toFixed(3)}</strong></div>
        </>
      );
    },
    getTimeSeriesX: (ts) => ts.par_avg_culture,
    timeSeriesLabel: "f_L",
  },
  {
    id: "haldane",
    name: "Haldane",
    calc: (I, p) => {
      const Ks = p["K_s"];
      const Ki = p["K_i"];
      return I / (Ks + I + (I * I) / Ki);
    },
    parameters: [
      { symbol: "K_s", label: "Half-Saturation", unit: "\u00B5mol/m\u00B2/s", min: 10, max: 100, step: 1, color: C_LIGHT, defaultValue: 50 },
      { symbol: "K_i", label: "Inhibition Constant", unit: "\u00B5mol/m\u00B2/s", min: 300, max: 2000, step: 10, color: C_LIGHT, defaultValue: 1000 },
    ],
    xAxis: LIGHT_XAXIS,
    yAxis: LIGHT_YAXIS,
    color: C_LIGHT,
    getSimX: (ts) => ({ x: ts.par_avg_culture, labelPrefix: "f_L" }),
    latex: EQ_LIGHT["haldane"].latexNormalized,
    renderLiveEq: (params, ts) => {
      const Ks = params["K_s"];
      const Ki = params["K_i"];
      const I = ts?.par_avg_culture;
      if (I == null) return noSimData();
      const fL = I / (Ks + I + (I * I) / Ki);
      return (
        <>
          <div>f<sub>L</sub> = <span style={{ color: C_LIGHT }}>{I.toFixed(0)}</span>{" / ("}<span style={{ color: C_LIGHT }}>{Ks}</span>{" + "}<span style={{ color: C_LIGHT }}>{I.toFixed(0)}</span>{" + "}<span style={{ color: C_LIGHT }}>{I.toFixed(0)}</span>{"\u00B2/"}<span style={{ color: C_LIGHT }}>{Ki}</span>{")"}</div>
          <div className="mt-1">f<sub>L</sub> = <strong>{fL.toFixed(3)}</strong></div>
        </>
      );
    },
    getTimeSeriesX: (ts) => ts.par_avg_culture,
    timeSeriesLabel: "f_L",
  },
  {
    id: "webb",
    name: "Webb",
    calc: (I, p) => {
      const Iopt = p["I_{opt}"];
      const alpha = p["\\alpha"];
      return 1 - Math.exp((-alpha * I) / Iopt);
    },
    parameters: [
      { symbol: "I_{opt}", label: "Optimal Intensity", unit: "\u00B5mol/m\u00B2/s", min: 10, max: 200, step: 1, color: C_LIGHT, defaultValue: 100 },
      { symbol: "\\alpha", label: "Shape Parameter", unit: "-", min: 1, max: 10, step: 0.1, color: C_LIGHT, defaultValue: 2 },
    ],
    xAxis: LIGHT_XAXIS,
    yAxis: LIGHT_YAXIS,
    color: C_LIGHT,
    getSimX: (ts) => ({ x: ts.par_avg_culture, labelPrefix: "f_L" }),
    latex: EQ_LIGHT["webb"].latexNormalized,
    renderLiveEq: (params, ts) => {
      const Iopt = params["I_{opt}"];
      const alpha = params["\\alpha"];
      const I = ts?.par_avg_culture;
      if (I == null) return noSimData();
      const fL = 1 - Math.exp((-alpha * I) / Iopt);
      return (
        <>
          <div>f<sub>L</sub> = 1 {"\u2212"} e<sup>{"\u2212"}<span style={{ color: C_LIGHT }}>{alpha}</span>{"\u00B7"}<span style={{ color: C_LIGHT }}>{I.toFixed(0)}</span>{"/"}<span style={{ color: C_LIGHT }}>{Iopt}</span></sup></div>
          <div className="mt-1">f<sub>L</sub> = <strong>{fL.toFixed(3)}</strong></div>
        </>
      );
    },
    getTimeSeriesX: (ts) => ts.par_avg_culture,
    timeSeriesLabel: "f_L",
  },
  {
    id: "beta-function-light",
    name: "Beta Function",
    calc: (I, p) => {
      const Iopt = p["I_{opt}"];
      const Imin = p["I_{min}"];
      const Imax = p["I_{max}"];
      const alpha = p["\\alpha"];
      const beta = p["\\beta"];
      if (I <= Imin || I >= Imax) return 0;
      if (I < Iopt) {
        const t = (I - Imin) / (Iopt - Imin);
        return Math.pow(t, alpha) * Math.exp(-alpha * (t - 1));
      } else {
        const t = (Imax - I) / (Imax - Iopt);
        return Math.pow(t, beta) * Math.exp(-beta * (t - 1));
      }
    },
    parameters: [
      { symbol: "I_{opt}", label: "Optimal Intensity", unit: "\u00B5mol/m\u00B2/s", min: 100, max: 500, step: 1, color: C_LIGHT, defaultValue: 200 },
      { symbol: "I_{min}", label: "Minimum Intensity", unit: "\u00B5mol/m\u00B2/s", min: 1, max: 10, step: 0.5, color: C_LIGHT, defaultValue: 1 },
      { symbol: "I_{max}", label: "Maximum Intensity", unit: "\u00B5mol/m\u00B2/s", min: 1000, max: 2000, step: 10, color: C_LIGHT, defaultValue: 1500 },
      { symbol: "\\alpha", label: "Sub-optimal Shape", unit: "-", min: 0.3, max: 3, step: 0.1, color: C_LIGHT, defaultValue: 1 },
      { symbol: "\\beta", label: "Super-optimal Shape", unit: "-", min: 1, max: 10, step: 0.1, color: C_LIGHT, defaultValue: 5 },
    ],
    xAxis: LIGHT_XAXIS,
    yAxis: LIGHT_YAXIS,
    color: C_LIGHT,
    getSimX: (ts) => ({ x: ts.par_avg_culture, labelPrefix: "f_L" }),
    latex: EQ_LIGHT["beta-function"].latexNormalized,
    renderLiveEq: (params, ts) => {
      const I = ts?.par_avg_culture;
      if (I == null) return noSimData();
      const Iopt = params["I_{opt}"];
      const Imin = params["I_{min}"];
      const Imax = params["I_{max}"];
      const alpha = params["\\alpha"];
      const beta = params["\\beta"];
      if (I <= Imin || I >= Imax) {
        return (
          <>
            <div className="text-[10px] text-muted-foreground mb-0.5">
              {I <= Imin ? `I \u2264 I\u2098\u1d62\u2099` : `I \u2265 I\u2098\u2090\u2093`}
            </div>
            <div>f<sub>L</sub> = <strong>0.000</strong></div>
          </>
        );
      }
      const isSubOpt = I < Iopt;
      const t = isSubOpt
        ? (I - Imin) / (Iopt - Imin)
        : (Imax - I) / (Imax - Iopt);
      const shape = isSubOpt ? alpha : beta;
      const fL = Math.pow(t, shape) * Math.exp(-shape * (t - 1));
      return (
        <>
          <div className="text-[10px] text-muted-foreground mb-0.5">
            {isSubOpt ? "I < I_opt (rising)" : "I \u2265 I_opt (falling)"}
          </div>
          <div>
            t = <span style={{ color: C_LIGHT }}>{t.toFixed(3)}</span>
            {", "}
            {isSubOpt ? "\u03B1" : "\u03B2"}{" = "}<span style={{ color: C_LIGHT }}>{shape}</span>
          </div>
          <div>
            f<sub>L</sub> = <span style={{ color: C_LIGHT }}>{t.toFixed(3)}</span>
            <sup><span style={{ color: C_LIGHT }}>{shape}</span></sup>
            {" \u00B7 e"}
            <sup>{"\u2212"}<span style={{ color: C_LIGHT }}>{shape}</span>{"\u00B7("}<span style={{ color: C_LIGHT }}>{t.toFixed(3)}</span>{"\u22121)"}</sup>
          </div>
          <div className="mt-1">f<sub>L</sub> = <strong>{fL.toFixed(3)}</strong></div>
        </>
      );
    },
    getTimeSeriesX: (ts) => ts.par_avg_culture,
    timeSeriesLabel: "f_L",
  },
];

/* ── Light Attenuation Models ─────────────────────────────────────── */

const attParams: ModelParam[] = [
  { symbol: "\u03B5", label: "Specific Extinction", unit: "m\u00B2/g", min: 0.05, max: 0.5, step: 0.01, color: C_EXT, configKey: "epsilon", defaultValue: DEFAULT_CONFIG.epsilon },
  { symbol: "X", label: "Biomass Density", unit: "g/L", min: 0.01, max: 5, step: 0.01, color: C_DENSITY, configKey: "initial_density", defaultValue: DEFAULT_CONFIG.initial_density, getSimValue: (ts) => ts.biomass_concentration, readOnly: true },
  { symbol: "I\u2080", label: "Surface PAR", unit: "\u00B5mol/m\u00B2/s", min: 0, max: 2000, step: 1, color: C_LIGHT, defaultValue: 500, getSimValue: (ts) => ts.par_direct_surface + ts.par_diffuse_surface, readOnly: true },
];

function attLiveEq(params: Record<string, number>) {
  const eps = params["\u03B5"];
  const X = params["X"];
  const I0 = params["I\u2080"];
  const Kw = params["K_w"] || 0;
  const K = eps * X * 1000 + Kw;
  const depth = DEFAULT_CONFIG.depth;
  const KL = K * depth;
  const IavgNorm = KL > 0.001 ? (1 / KL) * (1 - Math.exp(-KL)) : 1;
  const Iavg = I0 * IavgNorm;
  return (
    <>
      <div>
        I(z) = <span style={{ color: C_LIGHT }}>{I0.toFixed(0)}</span>
        {" \u00B7 e"}
        <sup>{"\u2212"}<span style={{ color: C_EXT }}>{eps}</span>{"\u00D7"}<span style={{ color: C_DENSITY }}>{X.toFixed(2)}</span>{"\u00D7"}{"1000\u00D7z"}</sup>
      </div>
      <div className="mt-1">
        <span style={{ color: C_IAVG }}>{"I"}<sub>{"avg"}</sub></span>{" = "}<strong>{Iavg.toFixed(1)}</strong>{" \u00B5mol/m\u00B2/s"}
      </div>
    </>
  );
}

const LIGHT_ATTENUATION_MODELS: ModelConfig[] = [
  {
    id: "beer-lambert",
    name: "Beer\u2013Lambert",
    calc: (z_mm, p) => {
      const eps = p["\u03B5"];
      const X = p["X"];
      const I0 = p["I\u2080"];
      const z_m = z_mm / 1000;
      const K = eps * (X * 1000) + DEFAULT_CONFIG.kb;
      return I0 * Math.exp(-K * z_m);
    },
    parameters: attParams,
    xAxis: ATT_XAXIS,
    yAxis: ATT_YAXIS,
    color: C_LIGHT,
    getSimX: () => null,
    latex: EQ_ATT["beer-lambert"].latexNormalized,
    renderLiveEq: (params) => attLiveEq(params),
    getTimeSeriesValue: (ts) => ts.par_direct_surface + ts.par_diffuse_surface,
    getTimeSeriesValue2: (ts) => ts.par_avg_culture,
    timeSeriesLabel: "I (\u00B5mol/m\u00B2/s)",
  },
  {
    id: "two-component",
    name: "Two-Component",
    calc: (z_mm, p) => {
      const Kw = p["K_w"];
      const eps = p["\u03B5"];
      const X = p["X"];
      const I0 = p["I\u2080"];
      const z_m = z_mm / 1000;
      return I0 * Math.exp(-(Kw + eps * (X * 1000)) * z_m);
    },
    parameters: [
      { symbol: "K_w", label: "Background Atten.", unit: "m\u207B\u00B9", min: 1, max: 50, step: 1, color: C_EXT, defaultValue: 10 },
      ...attParams,
    ],
    xAxis: ATT_XAXIS,
    yAxis: ATT_YAXIS,
    color: C_LIGHT,
    getSimX: () => null,
    latex: EQ_ATT["two-component"].latexNormalized,
    renderLiveEq: (params) => attLiveEq(params),
    getTimeSeriesValue: (ts) => ts.par_direct_surface + ts.par_diffuse_surface,
    getTimeSeriesValue2: (ts) => ts.par_avg_culture,
    timeSeriesLabel: "I (\u00B5mol/m\u00B2/s)",
  },
];

/* ── Temperature Response Models ──────────────────────────────────── */

const TEMPERATURE_RESPONSE_MODELS: ModelConfig[] = [
  {
    id: "gaussian-symmetric",
    name: "Gaussian Symmetric",
    calc: (T, p) => {
      const Topt = p["Topt"];
      const alpha = p["\u03B1"];
      return Math.exp(-alpha * (T - Topt) ** 2);
    },
    parameters: [
      { symbol: "Topt", label: "Optimal Temp.", unit: "\u00B0C", min: 20, max: 40, step: 0.2, color: C_TEMP, configKey: "Topt", defaultValue: DEFAULT_CONFIG.Topt },
      { symbol: "\u03B1", label: "Shape Parameter", unit: "-", min: 0.02, max: 0.05, step: 0.0005, color: C_TEMP, configKey: "alpha", defaultValue: DEFAULT_CONFIG.alpha },
    ],
    xAxis: TEMP_XAXIS,
    yAxis: TEMP_YAXIS,
    color: C_TEMP,
    getSimX: (ts) => ({ x: ts.pond_temperature, labelPrefix: "f_T" }),
    latex: String.raw`f_T = e^{-\alpha \cdot (T - T_{opt})^2}`,
    renderLiveEq: (params, ts) => {
      const Topt = params["Topt"];
      const alpha = params["\u03B1"];
      const T = ts?.pond_temperature;
      if (T == null) return noSimData();
      const fT = Math.exp(-alpha * (T - Topt) ** 2);
      return (
        <>
          <div>f<sub>T</sub> = e<sup>{"\u2212"}<span style={{ color: C_TEMP }}>{alpha}</span>{"\u00D7"}({T.toFixed(1)} {"\u2212"} <span style={{ color: C_TEMP }}>{Topt}</span>){"\u00B2"}</sup></div>
          <div className="mt-1">f<sub>T</sub> = <strong>{fT.toFixed(3)}</strong></div>
        </>
      );
    },
    getTimeSeriesX: (ts) => ts.pond_temperature,
    timeSeriesLabel: "f_T",
  },
  {
    id: "gaussian-asymmetric",
    name: "Gaussian Asymmetric",
    calc: (T, p) => {
      const Topt = p["Topt"];
      const alpha = p["\u03B1"];
      const beta = p["\u03B2"];
      const d = T - Topt;
      return T < Topt ? Math.exp(-alpha * d * d) : Math.exp(-beta * d * d);
    },
    parameters: [
      { symbol: "Topt", label: "Optimal Temp.", unit: "\u00B0C", min: 20, max: 40, step: 0.2, color: C_TEMP, defaultValue: 30 },
      { symbol: "\u03B1", label: "Sub-optimal Shape", unit: "-", min: 0.005, max: 0.05, step: 0.0005, color: C_TEMP, defaultValue: 0.008 },
      { symbol: "\u03B2", label: "Super-optimal Shape", unit: "-", min: 0.005, max: 0.05, step: 0.0005, color: C_TEMP, defaultValue: 0.02 },
    ],
    xAxis: TEMP_XAXIS,
    yAxis: TEMP_YAXIS,
    color: C_TEMP,
    getSimX: (ts) => ({ x: ts.pond_temperature, labelPrefix: "f_T" }),
    latex: EQ_TEMP["gaussian-asymmetric"].latexNormalized,
    renderLiveEq: (params, ts) => {
      const Topt = params["Topt"];
      const alpha = params["\u03B1"];
      const beta = params["\u03B2"];
      const T = ts?.pond_temperature;
      if (T == null) return noSimData();
      const d = T - Topt;
      const isSubOpt = T < Topt;
      const shape = isSubOpt ? alpha : beta;
      const fT = Math.exp(-shape * d * d);
      return (
        <>
          <div className="text-[10px] text-muted-foreground mb-0.5">
            {isSubOpt ? "T < T_opt (\u03B1 branch)" : "T \u2265 T_opt (\u03B2 branch)"}
          </div>
          <div>
            f<sub>T</sub> = e
            <sup>
              {"\u2212"}<span style={{ color: C_TEMP }}>{shape}</span>
              {"\u00B7("}
              <span style={{ color: C_TEMP }}>{T.toFixed(1)}</span>
              {" \u2212 "}
              <span style={{ color: C_TEMP }}>{Topt}</span>
              {")"}
              {"\u00B2"}
            </sup>
          </div>
          <div className="mt-1">f<sub>T</sub> = <strong>{fT.toFixed(3)}</strong></div>
        </>
      );
    },
    getTimeSeriesX: (ts) => ts.pond_temperature,
    timeSeriesLabel: "f_T",
  },
  {
    id: "quadratic-exponential",
    name: "Quadratic Exponential",
    calc: (T, p) => {
      const Topt = p["Topt"];
      const Tmin = p["T_{min}"];
      const Tmax = p["T_{max}"];
      const alpha = p["\u03B1"];
      const beta = p["\u03B2"];
      if (T < Topt) {
        const r = (T - Topt) / (Topt - Tmin);
        return Math.exp(-r * r * alpha);
      } else {
        const r = (T - Topt) / (Tmax - Topt);
        return Math.exp(-r * r * beta);
      }
    },
    parameters: [
      { symbol: "Topt", label: "Optimal Temp.", unit: "\u00B0C", min: 20, max: 40, step: 0.2, color: C_TEMP, defaultValue: 30 },
      { symbol: "T_{min}", label: "Min Temp.", unit: "\u00B0C", min: 5, max: 15, step: 0.2, color: C_TEMP, defaultValue: 10 },
      { symbol: "T_{max}", label: "Max Temp.", unit: "\u00B0C", min: 45, max: 55, step: 0.2, color: C_TEMP, defaultValue: 50 },
      { symbol: "\u03B1", label: "Sub-optimal Shape", unit: "-", min: 2, max: 10, step: 0.1, color: C_TEMP, defaultValue: 4 },
      { symbol: "\u03B2", label: "Super-optimal Shape", unit: "-", min: 3, max: 10, step: 0.1, color: C_TEMP, defaultValue: 5 },
    ],
    xAxis: TEMP_XAXIS,
    yAxis: TEMP_YAXIS,
    color: C_TEMP,
    getSimX: (ts) => ({ x: ts.pond_temperature, labelPrefix: "f_T" }),
    latex: EQ_TEMP["quadratic-exponential"].latexNormalized,
    renderLiveEq: (params, ts) => {
      const Topt = params["Topt"];
      const Tmin = params["T_{min}"];
      const Tmax = params["T_{max}"];
      const alpha = params["\u03B1"];
      const beta = params["\u03B2"];
      const T = ts?.pond_temperature;
      if (T == null) return noSimData();
      const isSubOpt = T < Topt;
      const range = isSubOpt ? (Topt - Tmin) : (Tmax - Topt);
      const shape = isSubOpt ? alpha : beta;
      const r = (T - Topt) / range;
      const fT = Math.exp(-r * r * shape);
      return (
        <>
          <div className="text-[10px] text-muted-foreground mb-0.5">
            {isSubOpt ? "T < T_opt (\u03B1 branch)" : "T \u2265 T_opt (\u03B2 branch)"}
          </div>
          <div>
            f<sub>T</sub> = e
            <sup>
              {"\u2212"}<span style={{ color: C_TEMP }}>{shape}</span>
              {"\u00B7(("}<span style={{ color: C_TEMP }}>{T.toFixed(1)}</span>
              {"\u2212"}<span style={{ color: C_TEMP }}>{Topt}</span>
              {")/"}
              <span style={{ color: C_TEMP }}>{range.toFixed(1)}</span>
              {")\u00B2"}
            </sup>
          </div>
          <div className="mt-1">f<sub>T</sub> = <strong>{fT.toFixed(3)}</strong></div>
        </>
      );
    },
    getTimeSeriesX: (ts) => ts.pond_temperature,
    timeSeriesLabel: "f_T",
  },
  {
    id: "beta-function-temp",
    name: "Beta Function",
    calc: (T, p) => {
      const Topt = p["Topt"];
      const Tmin = p["T_{min}"];
      const Tmax = p["T_{max}"];
      const alpha = p["\u03B1"];
      const beta = p["\u03B2"];
      if (T <= Tmin || T >= Tmax) return 0;
      if (T < Topt) {
        const t = (T - Tmin) / (Topt - Tmin);
        return Math.pow(t, alpha) * Math.exp(-alpha * (t - 1));
      } else {
        const t = (Tmax - T) / (Tmax - Topt);
        return Math.pow(t, beta) * Math.exp(-beta * (t - 1));
      }
    },
    parameters: [
      { symbol: "Topt", label: "Optimal Temp.", unit: "\u00B0C", min: 20, max: 40, step: 0.2, color: C_TEMP, defaultValue: 30 },
      { symbol: "T_{min}", label: "Min Temp.", unit: "\u00B0C", min: 5, max: 15, step: 0.2, color: C_TEMP, defaultValue: 10 },
      { symbol: "T_{max}", label: "Max Temp.", unit: "\u00B0C", min: 45, max: 55, step: 0.2, color: C_TEMP, defaultValue: 50 },
      { symbol: "\u03B1", label: "Sub-optimal Shape", unit: "-", min: 1, max: 10, step: 0.1, color: C_TEMP, defaultValue: 1 },
      { symbol: "\u03B2", label: "Super-optimal Shape", unit: "-", min: 1, max: 10, step: 0.1, color: C_TEMP, defaultValue: 2 },
    ],
    xAxis: TEMP_XAXIS,
    yAxis: TEMP_YAXIS,
    color: C_TEMP,
    getSimX: (ts) => ({ x: ts.pond_temperature, labelPrefix: "f_T" }),
    latex: EQ_TEMP["beta-function"].latexNormalized,
    renderLiveEq: (params, ts) => {
      const T = ts?.pond_temperature;
      if (T == null) return noSimData();
      const Topt = params["Topt"];
      const Tmin = params["T_{min}"];
      const Tmax = params["T_{max}"];
      const alpha = params["\u03B1"];
      const beta = params["\u03B2"];
      if (T <= Tmin || T >= Tmax) {
        return (
          <>
            <div className="text-[10px] text-muted-foreground mb-0.5">
              {T <= Tmin ? "T \u2264 T_min" : "T \u2265 T_max"}
            </div>
            <div>f<sub>T</sub> = <strong>0.000</strong></div>
          </>
        );
      }
      const isSubOpt = T < Topt;
      const t = isSubOpt
        ? (T - Tmin) / (Topt - Tmin)
        : (Tmax - T) / (Tmax - Topt);
      const shape = isSubOpt ? alpha : beta;
      const fT = Math.pow(t, shape) * Math.exp(-shape * (t - 1));
      return (
        <>
          <div className="text-[10px] text-muted-foreground mb-0.5">
            {isSubOpt ? "T < T_opt (rising)" : "T \u2265 T_opt (falling)"}
          </div>
          <div>
            t = <span style={{ color: C_TEMP }}>{t.toFixed(3)}</span>
            {", "}
            {isSubOpt ? "\u03B1" : "\u03B2"}{" = "}<span style={{ color: C_TEMP }}>{shape}</span>
          </div>
          <div>
            f<sub>T</sub> = <span style={{ color: C_TEMP }}>{t.toFixed(3)}</span>
            <sup><span style={{ color: C_TEMP }}>{shape}</span></sup>
            {" \u00B7 e"}
            <sup>{"\u2212"}<span style={{ color: C_TEMP }}>{shape}</span>{"\u00B7("}<span style={{ color: C_TEMP }}>{t.toFixed(3)}</span>{"\u22121)"}</sup>
          </div>
          <div className="mt-1">f<sub>T</sub> = <strong>{fT.toFixed(3)}</strong></div>
        </>
      );
    },
    getTimeSeriesX: (ts) => ts.pond_temperature,
    timeSeriesLabel: "f_T",
  },
];

/* ── SVG chart constants ───────────────────────────────────────────── */

const VB_W = 700;
const VB_H = 500;
const CHART_L = 65;
const CHART_T = 10;
const CHART_R = VB_W - 15;
const CHART_B = VB_H - 45;
const CHART_W = CHART_R - CHART_L;
const CHART_H = CHART_B - CHART_T;

/* ── Generic SVG model visualizer ──────────────────────────────────── */

function ModelVisualizer({
  model,
  config,
  simTimestep,
  simRunning,
  simResults,
  simIndex,
  onConfigChange,
}: {
  model: ModelConfig;
  config: OpenPondConfig;
  simTimestep: OpenPondTimestep | null;
  simRunning: boolean;
  simResults: OpenPondTimestep[] | null;
  simIndex: number;
  onConfigChange: (updates: Partial<OpenPondConfig>) => void;
}) {
  // Local state for params that don't map to a configKey
  const [localParams, setLocalParams] = useState<Record<string, number>>({});

  const params = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of model.parameters) {
      if (simTimestep && p.getSimValue) {
        const raw = p.getSimValue(simTimestep);
        out[p.symbol] = Math.max(p.min, Math.min(p.max, Math.round(raw / p.step) * p.step));
      } else if (p.configKey) {
        out[p.symbol] = config[p.configKey] as number;
      } else if (localParams[p.symbol] !== undefined) {
        out[p.symbol] = localParams[p.symbol];
      } else {
        out[p.symbol] = p.defaultValue;
      }
    }
    return out;
  }, [model, config, simTimestep, localParams]);

  // Resolve dynamic y-axis
  const yAxis: AxisConfig = typeof model.yAxis === "function"
    ? model.yAxis(params)
    : model.yAxis;

  const handleSlider = (p: ModelParam, value: number) => {
    if (p.configKey) {
      onConfigChange({ [p.configKey]: value });
    } else if (!p.readOnly) {
      setLocalParams((prev) => ({ ...prev, [p.symbol]: value }));
    }
  };

  const handleReset = (p: ModelParam) => {
    if (p.configKey) {
      onConfigChange({ [p.configKey]: p.defaultValue });
    } else {
      setLocalParams((prev) => ({ ...prev, [p.symbol]: p.defaultValue }));
    }
  };

  // Curve path
  const curvePath = useMemo(() => {
    const [xMin, xMax] = model.xAxis.domain;
    const [yMin, yMax] = yAxis.domain;
    const N = 150;
    const pts: string[] = [];

    for (let i = 0; i <= N; i++) {
      const x = xMin + ((xMax - xMin) * i) / N;
      const y = Math.max(yMin, Math.min(yMax, model.calc(x, params)));
      const px = CHART_L + ((x - xMin) / (xMax - xMin)) * CHART_W;
      const py = CHART_B - ((y - yMin) / (yMax - yMin)) * CHART_H;
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }

    return `M${pts.join(" L")}`;
  }, [params, model, yAxis]);

  // Simulation tracking dot
  const simPoint = useMemo(() => {
    if (!simTimestep || !model.getSimX) return null;
    const pt = model.getSimX(simTimestep);
    if (!pt) return null;
    const [xMin, xMax] = model.xAxis.domain;
    const [yMin, yMax] = yAxis.domain;
    const yOnCurve = Math.max(
      yMin,
      Math.min(yMax, model.calc(pt.x, params)),
    );
    const px = CHART_L + ((pt.x - xMin) / (xMax - xMin)) * CHART_W;
    const py = CHART_B - ((yOnCurve - yMin) / (yMax - yMin)) * CHART_H;
    // Smooth label offset: above the dot normally, transitions below near chart top
    const zone = 40;
    const t = Math.max(0, Math.min(1, 1 - (py - CHART_T) / zone));
    const labelOffsetY = -8 + t * 26; // -8 (above) → +18 (below)
    return { px, py, labelOffsetY, label: `${pt.labelPrefix} = ${yOnCurve.toFixed(3)}` };
  }, [simTimestep, params, model, yAxis]);

  // Light attenuation extras: Iavg + dark zone
  const attExtras = useMemo(() => {
    if (model.id !== "beer-lambert") return null;
    const eps = params["\u03B5"];
    const X = params["X"];
    const I0 = params["I\u2080"];
    const K = eps * (X * 1000) + DEFAULT_CONFIG.kb;
    const depth = DEFAULT_CONFIG.depth;
    const d_mm = depth * 1000;
    const [xMin, xMax] = model.xAxis.domain;
    const [yMin, yMax] = yAxis.domain;

    const KL = K * depth;
    const IavgNorm = KL > 0.001 ? (1 / KL) * (1 - Math.exp(-KL)) : 1;
    const Iavg = I0 * IavgNorm;
    const IavgPy =
      CHART_B - ((Iavg - yMin) / (yMax - yMin)) * CHART_H;

    // Depth where I(z) = Iavg
    const zAvg_mm =
      IavgNorm > 0 && K > 0
        ? (-Math.log(IavgNorm) / K) * 1000
        : d_mm / 2;
    const zAvgPx =
      CHART_L +
      ((Math.min(zAvg_mm, d_mm) - xMin) / (xMax - xMin)) * CHART_W;

    // Dark zone: where I(z) drops below compensation irradiance
    const I_COMP = 10; // µmol/m²/s — minimum PAR for net growth
    // If I0 is below compensation, entire depth is dark (zDark = 0)
    const zDark_mm =
      I0 > I_COMP && K > 0
        ? Math.min((-Math.log(I_COMP / I0) / K) * 1000, d_mm)
        : I0 <= I_COMP ? 0 : d_mm;
    let darkZone: { startPx: number; endPx: number } | null = null;
    if (zDark_mm < d_mm) {
      darkZone = {
        startPx:
          CHART_L + ((Math.max(zDark_mm, 0) - xMin) / (xMax - xMin)) * CHART_W,
        endPx: CHART_R,
      };
    }

    const growingPct = Math.min(
      100,
      (Math.max(zDark_mm, 0) / d_mm) * 100,
    );
    return { Iavg, IavgPy, zAvgPx, darkZone, growingPct };
  }, [params, model, yAxis]);

  // Time-series data: y-value over simulation time
  // When getTimeSeriesX is set, recompute via model.calc so the chart
  // reflects the *selected* model (not the hardcoded simulation model).
  const tsData = useMemo(() => {
    if (!simResults || (!model.getTimeSeriesValue && !model.getTimeSeriesX) || simIndex <= 0) return null;
    const end = Math.min(simIndex + 1, simResults.length);
    const pts: string[] = [];
    const pts2: string[] = [];
    const MIN_DISPLAY_DAYS = 5;
    const lastTs = simResults[end - 1];
    const currentHour = end - 1;
    const displayDays = Math.max(MIN_DISPLAY_DAYS, Math.ceil(currentHour / 24));
    const totalHours = displayDays * 24;
    const [yMin, yMax] = yAxis.domain;
    let lastPx = 0, lastPy = 0;
    let last2Px = 0, last2Py = 0;
    for (let i = 0; i < end; i++) {
      const ts = simResults[i];
      const h = i;
      const px = CHART_L + (h / totalHours) * CHART_W;

      const val = model.getTimeSeriesX
        ? model.calc(model.getTimeSeriesX(ts), params)
        : model.getTimeSeriesValue!(ts);
      const clamped = Math.max(yMin, Math.min(yMax, val));
      const py = CHART_B - ((clamped - yMin) / (yMax - yMin)) * CHART_H;
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      lastPx = px;
      lastPy = py;

      if (model.getTimeSeriesValue2) {
        const val2 = model.getTimeSeriesValue2(ts);
        const clamped2 = Math.max(yMin, Math.min(yMax, val2));
        const py2 = CHART_B - ((clamped2 - yMin) / (yMax - yMin)) * CHART_H;
        pts2.push(`${px.toFixed(1)},${py2.toFixed(1)}`);
        last2Px = px;
        last2Py = py2;
      }
    }
    return {
      path: `M${pts.join(" L")}`,
      path2: pts2.length > 0 ? `M${pts2.join(" L")}` : null,
      lastPx, lastPy,
      last2Px, last2Py,
      totalHours,
    };
  }, [simResults, simIndex, model, params, yAxis]);

  // Slider height and default marker position helper
  const SLIDER_H = 192; // h-48 = 12rem = 192px
  const defaultMarkerTop = (p: ModelParam) => {
    const frac = 1 - (p.defaultValue - p.min) / (p.max - p.min);
    return 10 + frac * (SLIDER_H - 20); // 20px for thumb size
  };

  // Group consecutive params by unit for shared brace display
  const paramGroups = useMemo(() => {
    const groups: { params: ModelParam[]; unit: string }[] = [];
    for (const p of model.parameters) {
      const last = groups[groups.length - 1];
      if (last && last.unit === p.unit) last.params.push(p);
      else groups.push({ params: [p], unit: p.unit });
    }
    return groups;
  }, [model.parameters]);

  // Dynamic slider column sizing: fit within 240px grid column
  const sliderLayout = useMemo(() => {
    const n = model.parameters.length;
    if (n <= 3) return { colW: 56, innerGap: 12, outerGap: 16 };
    if (n <= 4) return { colW: 44, innerGap: 6, outerGap: 10 };
    return { colW: 36, innerGap: 4, outerGap: 8 };
  }, [model.parameters.length]);

  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-[240px_1fr_1fr_290px] py-4 select-none">
      {/* Vertical sliders */}
      <div className="flex items-center justify-center px-3 py-4 relative self-start" style={{ gap: sliderLayout.outerGap }}>
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background px-2 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
          {simRunning ? "\u23F5 simulating" : "\u2195 drag to adjust"}
        </span>
        {paramGroups.map((group, gi) => (
          <div key={gi} className="flex flex-col items-center">
            {/* Symbol row */}
            <div className="flex" style={{ gap: sliderLayout.innerGap }}>
              {group.params.map((p) => {
                const color = p.color ?? model.color;
                return (
                  <div key={p.symbol} className="flex justify-center" style={{ width: sliderLayout.colW }}>
                    <span
                      className="text-sm font-bold [&_.katex]:!text-sm"
                      style={{ color }}
                      dangerouslySetInnerHTML={{
                        __html: katex.renderToString(symbolToLatex(p.symbol), { throwOnError: false }),
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Unit label — horizontal brace for groups, plain for singles */}
            {group.params.length > 1 ? (
              <div className="flex flex-col items-center w-full">
                <svg
                  viewBox="0 0 100 12"
                  className="w-full text-muted-foreground mt-0.5"
                  style={{ height: "8px" }}
                  preserveAspectRatio="none"
                >
                  <path
                    d="M 5,1 C 5,7 20,9 35,9 L 47,9 Q 50,9 50,11 Q 50,9 53,9 L 65,9 C 80,9 95,7 95,1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {group.unit}
                </span>
              </div>
            ) : (
              <span className="text-[10px] font-mono text-muted-foreground mb-0.5">
                {group.unit}
              </span>
            )}

            {/* Sliders + values + reset */}
            <div className="flex" style={{ gap: sliderLayout.innerGap }}>
              {group.params.map((p) => {
                const color = p.color ?? model.color;
                const value = params[p.symbol];
                const isDisabled = simRunning || !!p.readOnly;
                const isDefault = p.configKey
                  ? (config[p.configKey] as number) === p.defaultValue
                  : (localParams[p.symbol] === undefined || localParams[p.symbol] === p.defaultValue);
                return (
                  <div key={p.symbol} className="flex flex-col items-center" style={{ width: sliderLayout.colW }}>
                    <div
                      className="h-48 relative w-full flex justify-center"
                      style={{ "--sc": color } as React.CSSProperties}
                    >
                      <Slider
                        orientation="vertical"
                        min={p.min}
                        max={p.max}
                        step={p.step}
                        value={[value]}
                        onValueChange={([v]) => handleSlider(p, v)}
                        disabled={isDisabled}
                        className={`h-full [&_[data-slot=slider-track]]:!bg-border [&_[data-slot=slider-range]]:!bg-[var(--sc)] [&_[data-slot=slider-thumb]]:!border-[var(--sc)] [&_[data-slot=slider-thumb]]:!bg-background ${isDisabled ? "opacity-50" : ""}`}
                      />
                      {/* Default position marker */}
                      {!p.readOnly && (
                        <span
                          className="absolute text-[9px] font-mono text-muted-foreground pointer-events-none whitespace-nowrap"
                          style={{
                            right: "calc(50% + 12px)",
                            top: defaultMarkerTop(p),
                            transform: "translateY(-50%)",
                          }}
                        >
                          <span style={{ fontSize: "1.2em" }}>{"\u2192"}</span>
                        </span>
                      )}
                    </div>
                    <span
                      className="text-[11px] font-mono font-bold mt-1 tabular-nums"
                      style={{ color }}
                    >
                      {typeof value === "number" && value < 1
                        ? value.toPrecision(3)
                        : typeof value === "number" && value % 1 !== 0
                          ? value.toFixed(2)
                          : value}
                    </span>
                    {/* Reset button */}
                    {!p.readOnly && !isDefault && !simRunning && (
                      <button
                        onClick={() => handleReset(p)}
                        className="mt-0.5 text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                        title={`Reset to ${p.defaultValue}`}
                      >
                        {"\u21BA"} reset
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-full min-h-[200px]"
        preserveAspectRatio="xMidYMin meet"
        aria-label={`${model.name} model chart`}
      >
        {/* Axes */}
        <line
          x1={CHART_L}
          y1={CHART_T}
          x2={CHART_L}
          y2={CHART_B}
          stroke="var(--border)"
          strokeWidth="1"
        />
        <line
          x1={CHART_L}
          y1={CHART_B}
          x2={CHART_R}
          y2={CHART_B}
          stroke="var(--border)"
          strokeWidth="1"
        />

        {/* Y-axis ticks + grid */}
        {yAxis.ticks.map((val) => {
          const [yMin, yMax] = yAxis.domain;
          const py =
            CHART_B - ((val - yMin) / (yMax - yMin)) * CHART_H;
          return (
            <g key={`y-${val}`}>
              <line
                x1={CHART_L - 3}
                y1={py}
                x2={CHART_L}
                y2={py}
                stroke="var(--muted-foreground)"
                strokeWidth="0.8"
              />
              <line
                x1={CHART_L}
                y1={py}
                x2={CHART_R}
                y2={py}
                stroke="var(--border)"
                strokeWidth="0.5"
                strokeOpacity="0.3"
              />
              <text
                x={CHART_L - 8}
                y={py + 4.5}
                textAnchor="end"
                className="font-mono"
                fontSize="14"
                fill="var(--muted-foreground)"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* X-axis ticks */}
        {model.xAxis.ticks.map((val) => {
          const [xMin, xMax] = model.xAxis.domain;
          const px =
            CHART_L + ((val - xMin) / (xMax - xMin)) * CHART_W;
          return (
            <g key={`x-${val}`}>
              <line
                x1={px}
                y1={CHART_B}
                x2={px}
                y2={CHART_B + 4}
                stroke="var(--muted-foreground)"
                strokeWidth="0.8"
              />
              <text
                x={px}
                y={CHART_B + 18}
                textAnchor="middle"
                className="font-mono"
                fontSize="14"
                fill="var(--muted-foreground)"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Axis labels */}
        <text
          x={CHART_L - 48}
          y={CHART_T + CHART_H / 2}
          textAnchor="middle"
          className="font-mono"
          fontSize="15"
          fill="var(--muted-foreground)"
          transform={`rotate(-90, ${CHART_L - 48}, ${CHART_T + CHART_H / 2})`}
        >
          {yAxis.label}
        </text>
        <text
          x={CHART_L + CHART_W / 2}
          y={CHART_B + 36}
          textAnchor="middle"
          className="font-mono"
          fontSize="15"
          fill="var(--muted-foreground)"
        >
          {model.xAxis.label}
        </text>

        {/* Dark zone (attenuation only) */}
        {attExtras?.darkZone && (
          <g>
            <rect
              x={attExtras.darkZone.startPx}
              y={CHART_T}
              width={
                attExtras.darkZone.endPx - attExtras.darkZone.startPx
              }
              height={CHART_H}
              fill="var(--muted-foreground)"
              fillOpacity="0.08"
            />
            <line
              x1={attExtras.darkZone.startPx}
              y1={CHART_T}
              x2={attExtras.darkZone.startPx}
              y2={CHART_B}
              stroke="var(--muted-foreground)"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <text
              x={
                attExtras.darkZone.startPx +
                (attExtras.darkZone.endPx -
                  attExtras.darkZone.startPx) /
                  2
              }
              y={CHART_T + CHART_H / 2 - 6}
              textAnchor="middle"
              className="text-[10px] font-mono"
              fill="var(--muted-foreground)"
              opacity="0.7"
            >
              not enough
            </text>
            <text
              x={
                attExtras.darkZone.startPx +
                (attExtras.darkZone.endPx -
                  attExtras.darkZone.startPx) /
                  2
              }
              y={CHART_T + CHART_H / 2 + 8}
              textAnchor="middle"
              className="text-[10px] font-mono"
              fill="var(--muted-foreground)"
              opacity="0.7"
            >
              light to grow
            </text>
          </g>
        )}

        {/* Main curve */}
        <path
          d={curvePath}
          fill="none"
          stroke={model.color}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Iavg dashed line + dot (attenuation only) */}
        {attExtras && (
          <g>
            <line
              x1={CHART_L}
              y1={attExtras.IavgPy}
              x2={
                attExtras.darkZone
                  ? attExtras.darkZone.startPx
                  : CHART_R
              }
              y2={attExtras.IavgPy}
              stroke={C_IAVG}
              strokeWidth="1.5"
              strokeDasharray="6 3"
            />
            <circle
              cx={attExtras.zAvgPx}
              cy={attExtras.IavgPy}
              r={5}
              fill={C_IAVG}
              stroke="var(--background)"
              strokeWidth="1.5"
            />
            <text
              x={attExtras.zAvgPx + 9}
              y={attExtras.IavgPy - 8}
              className="text-[10px] font-mono"
              fill={C_IAVG}
              fontWeight="600"
            >
              {"Iavg = "}{attExtras.Iavg.toFixed(1)}{" \u00B5mol/m\u00B2/s"}
            </text>
          </g>
        )}

        {/* Simulation tracking dot */}
        {simPoint && (
          <g>
            <circle
              cx={simPoint.px}
              cy={simPoint.py}
              r={6}
              fill={model.color}
              stroke="var(--background)"
              strokeWidth={2}
            />
            <text
              x={simPoint.px + 10}
              y={simPoint.py + simPoint.labelOffsetY}
              textAnchor="start"
              className="font-mono"
              fontSize="14"
              stroke="var(--background)"
              strokeWidth={4}
              strokeLinejoin="round"
              strokeOpacity={0.75}
              fill="none"
              fontWeight="600"
            >
              {simPoint.label}
            </text>
            <text
              x={simPoint.px + 10}
              y={simPoint.py + simPoint.labelOffsetY}
              textAnchor="start"
              className="font-mono"
              fontSize="14"
              fill="var(--foreground)"
              fontWeight="600"
            >
              {simPoint.label}
            </text>
          </g>
        )}
      </svg>

      {/* Time-series chart */}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-full min-h-[200px]"
        preserveAspectRatio="xMidYMin meet"
        aria-label={`${model.name} time series`}
      >
        {/* Axes */}
        <line x1={CHART_L} y1={CHART_T} x2={CHART_L} y2={CHART_B} stroke="var(--border)" strokeWidth="1" />
        <line x1={CHART_L} y1={CHART_B} x2={CHART_R} y2={CHART_B} stroke="var(--border)" strokeWidth="1" />

        {/* Y-axis ticks + grid */}
        {yAxis.ticks.map((val) => {
          const [yMin, yMax] = yAxis.domain;
          const py = CHART_B - ((val - yMin) / (yMax - yMin)) * CHART_H;
          return (
            <g key={`ts-y-${val}`}>
              <line x1={CHART_L - 3} y1={py} x2={CHART_L} y2={py} stroke="var(--muted-foreground)" strokeWidth="0.8" />
              <line x1={CHART_L} y1={py} x2={CHART_R} y2={py} stroke="var(--border)" strokeWidth="0.5" strokeOpacity="0.3" />
              <text x={CHART_L - 8} y={py + 4.5} textAnchor="end" className="font-mono" fontSize="14" fill="var(--muted-foreground)">
                {val}
              </text>
            </g>
          );
        })}

        {/* X-axis ticks (days) */}
        {(() => {
          const hours = tsData?.totalHours || 120;
          const dayTicks: number[] = [];
          for (let d = 0; d <= Math.ceil(hours / 24); d++) dayTicks.push(d * 24);
          return dayTicks.map((h) => {
            const px = CHART_L + (h / hours) * CHART_W;
            if (px > CHART_R + 1) return null;
            return (
              <g key={`ts-x-${h}`}>
                <line x1={px} y1={CHART_B} x2={px} y2={CHART_B + 4} stroke="var(--muted-foreground)" strokeWidth="0.8" />
                <text x={px} y={CHART_B + 18} textAnchor="middle" className="font-mono" fontSize="14" fill="var(--muted-foreground)">
                  {h / 24}
                </text>
              </g>
            );
          });
        })()}

        {/* Y-axis label */}
        <text
          x={CHART_L - 48}
          y={CHART_T + CHART_H / 2}
          textAnchor="middle"
          className="font-mono"
          fontSize="15"
          fill="var(--muted-foreground)"
          transform={`rotate(-90, ${CHART_L - 48}, ${CHART_T + CHART_H / 2})`}
        >
          {model.timeSeriesLabel || yAxis.label}
        </text>
        <text
          x={CHART_L + CHART_W / 2}
          y={CHART_B + 36}
          textAnchor="middle"
          className="font-mono"
          fontSize="15"
          fill="var(--muted-foreground)"
        >
          Simulation Time (days)
        </text>

        {/* Time-series curves */}
        {tsData && (
          <g>
            {/* Secondary line (dashed — e.g. Iavg) */}
            {tsData.path2 && (
              <>
                <path
                  d={tsData.path2}
                  fill="none"
                  stroke={model.color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeDasharray="6 3"
                />
                <circle
                  cx={tsData.last2Px}
                  cy={tsData.last2Py}
                  r={4}
                  fill={model.color}
                  stroke="var(--background)"
                  strokeWidth={2}
                  opacity={0.7}
                />
              </>
            )}
            {/* Primary line (solid — e.g. I₀) */}
            <path
              d={tsData.path}
              fill="none"
              stroke={model.color}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle
              cx={tsData.lastPx}
              cy={tsData.lastPy}
              r={5}
              fill={model.color}
              stroke="var(--background)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {/* Equation panel */}
      <div className="space-y-3 border-l border-border pl-4 self-start">
        <div className="text-xs font-semibold text-foreground">
          {model.name}
        </div>
        <div
          className="text-left overflow-x-auto overflow-y-hidden [&_.katex-mathml]:!hidden [&_.katex-display]:!text-left [&_.katex-display]:!m-0 [&_.fleqn]:!pl-0 [&_.fleqn>.katex]:!pl-0"
          dangerouslySetInnerHTML={{
            __html: renderLatex(`\\large ${model.latex}`),
          }}
        />
        <hr className="border-border" />
        {/* Live equation with colored values */}
        <div className="text-sm font-mono space-y-1 leading-snug">
          {model.renderLiveEq(params, simTimestep)}
        </div>
        {/* Attenuation growing/not-growing */}
        {attExtras && (
          <>
            <hr className="border-border" />
            <div className="text-[11px] font-mono space-y-1">
              <div>
                <span className="text-muted-foreground">Growing: </span>
                <span className="font-semibold text-green-600">
                  {attExtras.growingPct.toFixed(0)}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Not Growing:{" "}
                </span>
                <span className="font-semibold text-muted-foreground">
                  {(100 - attExtras.growingPct).toFixed(0)}%
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Heat / Energy Balance panel ───────────────────────────────────── */

const HC_POND = "hsl(0, 60%, 45%)";
const HC_AIR = "hsl(0, 0%, 60%)";
const HC_SOLAR = "hsl(38, 80%, 50%)";
const HC_LW_IN = "hsl(25, 70%, 45%)";
const HC_LW_OUT = "hsl(220, 55%, 50%)";
const HC_EVAP = "hsl(180, 50%, 40%)";
const HC_NET = "hsl(0, 0%, 25%)";

interface HeatSeries {
  key: string;
  label: string;
  color: string;
  extract: (ts: OpenPondTimestep) => number;
  dashed?: boolean;
}

const TEMP_SERIES: HeatSeries[] = [
  { key: "pond", label: "Pond", color: HC_POND, extract: (ts) => ts.pond_temperature },
  { key: "air", label: "Air", color: HC_AIR, extract: (ts) => ts.air_temperature, dashed: true },
];

const FLUX_SERIES: HeatSeries[] = [
  { key: "solar", label: "Solar", color: HC_SOLAR, extract: (ts) => ts.q_solar },
  { key: "lw_in", label: "LW in", color: HC_LW_IN, extract: (ts) => ts.q_longwave_in },
  { key: "lw_out", label: "LW out", color: HC_LW_OUT, extract: (ts) => -ts.q_longwave_out },
  { key: "evap", label: "Evap", color: HC_EVAP, extract: (ts) => -ts.q_evap },
  { key: "net", label: "Net", color: HC_NET, extract: (ts) => ts.q_net },
];

function heatNiceMax(raw: number): number {
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

function heatNiceTicks(min: number, max: number, count: number): number[] {
  const step = (max - min) / count;
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(Math.round((min + step * i) * 100) / 100);
  }
  return ticks;
}

function HeatBalancePanel({
  simTimestep,
  simResults,
  simIndex,
}: {
  simTimestep: OpenPondTimestep | null;
  simResults: OpenPondTimestep[] | null;
  simIndex: number;
}) {
  const end = simResults && simIndex > 0 ? Math.min(simIndex + 1, simResults.length) : 0;

  // Build chart data
  const chartData = useMemo(() => {
    if (!simResults || end === 0) return null;

    const MIN_DAYS = 5;
    const currentHour = end - 1;
    const displayDays = Math.max(MIN_DAYS, Math.ceil(currentHour / 24));
    const displayHours = displayDays * 24;

    const dayTicks: number[] = [];
    for (let d = 0; d <= displayDays; d++) dayTicks.push(d * 24);

    // Build series paths
    function buildPaths(series: HeatSeries[]) {
      let rawMin = Infinity;
      let rawMax = -Infinity;
      const allVals: number[][] = series.map(() => []);
      const hours: number[] = [];

      for (let i = 0; i < end; i++) {
        const ts = simResults![i];
        const h = i;
        hours.push(h);
        for (let s = 0; s < series.length; s++) {
          const v = series[s].extract(ts);
          allVals[s].push(v);
          if (v < rawMin) rawMin = v;
          if (v > rawMax) rawMax = v;
        }
      }

      // Symmetric scaling for flux chart (has negative values)
      let yMin: number, yMax: number;
      if (rawMin < 0) {
        const absMax = Math.max(Math.abs(rawMin), Math.abs(rawMax));
        yMax = heatNiceMax(absMax);
        yMin = -yMax;
      } else {
        yMin = 0;
        yMax = heatNiceMax(rawMax);
      }
      const ticks = heatNiceTicks(yMin, yMax, 4);

      const paths = series.map((s, si) => {
        const pts: string[] = [];
        let lastPx = 0, lastPy = 0;
        for (let i = 0; i < allVals[si].length; i++) {
          const px = CHART_L + (hours[i] / displayHours) * CHART_W;
          const clamped = Math.max(yMin, Math.min(yMax, allVals[si][i]));
          const py = CHART_B - ((clamped - yMin) / (yMax - yMin)) * CHART_H;
          pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
          lastPx = px;
          lastPy = py;
        }
        return {
          path: `M${pts.join(" L")}`,
          lastPx,
          lastPy,
          lastVal: allVals[si][allVals[si].length - 1],
        };
      });

      return { paths, yMin, yMax, ticks, dayTicks, displayHours };
    }

    return {
      temp: buildPaths(TEMP_SERIES),
      flux: buildPaths(FLUX_SERIES),
    };
  }, [simResults, simIndex, end]);

  // Placeholder when no data
  if (!chartData) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Run simulation to see heat balance
      </div>
    );
  }

  function formatQ(v: number): string {
    if (Math.abs(v) >= 100) return v.toFixed(0);
    if (Math.abs(v) >= 10) return v.toFixed(1);
    return v.toFixed(2);
  }

  // Shared chart renderer for this panel
  function HeatChart({
    title,
    yLabel,
    series,
    data,
    zeroLine,
    legend,
  }: {
    title: string;
    yLabel: string;
    series: HeatSeries[];
    data: { paths: { path: string; lastPx: number; lastPy: number; lastVal: number }[]; yMin: number; yMax: number; ticks: number[]; dayTicks: number[]; displayHours: number };
    zeroLine?: boolean;
    legend?: boolean;
  }) {
    return (
      <div className="flex flex-col">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-1 ml-1">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          {legend && series.map((s) => (
            <span key={s.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span
                className={`inline-block w-3 border-t-[2px] ${s.dashed ? "border-dashed" : ""}`}
                style={{ borderColor: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* Axes */}
          <line x1={CHART_L} y1={CHART_T} x2={CHART_L} y2={CHART_B} stroke="var(--border)" strokeWidth="1" />
          <line x1={CHART_L} y1={CHART_B} x2={CHART_R} y2={CHART_B} stroke="var(--border)" strokeWidth="1" />

          {/* Zero line */}
          {zeroLine && data.yMin < 0 && (
            <line
              x1={CHART_L}
              y1={CHART_B - ((0 - data.yMin) / (data.yMax - data.yMin)) * CHART_H}
              x2={CHART_R}
              y2={CHART_B - ((0 - data.yMin) / (data.yMax - data.yMin)) * CHART_H}
              stroke="var(--border)" strokeWidth="1" strokeDasharray="4 3"
            />
          )}

          {/* Y-axis ticks + grid */}
          {data.ticks.map((val) => {
            const py = CHART_B - ((val - data.yMin) / (data.yMax - data.yMin)) * CHART_H;
            return (
              <g key={`y-${val}`}>
                <line x1={CHART_L - 3} y1={py} x2={CHART_L} y2={py} stroke="var(--muted-foreground)" strokeWidth="0.8" />
                <line x1={CHART_L} y1={py} x2={CHART_R} y2={py} stroke="var(--border)" strokeWidth="0.5" strokeOpacity="0.3" />
                <text x={CHART_L - 8} y={py + 4.5} textAnchor="end" className="font-mono" fontSize="13" fill="var(--muted-foreground)">
                  {formatQ(val)}
                </text>
              </g>
            );
          })}

          {/* X-axis ticks */}
          {data.dayTicks.map((h) => {
            const px = CHART_L + (h / data.displayHours) * CHART_W;
            if (px > CHART_R + 1) return null;
            return (
              <g key={`x-${h}`}>
                <line x1={px} y1={CHART_B} x2={px} y2={CHART_B + 4} stroke="var(--muted-foreground)" strokeWidth="0.8" />
                <text x={px} y={CHART_B + 18} textAnchor="middle" className="font-mono" fontSize="13" fill="var(--muted-foreground)">
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
          <text x={CHART_L + CHART_W / 2} y={CHART_B + 36} textAnchor="middle" className="font-mono" fontSize="14" fill="var(--muted-foreground)">
            Simulation Time (days)
          </text>

          {/* Series paths */}
          {series.map((s, i) => (
            <g key={s.key}>
              <path
                d={data.paths[i].path}
                fill="none"
                stroke={s.color}
                strokeWidth={s.key === "net" ? "2.5" : "1.8"}
                strokeLinejoin="round"
                strokeDasharray={s.dashed ? "6 3" : undefined}
              />
              <circle
                cx={data.paths[i].lastPx} cy={data.paths[i].lastPy}
                r={3} fill={s.color}
                stroke="var(--background)" strokeWidth={1.5}
              />
            </g>
          ))}
        </svg>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1fr_290px] py-4 select-none">
      {/* Temperature chart */}
      <HeatChart
        title="Temperature"
        yLabel="T (°C)"
        series={TEMP_SERIES}
        data={chartData.temp}
        legend
      />

      {/* Heat flux chart */}
      <HeatChart
        title="Heat Fluxes"
        yLabel="Q (W/m²)"
        series={FLUX_SERIES}
        data={chartData.flux}
        zeroLine
        legend
      />

      {/* Equations panel */}
      <div className="space-y-3 border-l border-border pl-4 self-start">
        <div className="text-xs font-semibold text-foreground">Energy Balance</div>
        <div
          className="text-left overflow-x-auto overflow-y-hidden [&_.katex-mathml]:!hidden [&_.katex-display]:!text-left [&_.katex-display]:!m-0 [&_.fleqn]:!pl-0 [&_.fleqn>.katex]:!pl-0"
          dangerouslySetInnerHTML={{
            __html: renderLatex(String.raw`Q_{net} = Q_{sol} + Q_{lw\uparrow} - Q_{lw\downarrow} - Q_{e} - Q_{c} - Q_{k} - Q_{bio}`),
          }}
        />
        <div
          className="text-left overflow-x-auto overflow-y-hidden [&_.katex-mathml]:!hidden [&_.katex-display]:!text-left [&_.katex-display]:!m-0 [&_.fleqn]:!pl-0 [&_.fleqn>.katex]:!pl-0"
          dangerouslySetInnerHTML={{
            __html: renderLatex(String.raw`\frac{dT}{dt} = \frac{Q_{net}}{\rho \, C_p \, d}`),
          }}
        />
        <hr className="border-border" />
        {/* Live values */}
        {simTimestep ? (
          <div className="text-[11px] font-mono space-y-1.5">
            <div className="flex justify-between">
              <span style={{ color: HC_POND }}>T_pond</span>
              <span className="font-semibold" style={{ color: HC_POND }}>{simTimestep.pond_temperature.toFixed(1)} °C</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: HC_AIR }}>T_air</span>
              <span className="font-semibold" style={{ color: HC_AIR }}>{simTimestep.air_temperature.toFixed(1)} °C</span>
            </div>
            <hr className="border-border" />
            <div className="flex justify-between">
              <span style={{ color: HC_SOLAR }}>Q_solar</span>
              <span className="font-semibold" style={{ color: HC_SOLAR }}>+{formatQ(simTimestep.q_solar)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: HC_LW_IN }}>Q_lw_in</span>
              <span className="font-semibold" style={{ color: HC_LW_IN }}>+{formatQ(simTimestep.q_longwave_in)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: HC_LW_OUT }}>Q_lw_out</span>
              <span className="font-semibold" style={{ color: HC_LW_OUT }}>−{formatQ(Math.abs(simTimestep.q_longwave_out))}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: HC_EVAP }}>Q_evap</span>
              <span className="font-semibold" style={{ color: HC_EVAP }}>−{formatQ(Math.abs(simTimestep.q_evap))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Q_conv</span>
              <span className="font-semibold text-muted-foreground">−{formatQ(Math.abs(simTimestep.q_convection))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Q_cond</span>
              <span className="font-semibold text-muted-foreground">−{formatQ(Math.abs(simTimestep.q_conduction))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Q_bio</span>
              <span className="font-semibold text-muted-foreground">−{formatQ(Math.abs(simTimestep.q_biomass))}</span>
            </div>
            <hr className="border-border" />
            <div className="flex justify-between font-bold">
              <span style={{ color: HC_NET }}>Q_net</span>
              <span style={{ color: HC_NET }}>{simTimestep.q_net >= 0 ? "+" : ""}{formatQ(simTimestep.q_net)} W/m²</span>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground">No data — run simulation</div>
        )}
      </div>
    </div>
  );
}

/* ── Mass Balance Panel ────────────────────────────────────────────── */

const WC_EVAP = "hsl(180, 50%, 40%)"; // teal — evaporation
const WC_MAKEUP = "hsl(210, 70%, 50%)"; // blue — makeup water
const WC_HARVEST = "hsl(25, 70%, 45%)"; // amber — harvest net loss
const WC_TOTAL = "hsl(0, 0%, 25%)"; // dark — total consumption
const WC_RAIN = "hsl(240, 50%, 55%)"; // indigo — rainfall
const WC_VOLUME = "hsl(270, 40%, 50%)"; // purple — pond volume

interface WaterSeries {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
}

const WC_RETURNED = "hsl(150, 45%, 40%)"; // green — returned water

const RATE_SERIES: WaterSeries[] = [
  { key: "evap", label: "Evaporation", color: WC_EVAP },
  { key: "rain", label: "Rainfall", color: WC_RAIN },
  { key: "harvest", label: "Harvest out", color: WC_HARVEST },
  { key: "returned", label: "Returned", color: WC_RETURNED, dashed: true },
  { key: "makeup", label: "Makeup", color: WC_MAKEUP, dashed: true },
];

const CUM_SERIES: WaterSeries[] = [
  { key: "evap", label: "Evaporation", color: WC_EVAP },
  { key: "rain", label: "Rainfall", color: WC_RAIN },
  { key: "makeup", label: "Makeup", color: WC_MAKEUP },
  { key: "harvest", label: "Harvest (net)", color: WC_HARVEST, dashed: true },
  { key: "volume", label: "Pond Vol", color: WC_VOLUME, dashed: true },
];

function MassBalancePanel({
  simTimestep,
  simResults,
  simIndex,
  config,
}: {
  simTimestep: OpenPondTimestep | null;
  simResults: OpenPondTimestep[] | null;
  simIndex: number;
  config: OpenPondConfig;
}) {
  const end = simResults && simIndex > 0 ? Math.min(simIndex + 1, simResults.length) : 0;

  const chartData = useMemo(() => {
    if (!simResults || end === 0) return null;

    const MIN_DAYS = 5;
    const currentHour = end - 1;
    const displayDays = Math.max(MIN_DAYS, Math.ceil(currentHour / 24));
    const displayHours = displayDays * 24;

    const dayTicks: number[] = [];
    for (let d = 0; d <= displayDays; d++) dayTicks.push(d * 24);

    // ── Chart 1: Water rates (L/h) ─────────────────────────
    const rateHours: number[] = [];
    const evapRates: number[] = [];
    const rainRates: number[] = [];
    const harvestRates: number[] = [];
    const returnedRates: number[] = [];
    const makeupRates: number[] = [];
    let rateMin = 0;
    let rateMax = 0;

    for (let i = 0; i < end; i++) {
      const ts = simResults[i];
      rateHours.push(i);
      const evapNeg = -ts.evap_L;
      const harvestNeg = -ts.harvest_water_removed_L;
      evapRates.push(evapNeg);
      rainRates.push(ts.rainfall_L);
      harvestRates.push(harvestNeg);
      returnedRates.push(ts.harvest_water_returned_L);
      makeupRates.push(ts.makeup_L);
      rateMin = Math.min(rateMin, evapNeg, harvestNeg);
      rateMax = Math.max(rateMax, ts.rainfall_L, ts.makeup_L, ts.harvest_water_returned_L);
    }

    const rateAbsMax = Math.max(Math.abs(rateMin), Math.abs(rateMax));
    const rateYMax = heatNiceMax(rateAbsMax);
    const rateYMin = -rateYMax;
    const rateTicks = heatNiceTicks(rateYMin, rateYMax, 4);

    function buildRatePath(vals: number[]) {
      const pts: string[] = [];
      let lastPx = 0, lastPy = 0;
      for (let i = 0; i < vals.length; i++) {
        const px = CHART_L + (rateHours[i] / displayHours) * CHART_W;
        const clamped = Math.max(rateYMin, Math.min(rateYMax, vals[i]));
        const py = CHART_B - ((clamped - rateYMin) / (rateYMax - rateYMin)) * CHART_H;
        pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
        lastPx = px;
        lastPy = py;
      }
      return {
        path: `M${pts.join(" L")}`,
        lastPx, lastPy,
        lastVal: vals[vals.length - 1],
      };
    }

    const ratePathData = {
      paths: [buildRatePath(evapRates), buildRatePath(rainRates), buildRatePath(harvestRates), buildRatePath(returnedRates), buildRatePath(makeupRates)],
      yMin: rateYMin, yMax: rateYMax,
      ticks: rateTicks, dayTicks, displayHours,
    };

    // ── Chart 2: Cumulative water (L) + pond volume (L) ────
    const cumHours: number[] = [];
    const cumEvap: number[] = [];
    const cumRain: number[] = [];
    const cumMakeup: number[] = [];
    const cumHarvest: number[] = [];
    const pondVolume: number[] = [];
    let sumEvap = 0, sumRain = 0, sumMakeup = 0, sumHarvest = 0;
    let cumMax = 0;

    for (let i = 0; i < end; i++) {
      const ts = simResults[i];
      cumHours.push(i);
      sumEvap += ts.evap_L;
      sumRain += ts.rainfall_L;
      sumMakeup += ts.makeup_L;
      sumHarvest += (ts.harvest_water_removed_L - ts.harvest_water_returned_L);
      cumEvap.push(sumEvap);
      cumRain.push(sumRain);
      cumMakeup.push(sumMakeup);
      cumHarvest.push(sumHarvest);
      pondVolume.push(ts.culture_volume * 1000); // m³ → L
      cumMax = Math.max(cumMax, sumEvap, sumRain, sumMakeup, ts.culture_volume * 1000);
    }

    const cumYMax = heatNiceMax(cumMax);
    const cumTicks = heatNiceTicks(0, cumYMax, 4);

    function buildCumPath(vals: number[]) {
      const pts: string[] = [];
      let lastPx = 0, lastPy = 0;
      for (let i = 0; i < vals.length; i++) {
        const px = CHART_L + (cumHours[i] / displayHours) * CHART_W;
        const clamped = Math.max(0, Math.min(cumYMax, vals[i]));
        const py = CHART_B - (clamped / cumYMax) * CHART_H;
        pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
        lastPx = px;
        lastPy = py;
      }
      return {
        path: `M${pts.join(" L")}`,
        lastPx, lastPy,
        lastVal: vals[vals.length - 1],
      };
    }

    const cumPathData = {
      paths: [buildCumPath(cumEvap), buildCumPath(cumRain), buildCumPath(cumMakeup), buildCumPath(cumHarvest), buildCumPath(pondVolume)],
      yMin: 0, yMax: cumYMax,
      ticks: cumTicks, dayTicks, displayHours,
    };

    return { rate: ratePathData, cum: cumPathData };
  }, [simResults, simIndex, end]);

  if (!chartData) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Run simulation to see mass balance
      </div>
    );
  }

  function formatW(v: number): string {
    if (Math.abs(v) >= 10000) return `${(v / 1000).toFixed(0)}k`;
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
    if (Math.abs(v) >= 100) return v.toFixed(0);
    if (Math.abs(v) >= 10) return v.toFixed(1);
    return v.toFixed(2);
  }

  // Shared chart renderer
  function WaterChart({
    title,
    yLabel,
    series,
    data,
    zeroLine,
    legend,
  }: {
    title: string;
    yLabel: string;
    series: WaterSeries[];
    data: { paths: { path: string; lastPx: number; lastPy: number; lastVal: number }[]; yMin: number; yMax: number; ticks: number[]; dayTicks: number[]; displayHours: number };
    zeroLine?: boolean;
    legend?: boolean;
  }) {
    return (
      <div className="flex flex-col">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-1 ml-1">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          {legend && series.map((s) => (
            <span key={s.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span
                className={`inline-block w-3 border-t-[2px] ${s.dashed ? "border-dashed" : ""}`}
                style={{ borderColor: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          <line x1={CHART_L} y1={CHART_T} x2={CHART_L} y2={CHART_B} stroke="var(--border)" strokeWidth="1" />
          <line x1={CHART_L} y1={CHART_B} x2={CHART_R} y2={CHART_B} stroke="var(--border)" strokeWidth="1" />

          {zeroLine && data.yMin < 0 && (
            <line
              x1={CHART_L}
              y1={CHART_B - ((0 - data.yMin) / (data.yMax - data.yMin)) * CHART_H}
              x2={CHART_R}
              y2={CHART_B - ((0 - data.yMin) / (data.yMax - data.yMin)) * CHART_H}
              stroke="var(--border)" strokeWidth="1" strokeDasharray="4 3"
            />
          )}

          {data.ticks.map((val) => {
            const py = CHART_B - ((val - data.yMin) / (data.yMax - data.yMin)) * CHART_H;
            return (
              <g key={`y-${val}`}>
                <line x1={CHART_L - 3} y1={py} x2={CHART_L} y2={py} stroke="var(--muted-foreground)" strokeWidth="0.8" />
                <line x1={CHART_L} y1={py} x2={CHART_R} y2={py} stroke="var(--border)" strokeWidth="0.5" strokeOpacity="0.3" />
                <text x={CHART_L - 8} y={py + 4.5} textAnchor="end" className="font-mono" fontSize="13" fill="var(--muted-foreground)">
                  {formatW(val)}
                </text>
              </g>
            );
          })}

          {data.dayTicks.map((h) => {
            const px = CHART_L + (h / data.displayHours) * CHART_W;
            if (px > CHART_R + 1) return null;
            return (
              <g key={`x-${h}`}>
                <line x1={px} y1={CHART_B} x2={px} y2={CHART_B + 4} stroke="var(--muted-foreground)" strokeWidth="0.8" />
                <text x={px} y={CHART_B + 18} textAnchor="middle" className="font-mono" fontSize="13" fill="var(--muted-foreground)">
                  {h / 24}
                </text>
              </g>
            );
          })}

          <text
            x={CHART_L - 50} y={CHART_T + CHART_H / 2}
            textAnchor="middle" className="font-mono" fontSize="14"
            fill="var(--muted-foreground)"
            transform={`rotate(-90, ${CHART_L - 50}, ${CHART_T + CHART_H / 2})`}
          >
            {yLabel}
          </text>

          <text x={CHART_L + CHART_W / 2} y={CHART_B + 36} textAnchor="middle" className="font-mono" fontSize="14" fill="var(--muted-foreground)">
            Simulation Time (days)
          </text>

          {series.map((s, i) => (
            <g key={s.key}>
              <path
                d={data.paths[i].path}
                fill="none"
                stroke={s.color}
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeDasharray={s.dashed ? "6 3" : undefined}
              />
              <circle
                cx={data.paths[i].lastPx} cy={data.paths[i].lastPy}
                r={3} fill={s.color}
                stroke="var(--background)" strokeWidth={1.5}
              />
            </g>
          ))}
        </svg>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1fr_290px] py-4 select-none">
      {/* Water rates chart */}
      <WaterChart
        title="Water Flows"
        yLabel="Rate (L/h)"
        series={RATE_SERIES}
        data={chartData.rate}
        zeroLine
        legend
      />

      {/* Cumulative water chart */}
      <WaterChart
        title="Cumulative Water"
        yLabel="Volume (L)"
        series={CUM_SERIES}
        data={chartData.cum}
        legend
      />

      {/* Equations + live values */}
      <div className="space-y-3 border-l border-border pl-4 self-start">
        <div className="text-xs font-semibold text-foreground">Water Balance</div>
        <div
          className="text-left overflow-x-auto overflow-y-hidden [&_.katex-mathml]:!hidden [&_.katex-display]:!text-left [&_.katex-display]:!m-0 [&_.fleqn]:!pl-0 [&_.fleqn>.katex]:!pl-0"
          dangerouslySetInnerHTML={{
            __html: renderLatex(String.raw`R = P_{mm} \cdot A_s`),
          }}
        />
        <div
          className="text-left overflow-x-auto overflow-y-hidden [&_.katex-mathml]:!hidden [&_.katex-display]:!text-left [&_.katex-display]:!m-0 [&_.fleqn]:!pl-0 [&_.fleqn>.katex]:!pl-0"
          dangerouslySetInnerHTML={{
            __html: renderLatex(String.raw`\dot{m}_{in} = \max(0,\; E + 0.2\,V_h - R)`),
          }}
        />
        <hr className="border-border" />
        {simTimestep ? (
          <div className="text-[11px] font-mono space-y-1.5">
            <div className="flex justify-between">
              <span style={{ color: WC_EVAP }}>Evaporation</span>
              <span className="font-semibold" style={{ color: WC_EVAP }}>{formatW(simTimestep.evap_L)} L/h</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: WC_RAIN }}>Rainfall</span>
              <span className="font-semibold" style={{ color: WC_RAIN }}>{formatW(simTimestep.rainfall_L)} L/h</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: WC_MAKEUP }}>Makeup water</span>
              <span className="font-semibold" style={{ color: WC_MAKEUP }}>{formatW(simTimestep.makeup_L)} L/h</span>
            </div>
            <hr className="border-border" />
            <div className="flex justify-between">
              <span style={{ color: WC_HARVEST }}>Harvest removed</span>
              <span className="font-semibold" style={{ color: WC_HARVEST }}>{formatW(simTimestep.harvest_water_removed_L)} L</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: WC_RETURNED }}>Returned (80%)</span>
              <span className="font-semibold" style={{ color: WC_RETURNED }}>{formatW(simTimestep.harvest_water_returned_L)} L</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Net loss</span>
              <span className="font-semibold text-muted-foreground">{formatW(simTimestep.harvest_water_removed_L - simTimestep.harvest_water_returned_L)} L</span>
            </div>
            <hr className="border-border" />
            <div className="flex justify-between">
              <span style={{ color: WC_VOLUME }}>V_pond</span>
              <span className="font-semibold" style={{ color: WC_VOLUME }}>{formatW(simTimestep.culture_volume * 1000)} L</span>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground">No data — run simulation</div>
        )}
      </div>
    </div>
  );
}

/* ── Placeholder ───────────────────────────────────────────────────── */

function ComingSoon() {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
      Not modeled in v1
    </div>
  );
}

/* ── Section header with model selector ────────────────────────────── */

/* ── Inline simulation controls (rendered inside each accordion trigger) ── */

function InlineSimControls({
  totalDays,
  onTotalDaysChange,
  simRunning,
  simPaused,
  onStartSim,
  onStopSim,
  onPauseSim,
  onResumeSim,
  config,
  onConfigChange,
}: {
  totalDays: number;
  onTotalDaysChange: (days: number) => void;
  simRunning: boolean;
  simPaused: boolean;
  onStartSim: () => void;
  onStopSim: () => void;
  onPauseSim: () => void;
  onResumeSim: () => void;
  config: OpenPondConfig;
  onConfigChange: (updates: Partial<OpenPondConfig>) => void;
}) {
  const stop = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <span
      className="ml-auto flex items-center gap-5 mr-2 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border"
      onClick={stop}
      onPointerDown={stop}
    >
      {/* Batch: Restart At (leftmost when visible) */}
      {config.harvest_mode === "batch" && (
        <span className="flex items-center gap-1">
          <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">Restart</span>
          <Slider
            min={0.3}
            max={Math.max(0.3, config.harvest_threshold / 2)}
            step={0.1}
            value={[config.harvest_target]}
            onValueChange={([v]) => onConfigChange({ harvest_target: v })}
            className="w-14"
            disabled={simRunning || simPaused}
          />
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground">{config.harvest_target.toFixed(1)}</span>
        </span>
      )}

      {/* Semi-continuous: Min Density / Batch: Harvest At */}
      {config.harvest_mode === "semi-continuous" && (
        <span className="flex items-center gap-1">
          <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">Min</span>
          <Slider
            min={0.3}
            max={2}
            step={0.1}
            value={[config.harvest_threshold]}
            onValueChange={([v]) => onConfigChange({ harvest_threshold: v })}
            className="w-14"
            disabled={simRunning || simPaused}
          />
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground">{config.harvest_threshold.toFixed(1)}</span>
        </span>
      )}
      {config.harvest_mode === "batch" && (
        <span className="flex items-center gap-1">
          <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">Harvest</span>
          <Slider
            min={0.5}
            max={2}
            step={0.1}
            value={[config.harvest_threshold]}
            onValueChange={([v]) => onConfigChange({ harvest_threshold: v })}
            className="w-14"
            disabled={simRunning || simPaused}
          />
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground">{config.harvest_threshold.toFixed(1)}</span>
        </span>
      )}

      {/* Harvest Mode */}
      <span className="flex rounded-md border border-border overflow-hidden">
        {(
          [
            { value: "none" as const, label: "No Harvest" },
            { value: "semi-continuous" as const, label: "Semi" },
            { value: "batch" as const, label: "Batch" },
          ] as const
        ).map((m) => (
          <span
            key={m.value}
            role="button"
            tabIndex={0}
            onClick={(e) => { stop(e); if (!simRunning && !simPaused) onConfigChange({ harvest_mode: m.value }); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); if (!simRunning && !simPaused) onConfigChange({ harvest_mode: m.value }); } }}
            className={`px-1.5 py-0.5 text-[10px] font-medium transition-colors select-none ${
              config.harvest_mode === m.value
                ? "bg-foreground text-background"
                : "bg-background text-muted-foreground hover:bg-muted"
            } ${simRunning || simPaused ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {m.label}
          </span>
        ))}
      </span>

      {/* Days slider */}
      <span className="flex items-center gap-1">
        <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">Days</span>
        <Slider
          min={3}
          max={14}
          step={1}
          value={[totalDays]}
          onValueChange={([v]) => onTotalDaysChange(v)}
          className="w-16"
          disabled={simRunning || simPaused}
        />
        <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-[1.2em] text-right">{totalDays}</span>
      </span>

      {/* Run / Pause+Stop (rightmost — fixed width) */}
      <span className="w-[100px] flex overflow-hidden rounded-md">
        {simRunning ? (
          <>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { stop(e); onPauseSim(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onPauseSim(); } }}
              className="flex-1 py-0.5 text-[10px] font-medium tracking-wide transition-colors text-center select-none cursor-pointer bg-background text-red-300 border border-red-300 hover:bg-red-50 rounded-l-md"
            >
              Pause
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { stop(e); onStopSim(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onStopSim(); } }}
              className="flex-1 py-0.5 text-[10px] font-medium tracking-wide transition-colors text-center select-none cursor-pointer bg-background text-red-500 border border-red-500 border-l-0 hover:bg-red-50 rounded-r-md"
            >
              Stop
            </span>
          </>
        ) : simPaused ? (
          <>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { stop(e); onResumeSim(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onResumeSim(); } }}
              className="flex-1 py-0.5 text-[10px] font-medium tracking-wide transition-colors text-center select-none cursor-pointer bg-background text-foreground border border-foreground hover:bg-muted rounded-l-md"
            >
              Resume
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { stop(e); onStopSim(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onStopSim(); } }}
              className="flex-1 py-0.5 text-[10px] font-medium tracking-wide transition-colors text-center select-none cursor-pointer bg-background text-red-500 border border-red-500 border-l-0 hover:bg-red-50 rounded-r-md"
            >
              Stop
            </span>
          </>
        ) : (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { stop(e); onStartSim(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onStartSim(); } }}
            className="flex-1 py-0.5 text-[10px] font-medium tracking-wide transition-colors text-center select-none cursor-pointer bg-background text-foreground border border-foreground hover:bg-muted rounded-md"
          >
            Run Simulation
          </span>
        )}
      </span>
    </span>
  );
}

function SectionHeader({
  title,
  models,
  activeId,
  onSelect,
}: {
  title: string;
  models: ModelConfig[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const active = models.find((m) => m.id === activeId);
  const others = models.filter((m) => m.id !== activeId);

  return (
    <span className="flex items-center gap-2 group/selector">
      {title}
      {active && (
        <span className="flex items-center gap-1 relative">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground group-hover/selector:bg-foreground/10 transition-colors">
            {active.name}
          </span>
          {others.map((m, i) => (
            <span
              key={m.id}
              onClick={(e) => { e.stopPropagation(); onSelect(m.id); }}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground cursor-pointer hover:bg-foreground/15 hover:text-foreground transition-all duration-200 max-w-0 opacity-0 overflow-hidden group-hover/selector:max-w-[150px] group-hover/selector:opacity-100 whitespace-nowrap"
              style={{ transitionDelay: `${(i + 1) * 50}ms` }}
            >
              {m.name}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/* ── Main export ───────────────────────────────────────────────────── */

export default function GrowthModelPanels({
  config,
  simTimestep,
  simRunning,
  simPaused,
  simResults,
  simIndex,
  onConfigChange,
  totalDays,
  onTotalDaysChange,
  onStartSim,
  onStopSim,
  onPauseSim,
  onResumeSim,
}: {
  config: OpenPondConfig;
  simTimestep: OpenPondTimestep | null;
  simRunning: boolean;
  simPaused: boolean;
  simResults: OpenPondTimestep[] | null;
  simIndex: number;
  onConfigChange: (updates: Partial<OpenPondConfig>) => void;
  totalDays: number;
  onTotalDaysChange: (days: number) => void;
  onStartSim: () => void;
  onStopSim: () => void;
  onPauseSim: () => void;
  onResumeSim: () => void;
}) {
  const [lightModelId, setLightModelId] = useState("haldane");
  const [attModelId, setAttModelId] = useState("beer-lambert");
  const [tempModelId, setTempModelId] = useState("gaussian-symmetric");

  const lightModel = LIGHT_RESPONSE_MODELS.find((m) => m.id === lightModelId) ?? LIGHT_RESPONSE_MODELS[0];
  const attModel = LIGHT_ATTENUATION_MODELS.find((m) => m.id === attModelId) ?? LIGHT_ATTENUATION_MODELS[0];
  const tempModel = TEMPERATURE_RESPONSE_MODELS.find((m) => m.id === tempModelId) ?? TEMPERATURE_RESPONSE_MODELS[0];

  const simControls = () => (
    <InlineSimControls
      totalDays={totalDays}
      onTotalDaysChange={onTotalDaysChange}
      simRunning={simRunning}
      simPaused={simPaused}
      onStartSim={onStartSim}
      onStopSim={onStopSim}
      onPauseSim={onPauseSim}
      onResumeSim={onResumeSim}
      config={config}
      onConfigChange={onConfigChange}
    />
  );

  return (
    <div className="w-full">
      <Accordion type="multiple" className="w-full">
        <AccordionItem value="light-response">
          <AccordionTrigger className="text-sm font-medium">
            <span className="flex flex-1 items-center">
              <SectionHeader
                title="Light Response"
                models={LIGHT_RESPONSE_MODELS}
                activeId={lightModelId}
                onSelect={setLightModelId}
              />
              {simControls()}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ModelVisualizer
              model={lightModel}
              config={config}
              simTimestep={simTimestep}
              simRunning={simRunning}
              simResults={simResults}
              simIndex={simIndex}
              onConfigChange={onConfigChange}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="light-attenuation">
          <AccordionTrigger className="text-sm font-medium">
            <span className="flex flex-1 items-center">
              <SectionHeader
                title="Light Attenuation"
                models={LIGHT_ATTENUATION_MODELS}
                activeId={attModelId}
                onSelect={setAttModelId}
              />
              {simControls()}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ModelVisualizer
              model={attModel}
              config={config}
              simTimestep={simTimestep}
              simRunning={simRunning}
              simResults={simResults}
              simIndex={simIndex}
              onConfigChange={onConfigChange}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="temperature-response">
          <AccordionTrigger className="text-sm font-medium">
            <span className="flex flex-1 items-center">
              <SectionHeader
                title="Temperature Response"
                models={TEMPERATURE_RESPONSE_MODELS}
                activeId={tempModelId}
                onSelect={setTempModelId}
              />
              {simControls()}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ModelVisualizer
              model={tempModel}
              config={config}
              simTimestep={simTimestep}
              simRunning={simRunning}
              simResults={simResults}
              simIndex={simIndex}
              onConfigChange={onConfigChange}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="heat-energy-balance">
          <AccordionTrigger className="text-sm font-medium">
            <span className="flex flex-1 items-center">
              <span className="flex items-center gap-2">Heat / Energy Balance</span>
              {simControls()}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <HeatBalancePanel
              simTimestep={simTimestep}
              simResults={simResults}
              simIndex={simIndex}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="mass-balance">
          <AccordionTrigger className="text-sm font-medium">
            <span className="flex flex-1 items-center">
              <span className="flex items-center gap-2">Mass Balance</span>
              {simControls()}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <MassBalancePanel
              simTimestep={simTimestep}
              simResults={simResults}
              simIndex={simIndex}
              config={config}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="nutrient-response">
          <AccordionTrigger className="text-sm font-medium">
            <span className="flex flex-1 items-center">
              <span className="flex items-center gap-2">Nutrient Response</span>
              {simControls()}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ComingSoon />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ph-response">
          <AccordionTrigger className="text-sm font-medium">
            <span className="flex flex-1 items-center">
              <span className="flex items-center gap-2">pH Response</span>
              {simControls()}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ComingSoon />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
