"use client";

import { useMemo, useEffect, useState, useRef } from 'react';

// ── Blob path (same as GrowthRateVisualizer) ──
type ShapeVar = number[];

function blobPath(cx: number, cy: number, size: number, shape: ShapeVar, rot: number, angularJitter?: number[]): string {
  const points: [number, number][] = [];
  const n = shape.length;
  for (let i = 0; i < n; i++) {
    const jit = angularJitter ? angularJitter[i % angularJitter.length] : 0;
    const angle = rot + (i / n) * Math.PI * 2 + jit;
    const rx = size * 0.55 * shape[i];
    const ry = size * 0.45 * shape[(i + 2) % n];
    points.push([
      cx + Math.cos(angle) * rx,
      cy + Math.sin(angle) * ry,
    ]);
  }
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const next = points[(i + 1) % n];
    const prev = points[(i - 1 + n) % n];
    const nextNext = points[(i + 2) % n];
    const cp1x = curr[0] + (next[0] - prev[0]) * 0.25;
    const cp1y = curr[1] + (next[1] - prev[1]) * 0.25;
    const cp2x = next[0] - (nextNext[0] - curr[0]) * 0.25;
    const cp2y = next[1] - (nextNext[1] - curr[1]) * 0.25;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${next[0].toFixed(1)},${next[1].toFixed(1)}`;
  }
  return d + 'Z';
}

// ── Spectrum helpers ──

/** Approximate blackbody-like solar irradiance (visible range, normalized 0-1) */
function gauss(nm: number, center: number, sigma: number): number {
  const d = (nm - center) / sigma;
  return Math.exp(-0.5 * d * d);
}

// AM1.5G solar spectral irradiance (W/m²/nm) at 5nm intervals, 380-750nm
// Source: ASTM G-173-03 reference spectrum (approximate values)
const SOLAR_AM15G: [number, number][] = [
  [380, 0.47], [385, 0.68], [390, 0.76], [395, 0.86],
  [400, 1.02], [405, 1.15], [410, 1.18], [415, 1.12], [420, 1.10],
  [425, 1.20], [430, 1.29], [435, 1.36], [440, 1.42], [445, 1.53],
  [450, 1.62], [455, 1.66], [460, 1.69], [465, 1.70], [470, 1.72],
  [475, 1.68], [480, 1.72], [485, 1.70], [490, 1.66], [495, 1.64],
  [500, 1.63], [505, 1.60], [510, 1.57], [515, 1.57], [520, 1.55],
  [525, 1.54], [530, 1.53], [535, 1.52], [540, 1.52], [545, 1.50],
  [550, 1.49], [555, 1.48], [560, 1.47], [565, 1.46], [570, 1.45],
  [575, 1.44], [580, 1.42], [585, 1.40], [590, 1.37], [595, 1.35],
  [600, 1.34], [605, 1.33], [610, 1.32], [615, 1.31], [620, 1.30],
  [625, 1.29], [630, 1.28], [635, 1.26], [640, 1.25], [645, 1.24],
  [650, 1.23], [655, 1.22], [660, 1.21], [665, 1.19], [670, 1.18],
  [675, 1.16], [680, 1.13], [685, 1.10], [690, 1.06], [695, 0.97],
  [700, 1.05], [705, 1.02], [710, 0.99], [715, 0.96], [720, 0.92],
  [725, 0.84], [730, 0.87], [735, 0.89], [740, 0.88], [745, 0.86],
  [750, 0.84],
];

const SOLAR_MAX = Math.max(...SOLAR_AM15G.map(d => d[1]));

/** Interpolated AM1.5G solar spectrum, normalized 0-1 */
function sunlightSpectrum(nm: number): number {
  if (nm <= SOLAR_AM15G[0][0]) return SOLAR_AM15G[0][1] / SOLAR_MAX;
  if (nm >= SOLAR_AM15G[SOLAR_AM15G.length - 1][0]) return SOLAR_AM15G[SOLAR_AM15G.length - 1][1] / SOLAR_MAX;
  // Linear interpolation
  for (let i = 0; i < SOLAR_AM15G.length - 1; i++) {
    const [w0, v0] = SOLAR_AM15G[i];
    const [w1, v1] = SOLAR_AM15G[i + 1];
    if (nm >= w0 && nm <= w1) {
      const t = (nm - w0) / (w1 - w0);
      return (v0 + t * (v1 - v0)) / SOLAR_MAX;
    }
  }
  return 0;
}

/** Approximate chlorophyll absorption spectrum (normalized 0-1) */
function algaeAbsorption(nm: number): number {
  const soret = 0.9 * gauss(nm, 430, 20);
  const qBand = 0.7 * gauss(nm, 680, 18);
  const chlB1 = 0.5 * gauss(nm, 460, 22);
  const chlB2 = 0.4 * gauss(nm, 650, 20);
  const carot = 0.35 * gauss(nm, 480, 30);
  return Math.min(1, soret + qBand + chlB1 + chlB2 + carot);
}

/** Individual pigment absorption spectra (raw, unnormalized) */
const pigmentAbsorptionRaw: Record<string, (nm: number) => number> = {
  chla: (nm) => 0.85 * gauss(nm, 430, 20) + 0.55 * gauss(nm, 662, 18),
  chlb: (nm) => 0.95 * gauss(nm, 460, 22) + 0.35 * gauss(nm, 642, 20),
  carot: (nm) => 0.4 * gauss(nm, 444, 10) + 0.45 * gauss(nm, 482, 22),
  pc: (nm) => 0.3 * gauss(nm, 545, 22) + 0.2 * gauss(nm, 565, 18),
  pe: (nm) => 0.4 * gauss(nm, 620, 22),
};

/** Find the max value of each pigment across the visible range */
const pigmentMaxValues: Record<string, number> = {};
for (const [id, fn] of Object.entries(pigmentAbsorptionRaw)) {
  let max = 0;
  for (let nm = 380; nm <= 750; nm++) {
    max = Math.max(max, fn(nm));
  }
  pigmentMaxValues[id] = max;
}

/** Normalized pigment absorption spectra — each peak reaches 1.0 (same as sunlight max) */
const pigmentAbsorption: Record<string, (nm: number) => number> = {};
for (const [id, fn] of Object.entries(pigmentAbsorptionRaw)) {
  const peak = pigmentMaxValues[id];
  pigmentAbsorption[id] = peak > 0 ? (nm: number) => fn(nm) / peak : fn;
}

/** Wavelength (nm) → visible-light RGB */
function nmToRGB(nm: number): string {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / (440 - 380); g = 0; b = 1;
  } else if (nm >= 440 && nm < 490) {
    r = 0; g = (nm - 440) / (490 - 440); b = 1;
  } else if (nm >= 490 && nm < 510) {
    r = 0; g = 1; b = -(nm - 510) / (510 - 490);
  } else if (nm >= 510 && nm < 580) {
    r = (nm - 510) / (580 - 510); g = 1; b = 0;
  } else if (nm >= 580 && nm < 645) {
    r = 1; g = -(nm - 645) / (645 - 580); b = 0;
  } else if (nm >= 645 && nm <= 780) {
    r = 1; g = 0; b = 0;
  }
  // Intensity falloff at edges
  let factor = 1;
  if (nm >= 380 && nm < 420) factor = 0.3 + 0.7 * (nm - 380) / (420 - 380);
  else if (nm > 700 && nm <= 780) factor = 0.3 + 0.7 * (780 - nm) / (780 - 700);
  else if (nm > 780 || nm < 380) factor = 0;
  r = Math.round(r * factor * 255);
  g = Math.round(g * factor * 255);
  b = Math.round(b * factor * 255);
  return `rgb(${r},${g},${b})`;
}

// ── Layout constants ──
const NM_MIN = 380;
const NM_MAX = 750;
const STEPS = 80;

// Sunlight chart
const sunX = 20;
const sunW = 240;
const chartTop = 60;
const chartH = 110;
const chartBot = chartTop + chartH;

// Cell (70% smaller, moved up)
const cellCX = 370;
const cellCY = 42;
const cellR = 27;
const cellScale = 0.3; // scale factor for pigment positions inside cell

// Bar chart (relative pigment contributions)
const barX = 290;
const barW = 170;
const barTop = chartTop;
const barH = chartH;
const barBot = barTop + barH;

// Absorption chart
const absX = 490;
const absW = 240;
const absChartH = 150;
const absChartBot = chartTop + absChartH;

// Equation area starts at
const eqX = absX + absW + 40;

const LightAbsorptionVisualizer = () => {
  const [hoveredPigment, setHoveredPigment] = useState<string | null>(null);
  const [pinnedPigments, setPinnedPigments] = useState<Set<string>>(new Set());
  const cellShape = useMemo<ShapeVar>(
    () => [0.94, 1.06, 0.98, 1.03, 0.95, 1.07, 0.99, 1.02, 0.93, 1.05, 0.97, 1.06, 0.96, 1.04, 0.98, 1.03],
    []
  );
  const cellAngularJitter = useMemo(
    () => [0.04, -0.06, 0.02, 0.07, -0.03, 0.05, -0.08, 0.01, 0.06, -0.04, 0.03, -0.07, 0.05, -0.02, 0.08, -0.05],
    []
  );

  // Pigment random walk animation
  const pigmentBasePositions = useMemo(() => {
    const maxR = cellR * 0.7;
    const items = [
      { x: -30 * cellScale, y: -25 * cellScale, rx: 9 * cellScale, ry: 4.5 * cellScale, fill: 'url(#pig-chla)', rot: 30 },
      { x: 40 * cellScale, y: -10 * cellScale, rx: 8 * cellScale, ry: 4 * cellScale, fill: 'url(#pig-chla)', rot: -15 },
      { x: -15 * cellScale, y: 35 * cellScale, rx: 9 * cellScale, ry: 4.5 * cellScale, fill: 'url(#pig-chla)', rot: 60 },
      { x: 15 * cellScale, y: -45 * cellScale, rx: 8 * cellScale, ry: 4 * cellScale, fill: 'url(#pig-chla)', rot: 10 },
      { x: -50 * cellScale, y: 10 * cellScale, rx: 8.5 * cellScale, ry: 4 * cellScale, fill: 'url(#pig-chla)', rot: -40 },
      { x: 45 * cellScale, y: 25 * cellScale, rx: 9 * cellScale, ry: 4 * cellScale, fill: 'url(#pig-chla)', rot: 45 },
      { x: -25 * cellScale, y: -50 * cellScale, rx: 8 * cellScale, ry: 4 * cellScale, fill: 'url(#pig-chla)', rot: -25 },
      { x: 10 * cellScale, y: 50 * cellScale, rx: 8.5 * cellScale, ry: 4 * cellScale, fill: 'url(#pig-chla)', rot: 70 },
      { x: -55 * cellScale, y: -15 * cellScale, rx: 7.5 * cellScale, ry: 4 * cellScale, fill: 'url(#pig-chla)', rot: 15 },
      { x: 50 * cellScale, y: -30 * cellScale, rx: 8 * cellScale, ry: 4 * cellScale, fill: 'url(#pig-chla)', rot: -55 },
      { x: -10 * cellScale, y: 5 * cellScale, rx: 7.5 * cellScale, ry: 3.5 * cellScale, fill: 'url(#pig-chla)', rot: 35 },
      { x: 20 * cellScale, y: 15 * cellScale, rx: 8 * cellScale, ry: 4 * cellScale, fill: 'url(#pig-chla)', rot: -70 },
      { x: -40 * cellScale, y: 30 * cellScale, rx: 7 * cellScale, ry: 3.5 * cellScale, fill: 'url(#pig-chlb)', rot: 20 },
      { x: 30 * cellScale, y: -35 * cellScale, rx: 6.5 * cellScale, ry: 3 * cellScale, fill: 'url(#pig-chlb)', rot: -30 },
      { x: -20 * cellScale, y: -40 * cellScale, rx: 7 * cellScale, ry: 3.5 * cellScale, fill: 'url(#pig-chlb)', rot: 50 },
      { x: 45 * cellScale, y: 40 * cellScale, rx: 6.5 * cellScale, ry: 3 * cellScale, fill: 'url(#pig-chlb)', rot: -10 },
      { x: -45 * cellScale, y: -30 * cellScale, rx: 6 * cellScale, ry: 3 * cellScale, fill: 'url(#pig-chlb)', rot: 65 },
      { x: 15 * cellScale, y: 40 * cellScale, rx: 6.5 * cellScale, ry: 3 * cellScale, fill: 'url(#pig-chlb)', rot: -45 },
      { x: -30 * cellScale, y: 20 * cellScale, rx: 3.5 * cellScale, ry: 3.5 * cellScale, fill: 'url(#pig-carot)', rot: 0 },
      { x: 35 * cellScale, y: -20 * cellScale, rx: 3 * cellScale, ry: 3 * cellScale, fill: 'url(#pig-carot)', rot: 0 },
      { x: -10 * cellScale, y: -30 * cellScale, rx: 3 * cellScale, ry: 3 * cellScale, fill: 'url(#pig-carot)', rot: 0 },
      { x: 20 * cellScale, y: 30 * cellScale, rx: 3 * cellScale, ry: 3 * cellScale, fill: 'url(#pig-pc)', rot: 0 },
      { x: -35 * cellScale, y: -10 * cellScale, rx: 2.5 * cellScale, ry: 2.5 * cellScale, fill: 'url(#pig-pc)', rot: 0 },
      { x: 25 * cellScale, y: -45 * cellScale, rx: 2.5 * cellScale, ry: 2.5 * cellScale, fill: 'url(#pig-pe)', rot: 0 },
      { x: -20 * cellScale, y: 45 * cellScale, rx: 3 * cellScale, ry: 3 * cellScale, fill: 'url(#pig-pe)', rot: 0 },
    ];
    return items.map(item => {
      const dist = Math.sqrt(item.x * item.x + item.y * item.y);
      const scale = dist > maxR ? maxR / dist : 1;
      return { ...item, bx: item.x * scale, by: item.y * scale };
    });
  }, []);

  const [pigmentOffsets, setPigmentOffsets] = useState<{ dx: number; dy: number; dr: number }[]>(
    () => pigmentBasePositions.map(() => ({ dx: 0, dy: 0, dr: 0 }))
  );

  const velocitiesRef = useRef<{ vx: number; vy: number; vr: number }[]>(
    pigmentBasePositions.map(() => ({ vx: 0, vy: 0, vr: 0 }))
  );

  useEffect(() => {
    const maxDrift = 5;
    const damping = 0.97;
    const jitter = 0.05;
    // Elliptical boundary matching the blob's aspect ratio (0.55 x, 0.45 y)
    const boundaryRx = cellR * 1.5 * 0.55 * 0.80;
    const boundaryRy = cellR * 1.5 * 0.45 * 0.80;
    let lastTime = performance.now();
    let rafId: number;

    const step = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.67, 3);
      lastTime = now;

      const vels = velocitiesRef.current;
      const bases = pigmentBasePositions;
      setPigmentOffsets(prev =>
        prev.map((off, i) => {
          vels[i].vx = vels[i].vx * damping + (Math.random() - 0.5) * jitter * dt;
          vels[i].vy = vels[i].vy * damping + (Math.random() - 0.5) * jitter * dt;
          vels[i].vr = vels[i].vr * damping + (Math.random() - 0.5) * 0.3 * dt;

          let nx = off.dx + vels[i].vx * dt;
          let ny = off.dy + vels[i].vy * dt;
          let nr = off.dr + vels[i].vr * dt;

          // Elliptical boundary check
          const absX = bases[i].bx + nx;
          const absY = bases[i].by + ny;
          const ellipseDist = (absX * absX) / (boundaryRx * boundaryRx) + (absY * absY) / (boundaryRy * boundaryRy);
          if (ellipseDist > 1) {
            const overshoot = (ellipseDist - 1) * 0.15;
            nx -= absX * overshoot;
            ny -= absY * overshoot;
            vels[i].vx *= 0.8;
            vels[i].vy *= 0.8;
            vels[i].vy *= 0.8;
          }

          // Clamp rotation drift
          nr = Math.max(-15, Math.min(15, nr));

          return { dx: nx, dy: ny, dr: nr };
        })
      );

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Generate spectrum curves
  const sunCurve = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const nm = NM_MIN + (i / STEPS) * (NM_MAX - NM_MIN);
      const val = sunlightSpectrum(nm);
      const px = sunX + (i / STEPS) * sunW;
      const py = chartBot - val * chartH;
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
    return `M${pts.join(' L')}`;
  }, []);

  const sunFill = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const nm = NM_MIN + (i / STEPS) * (NM_MAX - NM_MIN);
      const val = sunlightSpectrum(nm);
      const px = sunX + (i / STEPS) * sunW;
      const py = chartBot - val * chartH;
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
    return `M${sunX},${chartBot} L${pts.join(' L')} L${sunX + sunW},${chartBot} Z`;
  }, []);

  // Relative abundance scaling for absorption chart (interactive)
  const [absScales, setAbsScales] = useState<Record<string, number>>({ chla: 1, chlb: 0.4, carot: 0.1, pc: 0.15, pe: 0.05 });
  const absScaleRanges: Record<string, [number, number]> = {
    chla: [0.70, 1.00],
    carot: [0.00, 0.15],
    pc: [0.00, 0.20],
    pe: [0.00, 0.10],
    chlb: [0.30, 0.50],
  };
  const absColors: Record<string, string> = {
    chla: 'rgb(0, 128, 0)',
    chlb: 'rgb(100, 180, 50)',
    carot: 'rgb(220, 160, 0)',
    pc: 'rgb(0, 120, 200)',
    pe: 'rgb(200, 60, 100)',
  };

  const absPigmentCurves = useMemo(() => {
    const pigIds = ['chla', 'chlb', 'carot', 'pc', 'pe'] as const;
    return pigIds.map(pigId => {
      const fn = pigmentAbsorption[pigId];
      const scale = absScales[pigId];
      const pts: string[] = [];
      for (let i = 0; i <= STEPS; i++) {
        const nm = NM_MIN + (i / STEPS) * (NM_MAX - NM_MIN);
        const val = fn(nm) * scale / 1.25;
        const px = absX + (i / STEPS) * absW;
        const py = absChartBot - val * absChartH;
        pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      }
      const curvePath = `M${pts.join(' L')}`;
      const fillPath = `M${absX},${absChartBot} L${pts.join(' L')} L${absX + absW},${absChartBot} Z`;
      return { pigId, curvePath, fillPath, color: absColors[pigId], scale };
    });
  }, [absScales]);

  // Combined sum curve, normalized so peak = 1
  const absCombinedCurve = useMemo(() => {
    const pigIds = ['chla', 'chlb', 'carot', 'pc', 'pe'];
    const vals: number[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const nm = NM_MIN + (i / STEPS) * (NM_MAX - NM_MIN);
      let sum = 0;
      for (const pid of pigIds) sum += pigmentAbsorption[pid](nm) * absScales[pid];
      vals.push(sum);
    }
    const max = Math.max(...vals);
    const pts: string[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const normed = max > 0 ? vals[i] / max : 0;
      const px = absX + (i / STEPS) * absW;
      const py = absChartBot - normed * absChartH;
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
    const curvePath = `M${pts.join(' L')}`;
    const fillPath = `M${absX},${absChartBot} L${pts.join(' L')} L${absX + absW},${absChartBot} Z`;
    return { curvePath, fillPath };
  }, [absScales]);

  // Sunlight spectrum on absorption chart (using absX/absW coordinates)
  const absSunCurve = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const nm = NM_MIN + (i / STEPS) * (NM_MAX - NM_MIN);
      const val = sunlightSpectrum(nm);
      const px = absX + (i / STEPS) * absW;
      const py = absChartBot - val * absChartH;
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
    return `M${pts.join(' L')}`;
  }, []);

  // Inefficiency fill: area between sunlight curve (top) and combined absorption curve (bottom)
  const { absInefficiencyFill, mismatchPct } = useMemo(() => {
    const pigIds = ['chla', 'chlb', 'carot', 'pc', 'pe'];
    // Compute combined values and find max for normalization
    const combinedVals: number[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const nm = NM_MIN + (i / STEPS) * (NM_MAX - NM_MIN);
      let sum = 0;
      for (const pid of pigIds) sum += pigmentAbsorption[pid](nm) * absScales[pid];
      combinedVals.push(sum);
    }
    const max = Math.max(...combinedVals);

    // Forward along sunlight, backward along clamped combined (capped at sunlight)
    const sunPts: string[] = [];
    const combPts: string[] = [];
    let totalSun = 0;
    let totalMismatch = 0;
    for (let i = 0; i <= STEPS; i++) {
      const nm = NM_MIN + (i / STEPS) * (NM_MAX - NM_MIN);
      const px = absX + (i / STEPS) * absW;
      const sunVal = sunlightSpectrum(nm);
      const combVal = max > 0 ? combinedVals[i] / max : 0;
      // Clamp combined to sunlight so we only shade where sun > combined
      const clampedComb = Math.min(combVal, sunVal);
      sunPts.push(`${px.toFixed(1)},${(absChartBot - sunVal * absChartH).toFixed(1)}`);
      combPts.push(`${px.toFixed(1)},${(absChartBot - clampedComb * absChartH).toFixed(1)}`);
      totalSun += sunVal;
      totalMismatch += Math.max(0, sunVal - combVal);
    }
    const mismatchPct = totalSun > 0 ? (totalMismatch / totalSun) * 100 : 0;
    // Path: forward along sun, backward along clamped combined
    const absInefficiencyFill = `M${sunPts.join(' L')} L${combPts.reverse().join(' L')} Z`;
    return { absInefficiencyFill, mismatchPct };
  }, [absScales]);

  const spectrumStops = useMemo(() => {
    // Key spectral wavelengths: violet, blue, cyan, green, yellow, orange, red
    const keyNm = [380, 440, 490, 530, 570, 600, 650, 750];
    return keyNm.map(nm => ({
      offset: `${((nm - NM_MIN) / (NM_MAX - NM_MIN)) * 100}%`,
      color: nmToRGB(nm),
    }));
  }, []);

  // X-axis tick wavelengths
  const xTicks = [400, 450, 500, 550, 600, 650, 700, 750];

  return (
    <div className="py-4 select-none">
      <svg viewBox="0 0 1060 320" className="w-full min-w-[900px]" aria-label="Light absorption visualization">
        <defs>
          {/* Sunlight spectrum rainbow gradient */}
          <linearGradient id="sun-spectrum-grad" x1="0" y1="0" x2="1" y2="0">
            {spectrumStops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity="0.45" />
            ))}
          </linearGradient>
          <linearGradient id="abs-spectrum-grad" x1="0" y1="0" x2="1" y2="0">
            {spectrumStops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity="0.45" />
            ))}
          </linearGradient>
          {/* Arrows */}
          <marker id="arrow-abs" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
            <path d="M0,0 L6,2 L0,4" fill="hsl(var(--muted-foreground))" />
          </marker>
          {/* Sun beam gradient */}
          <linearGradient id="sun-beam-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(250, 200, 50)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="rgb(250, 200, 50)" stopOpacity="0.01" />
          </linearGradient>
          {/* Sun glow */}
          <radialGradient id="sun-glow">
            <stop offset="0%" stopColor="rgb(255, 220, 80)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="rgb(255, 220, 80)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── Sun Beam (behind chart) ── */}
        {(() => {
          const sunCX = sunX + sunW + 18 - 56;
          const sunCY = 22;
          const sunR = 14;

          const firstVal = sunlightSpectrum(NM_MIN);
          const lastVal = sunlightSpectrum(NM_MAX);
          const leftTarget = { x: sunX, y: chartBot - firstVal * chartH };
          const rightTarget = { x: sunX + sunW, y: chartBot - lastVal * chartH };

          const lAngle = Math.atan2(leftTarget.y - sunCY, leftTarget.x - sunCX);
          const lTangentAngle = lAngle + Math.PI / 2 - (20 * Math.PI) / 180;
          const sunLeftX = sunCX + Math.cos(lTangentAngle) * sunR;
          const sunLeftY = sunCY + Math.sin(lTangentAngle) * sunR;

          const rAngle = Math.atan2(rightTarget.y - sunCY, rightTarget.x - sunCX);
          const rTangentAngle = rAngle - Math.PI / 2;
          const sunRightX = sunCX + Math.cos(rTangentAngle) * sunR;
          const sunRightY = sunCY + Math.sin(rTangentAngle) * sunR;

          const curvePts: string[] = [];
          for (let i = 0; i <= STEPS; i++) {
            const nm = NM_MIN + (i / STEPS) * (NM_MAX - NM_MIN);
            const val = sunlightSpectrum(nm);
            const px = sunX + (i / STEPS) * sunW;
            const py = chartBot - val * chartH;
            curvePts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
          }

          const beamPath = `M${sunLeftX.toFixed(1)},${sunLeftY.toFixed(1)} L${sunX},${chartTop} L${curvePts.join(' L')} L${sunRightX.toFixed(1)},${sunRightY.toFixed(1)} A${sunR},${sunR} 0 1,1 ${sunLeftX.toFixed(1)},${sunLeftY.toFixed(1)} Z`;

          return (
            <g>
              <path d={beamPath} fill="url(#sun-beam-grad)" />
            </g>
          );
        })()}

        {/* ── Sunlight Emission Spectrum ── */}
        <g>

          {/* Y-axis */}
          <line x1={sunX} y1={chartTop} x2={sunX} y2={chartBot} stroke="hsl(var(--border))" strokeWidth="1" />
          {/* X-axis */}
          <line x1={sunX} y1={chartBot} x2={sunX + sunW} y2={chartBot} stroke="hsl(var(--border))" strokeWidth="1" />

          {/* Y-axis label */}
          <text x={sunX - 14} y={chartTop + chartH / 2} textAnchor="middle" className="text-[10px] font-mono" fill="hsl(var(--muted-foreground))" transform={`rotate(-90, ${sunX - 14}, ${chartTop + chartH / 2})`}>
            Relative Intensity
          </text>

          {/* X ticks */}
          {xTicks.filter(nm => nm <= NM_MAX).map(nm => {
            const px = sunX + ((nm - NM_MIN) / (NM_MAX - NM_MIN)) * sunW;
            return (
              <g key={nm}>
                <line x1={px} y1={chartBot} x2={px} y2={chartBot + 3} stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" />
                <text x={px} y={chartBot + 14} textAnchor="middle" className="text-[9px] font-mono" fill="hsl(var(--muted-foreground))">{nm}</text>
              </g>
            );
          })}
          <text x={sunX + sunW / 2} y={chartBot + 26} textAnchor="middle" className="text-[10px] font-mono" fill="hsl(var(--muted-foreground))">
            Wavelength (nm)
          </text>

          {/* Rainbow fill under curve */}
          <path d={sunFill} fill="url(#sun-spectrum-grad)" />
          {/* Curve */}
          <path d={sunCurve} fill="none" stroke="rgb(210, 150, 20)" strokeWidth="2" strokeLinejoin="round" />

          {/* Pinned + hovered pigment absorption overlays */}
          {(() => {
            const visible = new Set(pinnedPigments);
            if (hoveredPigment) visible.add(hoveredPigment);
            return Array.from(visible).map((pigId) => {
              const absFn = pigmentAbsorption[pigId];
              if (!absFn) return null;
              const isHovered = pigId === hoveredPigment;
              const pts: string[] = [];
              for (let i = 0; i <= STEPS; i++) {
                const nm = NM_MIN + (i / STEPS) * (NM_MAX - NM_MIN);
                const val = absFn(nm);
                const px = sunX + (i / STEPS) * sunW;
                const py = chartBot - val * chartH;
                pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
              }
              const curvePath = `M${pts.join(' L')}`;
              const fillPath = `M${sunX},${chartBot} L${pts.join(' L')} L${sunX + sunW},${chartBot} Z`;
              const baseColor = absColors[pigId] || 'rgb(120, 120, 120)';
              const strokeColor = isHovered ? baseColor : baseColor.replace('rgb', 'rgba').replace(')', ', 0.5)');
              const strokeW = isHovered ? 2 : 1.2;
              const fillColor = baseColor.replace('rgb', 'rgba').replace(')', isHovered ? ', 0.15)' : ', 0.08)');
              return (
                <g key={pigId}>
                  <path d={fillPath} fill={fillColor} />
                  <path d={curvePath} fill="none" stroke={strokeColor} strokeWidth={strokeW} strokeLinejoin="round" strokeDasharray="4 2" />
                </g>
              );
            });
          })()}

          {(() => {
            const iconY = chartBot + 50;
            const iconSpacing = sunW / 5;
            const r = 11;
            const pigments = [
              { id: 'chla', label: 'Chl a', peaks: [430, 662], bandWidths: [40, 40], fullName: 'Chlorophyll a' },
              { id: 'carot', label: 'Car', peaks: [450, 480], bandWidths: [35, 35], fullName: 'Carotenoids' },
              { id: 'pc', label: 'PC', peaks: [565], bandWidths: [25], fullName: 'Phycocyanin' },
              { id: 'pe', label: 'PE', peaks: [620], bandWidths: [20], fullName: 'Phycoerythrin' },
              { id: 'chlb', label: 'Chl b', peaks: [453, 642], bandWidths: [32, 30], fullName: 'Chlorophyll b' },
            ];
            return (
              <>
                {/* Gradient defs for pigments */}
                {pigments.map(p => {
                  if (p.peaks.length === 2) {
                    const peakGap = p.peaks[1] - p.peaks[0];
                    // For close peaks, use a continuous gradient; for far peaks, use a split
                    if (peakGap < 60) {
                      // Continuous band: outer1 → peak1 → midpoint → peak2 → outer2
                      const outer1 = nmToRGB(p.peaks[0] - p.bandWidths[0]);
                      const c1 = nmToRGB(p.peaks[0]);
                      const mid = nmToRGB((p.peaks[0] + p.peaks[1]) / 2);
                      const c2 = nmToRGB(p.peaks[1]);
                      const outer2 = nmToRGB(Math.min(750, p.peaks[1] + p.bandWidths[1]));
                      return (
                        <linearGradient key={p.id} id={`pig-${p.id}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={outer1} />
                          <stop offset="25%" stopColor={c1} />
                          <stop offset="50%" stopColor={mid} />
                          <stop offset="75%" stopColor={c2} />
                          <stop offset="100%" stopColor={outer2} />
                        </linearGradient>
                      );
                    } else {
                      // Split halves for widely separated peaks
                      const c1outer = nmToRGB(p.peaks[0] - p.bandWidths[0] * 0.3);
                      const c1 = nmToRGB(p.peaks[0]);
                      const c1edge = nmToRGB(p.peaks[0] + p.bandWidths[0]);
                      const c2edge = nmToRGB(p.peaks[1] - p.bandWidths[1]);
                      const c2 = nmToRGB(p.peaks[1]);
                      const c2outer = nmToRGB(Math.min(750, p.peaks[1] + p.bandWidths[1] * 0.3));
                      return (
                        <linearGradient key={p.id} id={`pig-${p.id}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={c1outer} />
                          <stop offset="15%" stopColor={c1} />
                          <stop offset="40%" stopColor={c1edge} />
                          <stop offset="50%" stopColor={c1edge} />
                          <stop offset="50%" stopColor={c2edge} />
                          <stop offset="60%" stopColor={c2edge} />
                          <stop offset="85%" stopColor={c2} />
                          <stop offset="100%" stopColor={c2outer} />
                        </linearGradient>
                      );
                    }
                  } else {
                    const c = nmToRGB(p.peaks[0]);
                    const cEdge1 = nmToRGB(p.peaks[0] - p.bandWidths[0]);
                    const cEdge2 = nmToRGB(p.peaks[0] + p.bandWidths[0]);
                    return (
                      <linearGradient key={p.id} id={`pig-${p.id}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={cEdge1} stopOpacity="0.6" />
                        <stop offset="50%" stopColor={c} />
                        <stop offset="100%" stopColor={cEdge2} stopOpacity="0.6" />
                      </linearGradient>
                    );
                  }
                })}

                {/* Dashed box around all pigments */}
                {(() => {
                  const boxPad = 8;
                  const boxX = sunX + iconSpacing / 2 - r * 1.4 - boxPad;
                  const boxY = iconY - r - boxPad;
                  const boxW = iconSpacing * 4 + r * 1.4 * 2 + boxPad * 2;
                  const boxH = r + r + 11 + 4 + boxPad * 2;
                  return (
                    <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={6} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.4" />
                  );
                })()}

                {pigments.map((p, i) => {
                  const px = sunX + iconSpacing * i + iconSpacing / 2;
                  return (
                    <g key={i} onMouseEnter={() => setHoveredPigment(p.id)} onMouseLeave={() => setHoveredPigment(null)} onClick={() => setPinnedPigments(prev => { const next = new Set(prev); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); return next; })} style={{ cursor: 'pointer' }}>
                      {/* Main icon */}
                      {(() => {
                        const isWide = p.id === 'chla' || p.id === 'chlb';
                        const rx = isWide ? r * 1.4 : r;
                        const ry = r;
                        const isHov = hoveredPigment === p.id;
                        const isPinned = pinnedPigments.has(p.id);
                        const borderW = isHov ? 2.5 : (isPinned ? 2 : 1.5);
                        return (
                          <>
                            <ellipse cx={px} cy={iconY} rx={rx} ry={ry} fill={`url(#pig-${p.id})`} />
                            {p.peaks.length === 2 && (
                              <line x1={px} y1={iconY - ry} x2={px} y2={iconY + ry} stroke="white" strokeWidth="0.8" opacity="0.7" />
                            )}
                            <ellipse cx={px} cy={iconY} rx={rx} ry={ry} fill="none" stroke={absColors[p.id] || 'rgb(30,30,30)'} strokeWidth={borderW} />
                          </>
                        );
                      })()}
                      {/* Label — name only, no nm */}
                      <text x={px} y={iconY + r + 11} textAnchor="middle" className="text-[8px] font-mono" fill="hsl(var(--foreground))" fontWeight="500">{p.label}</text>
                    </g>
                  );
                })}
                <text x={sunX + sunW / 2} y={iconY + r + 35} textAnchor="middle" className="text-sm font-mono" fill="hsl(var(--foreground))" fontWeight="500">
                  Light Absorbing Pigments
                </text>
              </>
            );
          })()}
        </g>

        {/* ── Sun Icon (on top of chart) ── */}
        {(() => {
          const sunCX = sunX + sunW + 18 - 56;
          const sunCY = 22;
          const sunR = 14;
          return (
            <g>
              <circle cx={sunCX} cy={sunCY} r={sunR * 2.2} fill="url(#sun-glow)" />
              <circle cx={sunCX} cy={sunCY} r={sunR} fill="rgb(250, 200, 50)" />
              <circle cx={sunCX} cy={sunCY} r={sunR - 2} fill="rgb(255, 220, 80)" />
              {Array.from({ length: 10 }, (_, i) => {
                const angle = (i / 10) * Math.PI * 2;
                const inner = sunR + 3;
                const outer = sunR + 8;
                return (
                  <line key={i}
                    x1={sunCX + Math.cos(angle) * inner} y1={sunCY + Math.sin(angle) * inner}
                    x2={sunCX + Math.cos(angle) * outer} y2={sunCY + Math.sin(angle) * outer}
                    stroke="rgb(250, 200, 50)" strokeWidth="1.5" strokeLinecap="round" />
                );
              })}
            </g>
          );
        })()}


        {/* ── Large Algae Cell ── */}
        <g>

          {/* Pigments inside cell — rendered first so they appear behind the cell membrane */}
          {pigmentBasePositions.map((item, i) => {
            const off = pigmentOffsets[i];
            const cx = cellCX + item.bx + off.dx;
            const cy = cellCY + item.by + off.dy;
            const rot = item.rot + off.dr;
            return (
              <ellipse
                key={`pig-cell-${i}`}
                cx={cx}
                cy={cy}
                rx={item.rx}
                ry={item.ry}
                fill={item.fill}
                stroke="rgb(30,30,30)"
                strokeWidth="0.3"
                transform={`rotate(${rot}, ${cx}, ${cy})`}
              />
            );
          })}

          {/* Cell blob — on top of pigments */}
          <path
            d={blobPath(cellCX, cellCY, cellR * 1.5, cellShape, 0.3, cellAngularJitter)}
            fill="rgba(130, 200, 140, 0.18)"
            stroke="rgba(40, 120, 55, 0.6)"
            strokeWidth="1.5"
          />

          {/* Nucleus */}
          <circle cx={cellCX} cy={cellCY} r={cellR * 0.12} fill="rgba(30, 100, 45, 0.6)" />

          <text x={cellCX} y={cellCY + cellR * 1.5 * 0.45 + 16} textAnchor="middle" className="text-[9px] font-mono" fill="hsl(var(--muted-foreground))" fontWeight="500">
            Algae Cell
          </text>
        </g>


        {/* ── Relative Pigment Contribution Bar Chart ── */}
        <g>
          {(() => {
            const pigments = [
              { id: 'chla', label: 'Chl a', scale: absScales.chla, color: absColors.chla },
              { id: 'carot', label: 'Car', scale: absScales.carot, color: absColors.carot },
              { id: 'pc', label: 'PC', scale: absScales.pc, color: absColors.pc },
              { id: 'pe', label: 'PE', scale: absScales.pe, color: absColors.pe },
              { id: 'chlb', label: 'Chl b', scale: absScales.chlb, color: absColors.chlb },
            ];
            const maxScale = Math.max(...pigments.map(p => p.scale));
            const barCount = pigments.length;
            const gap = 6;
            const totalGaps = (barCount - 1) * gap;
            const barWidth = (barW - totalGaps) / barCount;
            return (
              <>
                {/* X-axis */}
                <line x1={barX} y1={barBot} x2={barX + barW} y2={barBot} stroke="hsl(var(--border))" strokeWidth="1" />

                {/* Bars */}
                {pigments.map((p, i) => {
                  const x = barX + i * (barWidth + gap);
                  const normalizedH = (p.scale / maxScale) * barH;
                  const y = barBot - normalizedH;
                  const isHov = hoveredPigment === p.id;
                  const isPinned = pinnedPigments.has(p.id);
                  return (
                    <g key={p.id}
                      onMouseEnter={() => setHoveredPigment(p.id)}
                      onMouseLeave={() => setHoveredPigment(null)}
                      onClick={() => setPinnedPigments(prev => { const next = new Set(prev); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); return next; })}
                      style={{ cursor: 'pointer' }}
                    >
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={normalizedH}
                        fill={p.color}
                        fillOpacity={isHov ? 0.85 : (isPinned ? 0.7 : 0.55)}
                        rx={2}
                      />
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={normalizedH}
                        fill="none"
                        stroke={p.color}
                        strokeWidth={isHov ? 2 : (isPinned ? 1.5 : 1)}
                        rx={2}
                      />
                      {/* Value label above bar */}
                      <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" className="text-[8px] font-mono" fill={p.color} fontWeight="600">
                        {p.scale.toFixed(2)}
                      </text>
                      {/* Pigment name label below x-axis */}
                      <text x={x + barWidth / 2} y={barBot + 12} textAnchor="middle" className="text-[8px] font-mono" fill="hsl(var(--foreground))" fontWeight="500">{p.label}</text>
                    </g>
                  );
                })}
                <text x={barX + barW / 2} y={266} textAnchor="middle" className="text-sm font-mono" fill="hsl(var(--foreground))" fontWeight="500">
                  Relative Contribution
                </text>

                {/* Vertical sliders for each pigment */}
                {pigments.map((p, i) => {
                  const x = barX + i * (barWidth + gap);
                  const sliderTop = 196;
                  const sliderH = 46;
                  const range = absScaleRanges[p.id];
                  const sliderCx = x + barWidth / 2;
                  return (
                    <foreignObject key={`slider-${p.id}`} x={sliderCx - 8} y={sliderTop} width={16} height={sliderH}>
                      <input
                        type="range"
                        className="thin-slider"
                        min={range[0]}
                        max={range[1]}
                        step={0.01}
                        value={absScales[p.id]}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setAbsScales(prev => ({ ...prev, [p.id]: val }));
                        }}
                        style={{
                          writingMode: 'vertical-lr' as any,
                          direction: 'rtl',
                          width: '14px',
                          height: `${sliderH}px`,
                          color: p.color,
                          cursor: 'pointer',
                          margin: '0 auto',
                          padding: 0,
                          display: 'block',
                        }}
                      />
                    </foreignObject>
                  );
                })}
              </>
            );
          })()}
        </g>


        {/* ── Algae Absorption Spectrum ── */}
        <g>

          {/* Y-axis */}
          <line x1={absX} y1={chartTop} x2={absX} y2={absChartBot} stroke="hsl(var(--border))" strokeWidth="1" />
          {/* X-axis */}
          <line x1={absX} y1={absChartBot} x2={absX + absW} y2={absChartBot} stroke="hsl(var(--border))" strokeWidth="1" />

          {/* Y-axis label */}
          <text x={absX - 14} y={chartTop + absChartH / 2} textAnchor="middle" className="text-[10px] font-mono" fill="hsl(var(--muted-foreground))" transform={`rotate(-90, ${absX - 14}, ${chartTop + absChartH / 2})`}>
            Absorbance
          </text>

          {/* X ticks */}
          {xTicks.filter(nm => nm <= NM_MAX).map(nm => {
            const px = absX + ((nm - NM_MIN) / (NM_MAX - NM_MIN)) * absW;
            return (
              <g key={nm}>
                <line x1={px} y1={absChartBot} x2={px} y2={absChartBot + 3} stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" />
                <text x={px} y={absChartBot + 14} textAnchor="middle" className="text-[9px] font-mono" fill="hsl(var(--muted-foreground))">{nm}</text>
              </g>
            );
          })}
          <text x={absX + absW / 2} y={absChartBot + 26} textAnchor="middle" className="text-[10px] font-mono" fill="hsl(var(--muted-foreground))">
            Wavelength (nm)
          </text>

          {/* Inefficiency shading between sunlight and combined curves */}
          <path d={absInefficiencyFill} fill="rgb(200, 60, 40)" fillOpacity="0.15" />
          {/* Label in the gap between curves */}
          {(() => {
            // Position label around 580nm where the gap is wide
            const labelNm = 580;
            const labelPx = absX + ((labelNm - NM_MIN) / (NM_MAX - NM_MIN)) * absW - 17;
            const sunVal = sunlightSpectrum(labelNm);
            // Approximate combined value at this nm
            const pigIds = ['chla', 'chlb', 'carot', 'pc', 'pe'];
            let sum = 0;
            for (const pid of pigIds) sum += pigmentAbsorption[pid](labelNm) * absScales[pid];
            const combMax = 1.7; // approximate max of combined sum
            const combVal = sum / combMax;
            const midY = absChartBot - ((sunVal + combVal) / 2) * absChartH;
            return (
              <>
                <text x={labelPx} y={midY - 16} textAnchor="middle" className="text-[10px] font-mono" fill="rgb(200, 60, 40)" fontWeight="700">
                  mismatch =
                </text>
                <text x={labelPx} y={midY - 4} textAnchor="middle" className="text-[10px] font-mono" fill="rgb(200, 60, 40)" fontWeight="700">
                  wasted
                </text>
                <text x={labelPx} y={midY + 8} textAnchor="middle" className="text-[10px] font-mono" fill="rgb(200, 60, 40)" fontWeight="700">
                  energy
                </text>
              </>
            );
          })()}

          {/* Individual pigment curves (faded, no fill) */}
          {absPigmentCurves.map(({ pigId, curvePath, color }) => (
            <g key={pigId}>
              <path d={curvePath} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" opacity="0.4" />
            </g>
          ))}
          {/* Combined normalized sum curve */}
          <path d={absCombinedCurve.curvePath} fill="none" stroke="rgb(30, 120, 50)" strokeWidth="2" strokeLinejoin="round" />
          <path d={absSunCurve} fill="none" stroke="rgb(180, 130, 10)" strokeWidth="2" strokeLinejoin="round" />

          <text x={absX + absW / 2} y={266} textAnchor="middle" className="text-sm font-mono" fill="hsl(var(--foreground))" fontWeight="500">
            Absorption Spectrum
          </text>
        </g>

        {/* ── Equations ── */}
        <g>

          {/* Variable definitions */}
          <text x={eqX} y={chartTop + 18} className="text-[11px] font-mono" fill="hsl(var(--foreground))">
            <tspan fill="rgb(180, 130, 10)" fontWeight="600">S</tspan>
            <tspan fill="rgb(180, 130, 10)">(λ)</tspan>
            <tspan> = solar emission spectrum</tspan>
          </text>
          <text x={eqX} y={chartTop + 34} className="text-[11px] font-mono" fill="hsl(var(--foreground))">
            <tspan fill="rgb(30, 120, 50)" fontWeight="600">A</tspan>
            <tspan fill="rgb(30, 120, 50)">(λ)</tspan>
            <tspan> = pigment absorption spectrum</tspan>
          </text>

          {/* Divider */}
          <line x1={eqX} y1={chartTop + 42} x2={eqX + 230} y2={chartTop + 42} stroke="hsl(var(--border))" strokeWidth="0.5" />

          {/* Spectral Mismatch */}
          <text x={eqX} y={chartTop + 58} className="text-[11px] font-mono" fill="hsl(var(--foreground))">
            <tspan fontWeight="600">Spectral mismatch:</tspan>
          </text>
          <text x={eqX} y={chartTop + 80} className="text-sm font-mono" fill="hsl(var(--foreground))">
            <tspan fill="rgb(200, 60, 40)">η</tspan>
            <tspan fill="rgb(200, 60, 40)" baselineShift="sub" className="text-[9px]">mis</tspan>
            <tspan> = </tspan>
            <tspan>Σ</tspan>
            <tspan baselineShift="sub" className="text-[9px]">λ</tspan>
            <tspan> max(0, </tspan>
            <tspan fill="rgb(180, 130, 10)">S</tspan>
            <tspan fill="rgb(180, 130, 10)">(λ)</tspan>
            <tspan> − </tspan>
            <tspan fill="rgb(30, 120, 50)">A</tspan>
            <tspan fill="rgb(30, 120, 50)">(λ)</tspan>
            <tspan>)</tspan>
          </text>
          {/* Divider bar for fraction */}
          <line x1={eqX + 30} y1={chartTop + 85} x2={eqX + 210} y2={chartTop + 85} stroke="hsl(var(--foreground))" strokeWidth="1" />
          <text x={eqX + 120} y={chartTop + 100} textAnchor="middle" className="text-sm font-mono" fill="hsl(var(--foreground))">
            <tspan>Σ</tspan>
            <tspan baselineShift="sub" className="text-[9px]">λ</tspan>
            <tspan> </tspan>
            <tspan fill="rgb(180, 130, 10)">S</tspan>
            <tspan fill="rgb(180, 130, 10)">(λ)</tspan>
          </text>

          {/* Divider */}
          <line x1={eqX} y1={chartTop + 112} x2={eqX + 230} y2={chartTop + 112} stroke="hsl(var(--border))" strokeWidth="0.5" />

          {/* Live computed value */}
          <text x={eqX} y={chartTop + 130} className="text-sm font-mono" fontWeight="500" opacity="0.5">
            <tspan fill="rgb(200, 60, 40)">η</tspan>
            <tspan fill="rgb(200, 60, 40)" baselineShift="sub" className="text-[9px]">mis</tspan>
            <tspan fill="rgb(200, 60, 40)"> = {mismatchPct.toFixed(1)}%</tspan>
          </text>
          <text x={eqX} y={chartTop + 146} className="text-[10px] font-mono" fill="hsl(var(--muted-foreground))" opacity="0.5">
            {mismatchPct.toFixed(1)}% of solar energy is not absorbed
          </text>
        </g>
      </svg>
    </div>
  );
};

export default LightAbsorptionVisualizer;
