"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { getGlobalStart, shouldYieldToInteraction } from '@/lib/simulation/shared-timer';
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

const LightEffectsVisualizer = () => {
    const [lightIntensity, setLightIntensity] = useState([200]);
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

    const intensity = lightIntensity[0];
    // Derive growth rate from light factor: f(I) = (I/Iopt) * e^(1 - I/Iopt)
    const Iopt = 300;
    const muMax = 4.0;
    const ratio = intensity / Iopt;
    const lightFactor = ratio * Math.exp(1 - ratio);
    const mu = muMax * lightFactor;

    const animate = useCallback(
        (timestamp: number) => {
            if (shouldYieldToInteraction()) {
                animRef.current = requestAnimationFrame(animate);
                return;
            }
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

    // Light fraction for glow/ray intensity
    const lightFraction = intensity / 1000; // 0 (dim) → 1 (bright)

    // Culture base color stays constant (pale green)
    const waterGreen = 200;
    const waterAlpha = 0.4;

    // Light strip brightness
    const lightStripOpacity = 0.15 + lightFraction * 0.85; // 0.15 (dim) → 1.0 (bright)

    return (
        <div className="flex items-end gap-12 py-4 select-none">
            {/* Vertical Slider */}
            <div className="flex flex-col items-center shrink-0 w-44 border-2 border-dashed border-muted-foreground/30 rounded-lg px-4 py-4 relative mt-6">
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-medium text-foreground whitespace-nowrap">Intensity I (<span className="text-[0.7em]">µ</span>E/m²/s)</span>
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background px-2 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                    ↕ drag to adjust
                </span>
                <span className="text-sm font-mono font-medium text-foreground mb-2">High</span>
                {(() => {
                    const fraction = 1 - intensity / 1000;
                    const thumbTop = 10 + fraction * 188;
                    const optFraction = 1 - 300 / 1000;
                    const optTop = 10 + optFraction * 188;
                    return (
                        <div className="h-52 relative w-full flex justify-center">
                            {/* Optimal marker */}
                            <span
                                className="absolute text-[10px] font-mono text-muted-foreground pointer-events-none whitespace-nowrap"
                                style={{ left: 'calc(50% - 12px)', top: optTop, transform: 'translate(-100%, -50%)' }}
                            >
                                <span style={{ position: 'relative', left: '-4px', top: '1px' }}>optimal</span> <span style={{ fontSize: '1.3em' }}>→</span>
                            </span>
                            {/* I symbol on left of thumb */}
                            <span
                                className="absolute text-sm font-mono font-bold pointer-events-none whitespace-nowrap"
                                style={{ left: 'calc(50% - 30px)', top: thumbTop, transform: 'translate(-100%, -50%)', color: 'rgb(210, 150, 20)' }}
                            >
                                I
                            </span>
                            <Slider
                                orientation="vertical"
                                min={0}
                                max={1000}
                                step={20}
                                value={lightIntensity}
                                onValueChange={setLightIntensity}
                                className="h-full [&_span:first-child]:!bg-border [&_span_span]:!bg-[rgb(210,150,20)] [&_span[role=slider]]:!border-[rgb(210,150,20)] [&_span[role=slider]]:!bg-background"
                            />
                            {/* Dynamic value on right of thumb */}
                            <span
                                className="absolute text-sm font-mono font-bold pointer-events-none leading-tight"
                                style={{ left: 'calc(50% + 16px)', top: thumbTop - 1, transform: 'translateY(-20%)', color: 'rgb(210, 150, 20)' }}
                            >
                                {intensity}<br />
                                <span className="text-[10px] font-normal text-muted-foreground" style={{ marginTop: '-3px', display: 'block' }}>μE/m²/s</span>
                            </span>
                        </div>
                    );
                })()}
                <span className="text-sm font-mono font-medium text-foreground mt-2 mb-0">Low</span>
            </div>

            {/* SVG Scene */}
            <svg viewBox="0 0 1045 320" className="w-full min-w-[900px]" aria-label="Light effects visualization">
                {/* Beaker */}
                <g transform="translate(0, 50)">
                    <defs>
                        <clipPath id="beaker-clip-light">
                            <path d="M61 41 L51 200 Q51 214 65 214 L135 214 Q149 214 149 200 L139 41 Z" />
                        </clipPath>
                        {/* Light source glow gradient (vertical, for the strip) */}
                        <linearGradient id="light-strip-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={`rgba(230, 170, 40, ${lightStripOpacity})`} />
                            <stop offset="50%" stopColor={`rgba(240, 190, 60, ${lightStripOpacity})`} />
                            <stop offset="100%" stopColor={`rgba(230, 170, 40, ${lightStripOpacity})`} />
                        </linearGradient>
                        {/* Light emanating into culture */}
                        <linearGradient id="light-culture-grad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={`rgba(240, 180, 40, ${lightStripOpacity * 0.7})`} />
                            <stop offset="30%" stopColor={`rgba(240, 190, 50, ${lightStripOpacity * 0.55})`} />
                            <stop offset="60%" stopColor={`rgba(240, 190, 50, ${lightStripOpacity * 0.4})`} />
                            <stop offset="80%" stopColor={`rgba(240, 190, 50, ${lightStripOpacity * 0.25})`} />
                            <stop offset="100%" stopColor={`rgba(240, 190, 50, ${lightStripOpacity * 0.15})`} />
                        </linearGradient>
                        {/* Radial glow from the light source */}
                        <radialGradient id="light-glow" cx="0" cy="0.5" r="1" fx="0" fy="0.5">
                            <stop offset="0%" stopColor={`rgba(255, 230, 80, ${lightStripOpacity * 0.5})`} />
                            <stop offset="60%" stopColor={`rgba(255, 220, 60, ${lightStripOpacity * 0.15})`} />
                            <stop offset="100%" stopColor="rgba(255, 220, 60, 0)" />
                        </radialGradient>
                    </defs>

                    {/* Light source strip */}
                    {/* Light panel: fill + dark border on top/left/bottom, open on right */}
                    <rect x="30" y="44" width="18" height="171" fill="url(#light-strip-grad)" />
                    <path d="M48,43 L33,43 Q30,43 30,46 L30,212 Q30,215 33,215 L48,215" fill="none" stroke="var(--foreground)" strokeWidth="2" strokeLinejoin="round" />
                    <text x="22" y="130" textAnchor="middle" className="text-[10px] font-mono" fill="var(--muted-foreground)" transform="rotate(-90, 22, 130)">Light</text>

                    {/* Light rays emanating rightward into culture */}
                    {[55, 75, 95, 115, 135, 155, 175, 195].map((ry) => {
                        const rayLen = 50 + lightFraction * 40;
                        return (
                            <line key={ry} x1="48" y1={ry} x2={48 + rayLen} y2={ry}
                                stroke={`rgba(230, 170, 40, ${lightStripOpacity * 0.35})`}
                                strokeWidth="1.2" />
                        );
                    })}

                    {/* Culture fill: base green */}
                    <g clipPath="url(#beaker-clip-light)">
                        <path
                            d={`M40 ${75 + waterOffset} Q70 ${69 + waterOffset} 100 ${75 + waterOffset} Q130 ${81 + waterOffset} 160 ${75 + waterOffset} L160 220 L40 220 Z`}
                            fill={`rgba(60, ${waterGreen}, 80, ${waterAlpha})`}
                        >
                            <animate attributeName="d" dur="2.5s" repeatCount="indefinite"
                                values="M40 75 Q70 69 100 75 Q130 81 160 75 L160 220 L40 220 Z;M40 80 Q70 84 100 79 Q130 73 160 79 L160 220 L40 220 Z;M40 75 Q70 69 100 75 Q130 81 160 75 L160 220 L40 220 Z" />
                        </path>
                        {/* Light overlay: yellow/orange gradient fading left→right */}
                        <rect x="40" y="40" width="120" height="180" fill="url(#light-culture-grad)" />
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
                    <clipPath id="magnifier-clip-light">
                        <circle cx={MX} cy={MY} r={MR - 2} />
                    </clipPath>
                    <g clipPath="url(#magnifier-clip-light)">
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
                {/* Light Factor Curve */}
                {(() => {
                    const chartX = 440;
                    const chartY = 127;
                    const chartW = 230;
                    const chartH = 130;
                    const chartRight = chartX + chartW;
                    const chartBottom = chartY + chartH;

                    const Iopt = 300;
                    const maxI = 1000;
                    const muMaxChart = 4.0;

                    const growthFromI = (I: number) => {
                        const ratio = I / Iopt;
                        return muMaxChart * ratio * Math.exp(1 - ratio);
                    };

                    // Generate curve points
                    const curvePoints: string[] = [];
                    const numPoints = 100;
                    for (let i = 0; i <= numPoints; i++) {
                        const I = (i / numPoints) * maxI;
                        const y = growthFromI(I);
                        const px = chartX + (I / maxI) * chartW;
                        const py = chartBottom - (y / muMaxChart) * chartH;
                        curvePoints.push(`${px.toFixed(1)},${py.toFixed(1)}`);
                    }
                    const curvePath = `M${curvePoints.join(' L')}`;

                    const currentMu = growthFromI(intensity);
                    const thumbPx = chartX + (intensity / maxI) * chartW;
                    const thumbPy = chartBottom - (currentMu / muMaxChart) * chartH;

                    const yTicks = [0, 1, 2, 3, 4];
                    const xTicks = [0, 200, 400, 600, 800, 1000];

                    // Biomass chart dimensions (right column)
                    const bChartX = 765;
                    const bChartY = 57;
                    const bChartW = 260;
                    const bChartH = 200;
                    const bChartRight = bChartX + bChartW;
                    const bChartBottom = bChartY + bChartH;

                    const startMass = 1;
                    const maxMass = 16;
                    const endMass = startMass * Math.pow(2, mu);
                    const currentMass = startMass * Math.pow(2, mu * dayProgress);

                    const bCurvePoints: string[] = [];
                    for (let i = 0; i <= 60; i++) {
                        const t = i / 60;
                        const mass = startMass * Math.pow(2, mu * t);
                        const px = bChartX + t * bChartW;
                        const py = bChartBottom - ((mass - startMass) / (maxMass - startMass)) * bChartH;
                        bCurvePoints.push(`${px.toFixed(1)},${py.toFixed(1)}`);
                    }
                    const bCurvePath = `M${bCurvePoints.join(' L')}`;

                    // Optimal biomass curve (mu = muMax)
                    const bOptimalPoints: string[] = [];
                    for (let i = 0; i <= 60; i++) {
                        const t = i / 60;
                        const mass = Math.min(maxMass, startMass * Math.pow(2, muMax * t));
                        const px = bChartX + t * bChartW;
                        const py = bChartBottom - ((mass - startMass) / (maxMass - startMass)) * bChartH;
                        bOptimalPoints.push(`${px.toFixed(1)},${py.toFixed(1)}`);
                    }
                    const bOptimalPath = `M${bOptimalPoints.join(' L')}`;
                    const bFillPath = `${bOptimalPath} L${[...bCurvePoints].reverse().join(' L')} Z`;

                    const bCurrentPx = bChartX + dayProgress * bChartW;
                    const bCurrentPy = bChartBottom - ((currentMass - startMass) / (maxMass - startMass)) * bChartH;

                    const bYTicks = [1, 4, 8, 12, 16];

                    return (
                        <g>
                            {/* ── Equations (above chart) ── */}
                            <g>
                                {/* Symbolic form */}
                                <text x={chartX + chartW / 2} y={55} textAnchor="middle" className="text-base font-mono" fontWeight="600" letterSpacing="-1">
                                    <tspan fill="hsl(var(--accent-science))">μ</tspan>
                                    <tspan fill="var(--foreground)"> = μ₀ × (</tspan>
                                    <tspan fill="rgb(210, 150, 20)">I</tspan>
                                    <tspan fill="var(--foreground)">/I</tspan>
                                    <tspan fill="var(--foreground)" fontSize="0.7em" dy="3">opt</tspan>
                                    <tspan dy="-3" fill="var(--foreground)">)</tspan>
                                    <tspan fill="var(--foreground)"> · e</tspan>
                                    <tspan fontSize="0.7em" dy="-5"><tspan fill="var(--foreground)">1-(</tspan><tspan fill="rgb(210, 150, 20)">I</tspan><tspan fill="var(--foreground)">/Iopt)</tspan></tspan>
                                    <tspan dy="5"></tspan>
                                </text>

                                {/* Numeric values */}
                                <text x={chartX + chartW / 2} y={83} textAnchor="middle" className="text-sm font-mono" fontWeight="500" letterSpacing="-1" opacity="0.5">
                                    <tspan fill="hsl(var(--accent-science))">{mu.toFixed(1)} /day</tspan>
                                    <tspan fill="var(--foreground)"> = {muMax.toFixed(0)} × (</tspan>
                                    <tspan fill="rgb(210, 150, 20)">{intensity}</tspan>
                                    <tspan fill="var(--foreground)">/{Iopt}) · e</tspan>
                                    <tspan fontSize="0.7em" dy="-4"><tspan fill="var(--foreground)">1-(</tspan><tspan fill="rgb(210, 150, 20)">{intensity}</tspan><tspan fill="var(--foreground)">/{Iopt})</tspan></tspan>
                                    <tspan dy="4"></tspan>
                                </text>
                            </g>

                            {/* ── Growth Rate vs Intensity Chart ── */}
                            <g>
                                <line x1={chartX} y1={chartY} x2={chartX} y2={chartBottom} stroke="var(--border)" strokeWidth="1" />
                                <line x1={chartX} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="var(--border)" strokeWidth="1" />

                                {yTicks.map((val) => {
                                    const py = chartBottom - (val / muMaxChart) * chartH;
                                    return (
                                        <g key={val}>
                                            <line x1={chartX - 3} y1={py} x2={chartX} y2={py} stroke="var(--muted-foreground)" strokeWidth="0.8" />
                                            <line x1={chartX} y1={py} x2={chartRight} y2={py} stroke="var(--border)" strokeWidth="0.5" strokeOpacity="0.3" />
                                            <text x={chartX - 6} y={py + 3.5} textAnchor="end" className="text-xs font-mono" fill="var(--muted-foreground)">
                                                {val}
                                            </text>
                                        </g>
                                    );
                                })}

                                {xTicks.map((val) => {
                                    const px = chartX + (val / maxI) * chartW;
                                    return (
                                        <g key={val}>
                                            <line x1={px} y1={chartBottom} x2={px} y2={chartBottom + 3} stroke="var(--muted-foreground)" strokeWidth="0.8" />
                                            <text x={px} y={chartBottom + 14} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)">
                                                {val}
                                            </text>
                                        </g>
                                    );
                                })}

                                <text x={chartX - 20} y={chartY + chartH / 2} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)" transform={`rotate(-90, ${chartX - 20}, ${chartY + chartH / 2})`}>
                                    μ (/day)
                                </text>
                                <text x={chartX + chartW / 2} y={chartBottom + 28} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)">
                                    Intensity (μE/m²/s)
                                </text>

                                <line x1={chartX + (Iopt / maxI) * chartW} y1={chartY} x2={chartX + (Iopt / maxI) * chartW} y2={chartBottom} stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.5" />
                                <text x={chartX + (Iopt / maxI) * chartW - 5} y={chartY + chartH / 2} textAnchor="middle" className="text-[10px] font-mono" fill="var(--muted-foreground)" transform={`rotate(-90, ${chartX + (Iopt / maxI) * chartW - 5}, ${chartY + chartH / 2})`}>
                                    optimal
                                </text>

                                <path d={curvePath} fill="none" stroke="rgb(210, 150, 20)" strokeWidth="2.5" strokeLinejoin="round" />
                                <circle cx={thumbPx} cy={thumbPy} r={6} fill="rgb(210, 150, 20)" stroke="var(--background)" strokeWidth="2" />
                                <text x={thumbPx + 10} y={thumbPy - 8} textAnchor="start" className="text-xs font-mono" fill="var(--foreground)" fontWeight="600">
                                    μ = {currentMu.toFixed(2)}
                                </text>

                                <text x={chartX + chartW / 2} y={305} textAnchor="middle" className="text-sm font-mono" fill="var(--foreground)" fontWeight="500">
                                    Light Response Curve
                                </text>
                            </g>

                            {/* ── Biomass Growth Chart ── */}
                            <g>
                                <line x1={bChartX} y1={bChartY} x2={bChartX} y2={bChartBottom} stroke="var(--border)" strokeWidth="1" />
                                <line x1={bChartX} y1={bChartBottom} x2={bChartRight} y2={bChartBottom} stroke="var(--border)" strokeWidth="1" />

                                {bYTicks.map((val) => {
                                    const py = bChartBottom - ((val - startMass) / (maxMass - startMass)) * bChartH;
                                    return (
                                        <g key={val}>
                                            <line x1={bChartX - 3} y1={py} x2={bChartX} y2={py} stroke="var(--muted-foreground)" strokeWidth="0.8" />
                                            <line x1={bChartX} y1={py} x2={bChartRight} y2={py} stroke="var(--border)" strokeWidth="0.5" strokeOpacity="0.3" />
                                            <text x={bChartX - 6} y={py + 3.5} textAnchor="end" className="text-xs font-mono" fill="var(--muted-foreground)">
                                                {val}
                                            </text>
                                        </g>
                                    );
                                })}

                                {[0, 6, 12, 18, 24].map((hr) => {
                                    const px = bChartX + (hr / 24) * bChartW;
                                    return (
                                        <g key={hr}>
                                            <line x1={px} y1={bChartBottom} x2={px} y2={bChartBottom + 3} stroke="var(--muted-foreground)" strokeWidth="0.8" />
                                            <text x={px} y={bChartBottom + 14} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)">
                                                {hr}h
                                            </text>
                                        </g>
                                    );
                                })}

                                <text x={bChartX - 24} y={bChartY + bChartH / 2} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)" transform={`rotate(-90, ${bChartX - 24}, ${bChartY + bChartH / 2})`}>
                                    Biomass (kg)
                                </text>

                                {/* Optimal biomass shadow + limitation fill */}
                                {mu < muMax && (
                                    <>
                                        <path d={bFillPath} fill="rgba(210, 150, 20, 0.1)" stroke="none" />
                                        <text x={bChartX + bChartW * 0.38} y={bChartY + bChartH * 0.52} textAnchor="middle" className="text-[9px] font-mono" fill="rgb(210, 150, 20)" fontWeight="500" opacity="0.8">
                                            limitation effect
                                        </text>
                                    </>
                                )}
                                <path d={bOptimalPath} fill="none" stroke="rgb(210, 150, 20)" strokeWidth="1.5" strokeDasharray="4 3" strokeOpacity="0.35" />

                                <path d={bCurvePath} fill="none" stroke="hsl(var(--accent-science))" strokeWidth="2" strokeLinejoin="round" />
                                <circle cx={bCurrentPx} cy={bCurrentPy} r={4} fill="hsl(var(--accent-science))" stroke="var(--background)" strokeWidth="1.5" />

                                {(() => {
                                    const heightRatio = Math.min(1, Math.max(0, (currentMass - 1) / (maxMass - 1)));
                                    const steepness = Math.min(1, endMass / maxMass);

                                    const t = Math.min(1, Math.max(0, (dayProgress - 0.3) / 0.4));
                                    const smooth = t * t * (3 - 2 * t);

                                    const maxLeftOffset = 12 + steepness * 30;
                                    const offsetX = 10 - smooth * (10 + maxLeftOffset);
                                    const labelX = bCurrentPx + offsetX;
                                    const clampedX = Math.min(Math.max(labelX, bChartX + 30), bChartRight - 10);

                                    const yOffset = -8 + smooth * heightRatio * steepness * 12;
                                    const labelY = Math.max(bCurrentPy + yOffset, bChartY + 12);

                                    return (
                                        <text x={clampedX} y={labelY} textAnchor="middle" className="text-xs font-mono" fill="var(--foreground)" fontWeight="600">
                                            {currentMass.toFixed(1)} kg
                                        </text>
                                    );
                                })()}

                                <text x={bChartX + bChartW / 2} y={305} textAnchor="middle" className="text-sm font-mono" fill="var(--foreground)" fontWeight="500">
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

export default LightEffectsVisualizer;
