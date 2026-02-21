"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { getGlobalStart } from '@/lib/simulation/shared-timer';
import {
  type Cell,
  type ShapeVar,
  LOOP_DURATION,
  PAUSE_START,
  PAUSE_END,
  TOTAL_CYCLE,
  BASE_SIZE,
  SPLIT_SIZE,
  MX,
  MY,
  MR,
  MAX_CELLS,
  randomShape,
  blobPath,
  applyPhysics,
  createCell,
  createInitialCells,
} from '@/lib/simulation/cell-animation';

const GrowthRateVisualizer = () => {
  const [growthRate, setGrowthRate] = useState([0.7]);
  const [renderCells, setRenderCells] = useState<Cell[]>([]);
  const [timeLabel, setTimeLabel] = useState('0:00');
  const [animPhase, setAnimPhase] = useState<'pause-start' | 'running' | 'pause-end'>('pause-start');
  const [dayProgress, setDayProgress] = useState(0);
  const animRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const cellIdRef = useRef(0);
  const cellsRef = useRef<Cell[]>([]);
  const lastProgressRef = useRef(0);
  const [waterOffset, setWaterOffset] = useState(0);

  const mu = growthRate[0];

  const animate = useCallback(
    (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = getGlobalStart(timestamp);
      const elapsed = (timestamp - startTimeRef.current) % TOTAL_CYCLE;

      // Water
      setWaterOffset(Math.sin(timestamp * 0.0015) * 3);

      if (elapsed < PAUSE_START) {
        setAnimPhase('pause-start');
        setTimeLabel('0:00');
        setDayProgress(0);
        lastProgressRef.current = 0;
      } else if (elapsed < PAUSE_START + LOOP_DURATION) {
        setAnimPhase('running');
        const progress = (elapsed - PAUSE_START) / LOOP_DURATION;
        setDayProgress(progress);
        const hours = Math.floor(progress * 24);
        const mins = Math.floor((progress * 24 - hours) * 60);
        setTimeLabel(`${hours}:${mins.toString().padStart(2, '0')}`);

        const doublingsPerDay = mu / 0.693;
        const cells = cellsRef.current;

        // Grow cells & handle splitting
        for (const cell of cells) {
          const age = progress - cell.born;
          if (age < 0) continue;
          // Time to complete one division cycle
          const divisionTime = doublingsPerDay > 0 ? 1 / doublingsPerDay : 999;

          cell.growthPhase = Math.min((age % divisionTime) / divisionTime, 1);
          cell.size = BASE_SIZE + (SPLIT_SIZE - BASE_SIZE) * cell.growthPhase;

          // Start splitting when near end of cycle
          if (cell.growthPhase > 0.75 && !cell.splitting) {
            cell.splitting = true;
            cell.splitProgress = 0;
          }

          if (cell.splitting) {
            cell.splitProgress = Math.min(cell.splitProgress + 0.04, 1);
          }
        }

        // Complete splits: spawn daughter cells
        const newCells: Cell[] = [];
        const toRemove: Set<number> = new Set();

        for (const cell of cells) {
          if (cell.splitting && cell.splitProgress >= 1 && cells.length + newCells.length < MAX_CELLS) {
            const angle = cell.splitAngle;
            const offset = cell.size * 0.35;
            const d1 = createCell(
              cellIdRef.current++,
              cell.x + Math.cos(angle) * offset,
              cell.y + Math.sin(angle) * offset,
              progress
            );
            const d2 = createCell(
              cellIdRef.current++,
              cell.x - Math.cos(angle) * offset,
              cell.y - Math.sin(angle) * offset,
              progress
            );
            // Give daughters velocity pushing them apart
            d1.vx = Math.cos(angle) * 1.0;
            d1.vy = Math.sin(angle) * 1.0;
            d2.vx = -Math.cos(angle) * 1.0;
            d2.vy = -Math.sin(angle) * 1.0;
            d1.size = BASE_SIZE;
            d2.size = BASE_SIZE;
            newCells.push(d1, d2);
            toRemove.add(cell.id);
          }
        }

        if (toRemove.size > 0 || newCells.length > 0) {
          cellsRef.current = [
            ...cells.filter(c => !toRemove.has(c.id)),
            ...newCells,
          ];
        }

        // Physics
        applyPhysics(cellsRef.current);

        lastProgressRef.current = progress;
        setRenderCells([...cellsRef.current]);
      } else {
        setAnimPhase('pause-end');
        setTimeLabel('24:00');
        setDayProgress(1);
      }

      // Reset at cycle boundary
      if (elapsed >= TOTAL_CYCLE - 20) {
        const { cells: initialCells, nextId } = createInitialCells(0);
        cellsRef.current = initialCells;
        cellIdRef.current = nextId;
        lastProgressRef.current = 0;
      }

      animRef.current = requestAnimationFrame(animate);
    },
    [mu]
  );

  useEffect(() => {
    const { cells: initialCells, nextId } = createInitialCells(0);
    cellsRef.current = initialCells;
    cellIdRef.current = nextId;
    setRenderCells([...cellsRef.current]);
    startTimeRef.current = 0;
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [animate]);

  const currentMassForColor = Math.pow(2, mu * dayProgress);
  const colorProgress = Math.min(Math.log2(currentMassForColor) / Math.log2(16), 1); // 0 at 1kg, 1 at 16kg
  const waterGreen = Math.round(200 - colorProgress * 120); // 200 (pale) → 80 (dark)
  const waterAlpha = 0.4 + colorProgress * 0.5; // 0.4 (light) → 0.9 (dense)

  return (
    <div className="flex items-end gap-12 py-4 select-none">
      {/* Vertical Slider */}
      <div className="flex flex-col items-center shrink-0 w-44 border-2 border-dashed border-muted-foreground/30 rounded-lg px-4 py-4 relative mt-6">
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-medium text-foreground whitespace-nowrap">Specific Growth Rate μ₀ (/day)</span>
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background px-2 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
          ↕ drag to adjust
        </span>
        <span className="text-sm font-mono font-medium text-foreground mb-2">Fast</span>
        {(() => {
          // h-52 = 208px, thumb = 20px (h-5), so center travels 10px → 198px
          const fraction = 1 - mu / 4.0;
          const thumbTop = 10 + fraction * 188;
          return (
            <div className="h-52 relative w-full flex justify-center">
              {/* μ symbol on left of thumb */}
              <span
                className="absolute text-sm font-mono font-bold pointer-events-none whitespace-nowrap"
                style={{ left: 'calc(50% - 20px)', top: thumbTop, transform: 'translate(-100%, -50%)', color: 'hsl(var(--accent-science))' }}
              >
                μ₀
              </span>
              <Slider
                orientation="vertical"
                min={0}
                max={4.0}
                step={0.1}
                value={growthRate}
                onValueChange={setGrowthRate}
                className="h-full [&_span:first-child]:!bg-border [&_span_span]:!bg-[hsl(var(--accent-science))] [&_span[role=slider]]:!border-[hsl(var(--accent-science))] [&_span[role=slider]]:!bg-background"
              />
              {/* Dynamic value on right of thumb */}
              <span
                className="absolute text-sm font-mono font-bold pointer-events-none leading-tight"
                style={{ left: 'calc(50% + 16px)', top: thumbTop - 1, transform: 'translateY(-20%)', color: 'hsl(var(--accent-science))' }}
              >
                {mu.toFixed(2)}<br />
                <span className="text-[10px] font-normal text-muted-foreground" style={{ marginTop: '-3px', display: 'block', lineHeight: '1.1' }}>doublings<br />per day</span>
              </span>
            </div>
          );
        })()}
        <span className="text-sm font-mono font-medium text-foreground mt-2 mb-0">Slow</span>
      </div>

      {/* SVG Scene */}
      <svg viewBox="0 0 1045 320" className="w-full min-w-[900px]" aria-label="Algae growth visualization">
        {/* Beaker */}
        <g transform="translate(0, 50)">
          <defs>
            <clipPath id="beaker-clip">
              <path d="M61 41 L51 200 Q51 214 65 214 L135 214 Q149 214 149 200 L139 41 Z" />
            </clipPath>
          </defs>

          <g clipPath="url(#beaker-clip)">
            <path
              d={`M40 ${75 + waterOffset} Q70 ${69 + waterOffset} 100 ${75 + waterOffset} Q130 ${81 + waterOffset} 160 ${75 + waterOffset} L160 220 L40 220 Z`}
              fill={`rgba(60, ${waterGreen}, 80, ${waterAlpha})`}
            >
              <animate attributeName="d" dur="2.5s" repeatCount="indefinite"
                values="M40 75 Q70 69 100 75 Q130 81 160 75 L160 220 L40 220 Z;M40 80 Q70 84 100 79 Q130 73 160 79 L160 220 L40 220 Z;M40 75 Q70 69 100 75 Q130 81 160 75 L160 220 L40 220 Z" />
            </path>
          </g>

          <path d="M60 40 L50 200 Q50 215 65 215 L135 215 Q150 215 150 200 L140 40" fill="none" stroke="var(--border)" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M55 40 L60 40 M140 40 L145 40" fill="none" stroke="var(--border)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M55 40 Q55 36 58 36" fill="none" stroke="var(--border)" strokeWidth="2" />
          <path d="M145 40 Q145 36 142 36" fill="none" stroke="var(--border)" strokeWidth="2" />
          <line x1="52" y1="100" x2="58" y2="100" stroke="var(--border)" strokeWidth="1" />
          <line x1="51" y1="140" x2="57" y2="140" stroke="var(--border)" strokeWidth="1" />
          <line x1="51" y1="180" x2="56" y2="180" stroke="var(--border)" strokeWidth="1" />
          <text x="100" y="255" textAnchor="middle" className="text-sm font-mono" fill="var(--foreground)" fontWeight="500">Culture</text>
        </g>

        {/* Connector */}
        <line x1="137" y1="175" x2={MX - MR} y2={MY} stroke="var(--border)" strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx="125" cy="175" r="12" fill="none" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="3 3" />

        {/* Magnified view */}
        <g>
          <circle cx={MX} cy={MY} r={MR} fill={`rgba(60, ${waterGreen}, 80, 0.12)`} stroke="var(--border)" strokeWidth="2" />
          <clipPath id="magnifier-clip">
            <circle cx={MX} cy={MY} r={MR - 2} />
          </clipPath>
          <g clipPath="url(#magnifier-clip)">
            {renderCells.map((cell) => {
              const pinch = cell.splitting ? cell.splitProgress : 0;
              const g1 = 150 + cell.hueShift;
              return (
                <g key={cell.id}>
                  {/* Cell body - amorphous blob */}
                  <path
                    d={blobPath(cell.x, cell.y, cell.size, cell.shape, cell.rotation, pinch)}
                    fill={`rgba(50, ${g1}, 70, 0.72)`}
                    stroke={`rgba(40, 120, 55, 0.55)`}
                    strokeWidth="0.7"
                  />
                  {/* Nucleus */}
                  {!cell.splitting && (
                    <circle
                      cx={cell.x}
                      cy={cell.y}
                      r={cell.size * 0.13}
                      fill={`rgba(30, 100, 45, 0.55)`}
                    />
                  )}
                  {/* Splitting: two nuclei moving apart */}
                  {cell.splitting && (
                    <>
                      <circle
                        cx={cell.x + Math.cos(cell.splitAngle) * cell.size * 0.15 * cell.splitProgress}
                        cy={cell.y + Math.sin(cell.splitAngle) * cell.size * 0.15 * cell.splitProgress}
                        r={cell.size * 0.1}
                        fill={`rgba(30, 100, 45, 0.55)`}
                      />
                      <circle
                        cx={cell.x - Math.cos(cell.splitAngle) * cell.size * 0.15 * cell.splitProgress}
                        cy={cell.y - Math.sin(cell.splitAngle) * cell.size * 0.15 * cell.splitProgress}
                        r={cell.size * 0.1}
                        fill={`rgba(30, 100, 45, 0.55)`}
                      />
                    </>
                  )}
                </g>
              );
            })}
          </g>
          <text x={MX} y={305} textAnchor="middle" className="text-sm font-mono" fill="var(--foreground)" fontWeight="500">Magnified cells</text>
        </g>

        {/* Time indicator */}
        {(() => {
          const clockX = MX - 62;
          const clockY = 92;
          const clockR = 7;
          const handAngle = dayProgress * Math.PI * 2 - Math.PI / 2;
          return (
            <g>
              {/* Mini clock */}
              <circle cx={clockX} cy={clockY} r={clockR} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.2" />
              <circle cx={clockX} cy={clockY} r={0.8} fill="var(--muted-foreground)" />
              {/* Hour hand */}
              <line
                x1={clockX}
                y1={clockY}
                x2={clockX + Math.cos(handAngle) * (clockR * 0.6)}
                y2={clockY + Math.sin(handAngle) * (clockR * 0.6)}
                stroke="var(--muted-foreground)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              {/* Minute hand */}
              <line
                x1={clockX}
                y1={clockY}
                x2={clockX + Math.cos(handAngle * 12) * (clockR * 0.8)}
                y2={clockY + Math.sin(handAngle * 12) * (clockR * 0.8)}
                stroke="var(--muted-foreground)"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
              <text x={MX} y={clockY + 4} textAnchor="middle" className="text-sm font-mono" fill="var(--foreground)">
                t = {timeLabel} h
              </text>
              <rect x={MX - 50} y={clockY + 10} width={100} height={3} rx={1.5} fill="var(--border)" />
              <rect
                x={MX - 50} y={clockY + 10}
                width={animPhase === 'pause-start' ? 0 : animPhase === 'pause-end' ? 100 : 100 * ((timeLabel === '0:00' ? 0 : parseInt(timeLabel)) / 24)}
                height={3} rx={1.5}
                fill="hsl(var(--accent-science))"
              />
            </g>
          );
        })()}
        {/* Mass Growth Visualization */}
        {(() => {
          const trackX = 440;
          const trackW = 196;
          const trackY = 245;
          const startMass = 1;
          const maxMass = Math.pow(2, 4); // 16 kg
          const endMass = startMass * Math.pow(2, mu);
          const currentMass = startMass * Math.pow(2, mu * dayProgress);
          const massToX = (m: number) => trackX + (Math.log2(m) / Math.log2(maxMass)) * trackW;
          const thumbX = massToX(currentMass);
          const finalMarkerX = massToX(endMass);

          // Line chart dimensions (right column)
          const chartX = 765;
          const chartY = 57;
          const chartW = 260;
          const chartH = 200;
          const chartRight = chartX + chartW;
          const chartBottom = chartY + chartH;

          // Generate growth curve points
          const curvePoints: string[] = [];
          const numPoints = 60;
          for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints; // 0 to 1 (fraction of day)
            const mass = startMass * Math.pow(2, mu * t);
            const px = chartX + t * chartW;
            const py = chartBottom - ((mass - startMass) / (maxMass - startMass)) * chartH;
            curvePoints.push(`${px.toFixed(1)},${py.toFixed(1)}`);
          }
          const curvePath = `M${curvePoints.join(' L')}`;

          // Current position on curve
          const currentPx = chartX + dayProgress * chartW;
          const currentPy = chartBottom - ((currentMass - startMass) / (maxMass - startMass)) * chartH;

          // Y-axis ticks
          const yTicks = [1, 4, 8, 12, 16];

          return (
            <g>
              {/* ── Equations (above slider) ── */}
              <g>

                {/* Symbolic form */}
                <text x={trackX + trackW / 2} y={90} textAnchor="middle" className="text-base font-mono" fontWeight="600" letterSpacing="-1">
                  <tspan fill="var(--foreground)">X₀ × 2</tspan>
                  <tspan fill="hsl(var(--accent-science))" fontSize="0.7em" dy="-5">μ</tspan>
                  <tspan dy="5" fill="var(--foreground)"> = </tspan>
                  <tspan fill="hsl(var(--accent-science))">X₁</tspan>
                </text>

                {/* Numeric values */}
                <text x={trackX + trackW / 2} y={117} textAnchor="middle" className="text-sm font-mono" fontWeight="500" letterSpacing="-1" opacity="0.5">
                  <tspan fill="var(--foreground)">{startMass.toFixed(0)} kg × 2</tspan>
                  <tspan fill="hsl(var(--accent-science))" fontSize="0.7em" dy="-4">{mu.toFixed(1)}</tspan>
                  <tspan dy="4" fill="var(--foreground)"> = </tspan>
                  <tspan fill="hsl(var(--accent-science))">{endMass.toFixed(1)} kg</tspan>
                </text>
              </g>

              {/* ── Horizontal slider track ── */}
              <text x={trackX + trackW / 2} y={305} textAnchor="middle" className="text-sm font-mono" fill="var(--foreground)" fontWeight="500">
                Biomass Calculations
              </text>

              {/* Track background */}
              <rect x={trackX} y={trackY} width={trackW} height={6} rx={3} fill="var(--border)" />

              {/* Filled portion */}
              <rect x={trackX} y={trackY} width={Math.max(0, thumbX - trackX)} height={6} rx={3} fill="hsl(var(--accent-science))" />

              {/* Start marker */}
              <line x1={trackX} y1={trackY - 4} x2={trackX} y2={trackY + 12} stroke="var(--foreground)" strokeWidth="1.5" />
              <text x={trackX} y={trackY + 24} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)">
                {startMass.toFixed(1)} kg
              </text>

              {/* Right limit marker */}
              <line x1={trackX + trackW} y1={trackY - 4} x2={trackX + trackW} y2={trackY + 12} stroke="var(--foreground)" strokeWidth="1.5" strokeOpacity="0.25" />
              <text x={trackX + trackW} y={trackY + 24} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)" opacity="0.5">
                {maxMass.toFixed(0)} kg
              </text>

              {/* Final mass marker */}
              <line x1={finalMarkerX} y1={trackY - 8} x2={finalMarkerX} y2={trackY + 14} stroke="var(--foreground)" strokeWidth="1.5" strokeDasharray="3 2" />
              <text x={finalMarkerX} y={trackY - 12} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)">
                {endMass.toFixed(2)} kg
              </text>

              {/* Algae pile */}
              {(() => {
                const baseScale = 0.6;
                const currentScale = baseScale * Math.sqrt(currentMass);
                const endScale = baseScale * Math.sqrt(endMass);
                const pileBaseY = trackY - 38;

                const pilePath = "M-14,3 C-14,2 -13,0 -11,-2 C-10,-3 -9,-3 -8,-5 C-7,-6 -5,-7 -4,-9 C-3,-10 -1,-12 1,-11 C3,-10 4,-9 6,-7 C7,-5 8,-4 10,-3 C11,-1 13,1 13,2 C13,3 8,4 3,5 C-2,5 -8,4 -14,3 Z";
                const highlightPath = "M-8,1 C-7,-1 -5,-3 -3,-6 C-1,-8 1,-7 3,-5 C5,-3 7,-1 8,1 C5,2 -4,2 -8,1 Z";

                return (
                  <g>
                    <g transform={`translate(${finalMarkerX}, ${pileBaseY}) scale(${endScale})`} opacity="0.12">
                      <path d={pilePath} fill="var(--muted-foreground)" />
                    </g>
                    <g transform={`translate(${thumbX}, ${pileBaseY}) scale(${currentScale})`}>
                      <path d={pilePath} fill="hsl(140, 35%, 28%)" />
                      <path d={highlightPath} fill="hsl(140, 30%, 36%)" opacity="0.5" />
                      <circle cx="-6" cy="-2" r="1.2" fill="hsl(140, 25%, 22%)" opacity="0.4" />
                      <circle cx="2" cy="-5" r="1.0" fill="hsl(140, 20%, 38%)" opacity="0.35" />
                      <circle cx="7" cy="-1" r="0.9" fill="hsl(140, 25%, 22%)" opacity="0.4" />
                      <circle cx="-3" cy="-7" r="0.7" fill="hsl(140, 20%, 38%)" opacity="0.3" />
                      <circle cx="4" cy="-2" r="1.1" fill="hsl(140, 25%, 25%)" opacity="0.3" />
                    </g>
                  </g>
                );
              })()}

              {/* Animated thumb */}
              <circle cx={thumbX} cy={trackY + 3} r={7} fill="hsl(var(--accent-science))" stroke="var(--background)" strokeWidth="2" />

              {/* Current mass label */}
              <text x={thumbX} y={trackY - 12} textAnchor="middle" className="text-xs font-mono" fill="var(--foreground)" fontWeight="600">
                {currentMass.toFixed(2)} kg
              </text>

              {/* ── Line Chart (right column) ── */}
              <g>
                {/* Axes */}
                <line x1={chartX} y1={chartY} x2={chartX} y2={chartBottom} stroke="var(--border)" strokeWidth="1" />
                <line x1={chartX} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="var(--border)" strokeWidth="1" />

                {/* Y-axis ticks & labels */}
                {yTicks.map((val) => {
                  const py = chartBottom - ((val - startMass) / (maxMass - startMass)) * chartH;
                  return (
                    <g key={val}>
                      <line x1={chartX - 3} y1={py} x2={chartX} y2={py} stroke="var(--muted-foreground)" strokeWidth="0.8" />
                      <line x1={chartX} y1={py} x2={chartRight} y2={py} stroke="var(--border)" strokeWidth="0.5" strokeOpacity="0.4" />
                      <text x={chartX - 6} y={py + 3.5} textAnchor="end" className="text-xs font-mono" fill="var(--muted-foreground)">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* X-axis ticks */}
                {[0, 6, 12, 18, 24].map((hr) => {
                  const px = chartX + (hr / 24) * chartW;
                  return (
                    <g key={hr}>
                      <line x1={px} y1={chartBottom} x2={px} y2={chartBottom + 3} stroke="var(--muted-foreground)" strokeWidth="0.8" />
                      <text x={px} y={chartBottom + 14} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)">
                        {hr}h
                      </text>
                    </g>
                  );
                })}

                {/* Axis labels */}
                <text x={chartX - 24} y={chartY + chartH / 2} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)" transform={`rotate(-90, ${chartX - 24}, ${chartY + chartH / 2})`}>
                  Biomass (kg)
                </text>

                {/* Growth curve */}
                <path d={curvePath} fill="none" stroke="hsl(var(--accent-science))" strokeWidth="2" strokeLinejoin="round" />

                {/* Animated dot on curve */}
                <circle cx={currentPx} cy={currentPy} r={4} fill="hsl(var(--accent-science))" stroke="var(--background)" strokeWidth="1.5" />

                {/* Current mass label near dot - stays inside chart */}
                {(() => {
                  // How steep the curve is — drives how far left/down the label goes
                  const heightRatio = Math.min(1, Math.max(0, (currentMass - 1) / (maxMass - 1))); // 0 at 1kg, 1 at 16kg
                  const steepness = Math.min(1, endMass / maxMass); // how tall the final curve gets

                  // Progress-based smooth transition from right to left
                  const t = Math.min(1, Math.max(0, (dayProgress - 0.3) / 0.4));
                  const smooth = t * t * (3 - 2 * t);

                  // X offset: starts at +10, moves left more aggressively for steep curves
                  const maxLeftOffset = 12 + steepness * 30; // up to -42 for max steepness
                  const offsetX = 10 - smooth * (10 + maxLeftOffset);
                  const labelX = currentPx + offsetX;
                  const clampedX = Math.min(Math.max(labelX, chartX + 30), chartRight - 10);

                  // Y offset: stays above dot normally, but moves beside (same y) for steep curves at end
                  const yOffset = -8 + smooth * heightRatio * steepness * 12; // from -8 (above) toward +4 (beside)
                  const labelY = Math.max(currentPy + yOffset, chartY + 12);

                  return (
                    <text x={clampedX} y={labelY} textAnchor="middle" className="text-xs font-mono" fill="var(--foreground)" fontWeight="600">
                      {currentMass.toFixed(1)} kg
                    </text>
                  );
                })()}

                {/* Bottom label */}
                <text x={chartX + chartW / 2} y={305} textAnchor="middle" className="text-sm font-mono" fill="var(--foreground)" fontWeight="500">
                  Biomass Growth
                </text>
              </g>
            </g>
          );
        })()}
      </svg>
    </div>
  );
};

export default GrowthRateVisualizer;
