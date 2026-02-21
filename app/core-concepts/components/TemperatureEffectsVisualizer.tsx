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

const TemperatureEffectsVisualizer = () => {
    const [temperature, setTemperature] = useState([25]);
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

    const temp = temperature[0];
    const Topt = 30;
    const muMax = 4.0;
    const alpha = 0.01;
    const tempFactor = Math.exp(-alpha * Math.pow(temp - Topt, 2));
    const mu = muMax * tempFactor;

    const animate = useCallback(
        (timestamp: number) => {
            if (!startTimeRef.current) startTimeRef.current = getGlobalStart(timestamp);
            const elapsed = (timestamp - startTimeRef.current) % TOTAL_CYCLE;

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

                for (const cell of cells) {
                    const age = progress - cell.born;
                    if (age < 0) continue;
                    const divisionTime = doublingsPerDay > 0 ? 1 / doublingsPerDay : 999;
                    cell.growthPhase = Math.min((age % divisionTime) / divisionTime, 1);
                    cell.size = BASE_SIZE + (SPLIT_SIZE - BASE_SIZE) * cell.growthPhase;

                    if (cell.growthPhase > 0.75 && !cell.splitting) {
                        cell.splitting = true;
                        cell.splitProgress = 0;
                    }

                    if (cell.splitting) {
                        cell.splitProgress = Math.min(cell.splitProgress + 0.04, 1);
                    }
                }

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

                applyPhysics(cellsRef.current);
                lastProgressRef.current = progress;
                setRenderCells([...cellsRef.current]);
            } else {
                setAnimPhase('pause-end');
                setTimeLabel('24:00');
                setDayProgress(1);
            }

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

    // Temperature fraction for visual effects (0=cold, 1=hot)
    const tempFraction = (temp - 10) / 40;

    const waterGreen = 200;
    const waterAlpha = 0.4;

    // Theme color: warm red/coral
    const themeColor = 'rgb(200, 80, 60)';

    return (
        <div className="flex items-end gap-12 py-4 select-none">
            {/* Vertical Slider */}
            <div className="flex flex-col items-center shrink-0 w-44 border-2 border-dashed border-muted-foreground/30 rounded-lg px-4 py-4 relative mt-6">
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-medium text-foreground whitespace-nowrap">Temperature T (°C)</span>
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background px-2 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                    ↕ drag to adjust
                </span>
                <span className="text-sm font-mono font-medium text-foreground mb-2">Hot</span>
                {(() => {
                    const fraction = 1 - (temp - 10) / 40;
                    const thumbTop = 10 + fraction * 188;
                    const optFraction = 1 - (Topt - 10) / 40;
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
                            {/* T symbol on left of thumb */}
                            <span
                                className="absolute text-sm font-mono font-bold pointer-events-none whitespace-nowrap"
                                style={{ left: 'calc(50% - 30px)', top: thumbTop, transform: 'translate(-100%, -50%)', color: themeColor }}
                            >
                                T
                            </span>
                            <Slider
                                orientation="vertical"
                                min={10}
                                max={50}
                                step={1}
                                value={temperature}
                                onValueChange={setTemperature}
                                className="h-full [&_span:first-child]:!bg-border [&_span_span]:!bg-[rgb(200,80,60)] [&_span[role=slider]]:!border-[rgb(200,80,60)] [&_span[role=slider]]:!bg-background"
                            />
                            {/* Dynamic value on right of thumb */}
                            <span
                                className="absolute text-sm font-mono font-bold pointer-events-none leading-tight"
                                style={{ left: 'calc(50% + 16px)', top: thumbTop - 1, transform: 'translateY(-20%)', color: themeColor }}
                            >
                                {temp}<br />
                                <span className="text-[10px] font-normal text-muted-foreground" style={{ marginTop: '-3px', display: 'block' }}>°C</span>
                            </span>
                        </div>
                    );
                })()}
                <span className="text-sm font-mono font-medium text-foreground mt-2 mb-0">Cold</span>
            </div>

            {/* SVG Scene */}
            <svg viewBox="0 0 1045 320" className="w-full min-w-[900px]" aria-label="Temperature effects visualization">
                {/* Beaker with temperature indicator */}
                <g transform="translate(0, 50)">
                    <defs>
                        <clipPath id="beaker-clip-temp">
                            <path d="M61 41 L51 200 Q51 214 65 214 L135 214 Q149 214 149 200 L139 41 Z" />
                        </clipPath>
                        {/* Clip path that follows the wave surface */}
                        <clipPath id="wave-clip-temp">
                            <path d="M40 75 Q70 69 100 75 Q130 81 160 75 L160 220 L40 220 Z">
                                <animate attributeName="d" dur="2.5s" repeatCount="indefinite"
                                    values="M40 75 Q70 69 100 75 Q130 81 160 75 L160 220 L40 220 Z;M40 80 Q70 84 100 79 Q130 73 160 79 L160 220 L40 220 Z;M40 75 Q70 69 100 75 Q130 81 160 75 L160 220 L40 220 Z" />
                            </path>
                        </clipPath>
                        {/* Temperature gradient overlay: warm colors when hot, cool when cold */}
                        <linearGradient id="temp-culture-grad" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="0%" stopColor={`rgba(200, 80, 60, ${tempFraction * 0.3})`} />
                            <stop offset="50%" stopColor={`rgba(200, 80, 60, ${tempFraction * 0.15})`} />
                            <stop offset="100%" stopColor={`rgba(200, 80, 60, ${tempFraction * 0.05})`} />
                        </linearGradient>
                    </defs>

                    {/* Thermometer — single connected outline (tube + bulb) */}
                    {(() => {
                        const cx = 40, bulbCy = 210, bulbR = 10, tubeW = 12, tubeTop = 50;
                        const halfTube = tubeW / 2;
                        // The tube bottom meets the bulb where the tube width intersects the circle
                        const joinAngle = Math.asin(halfTube / bulbR);
                        const joinY = bulbCy - bulbR * Math.cos(joinAngle);
                        // Outline: tube sides → rounded top → arc around bulb
                        const outlinePath = `
              M${cx - halfTube} ${joinY}
              L${cx - halfTube} ${tubeTop + halfTube}
              A${halfTube} ${halfTube} 0 0 1 ${cx + halfTube} ${tubeTop + halfTube}
              L${cx + halfTube} ${joinY}
              A${bulbR} ${bulbR} 0 1 1 ${cx - halfTube} ${joinY}
              Z
            `;
                        // Mercury: use a single connected path (bulb + column) with slight inset for white gap in tube only
                        const mercuryHeight = 11 + tempFraction * 138;
                        const mercuryTop = joinY - mercuryHeight;
                        const mercuryOpacity = 0.5 + tempFraction * 0.5;
                        const innerTubeW = tubeW - 4;
                        const halfInner = innerTubeW / 2;
                        const innerBulbR = bulbR - 1.5;
                        // Mercury path: column connects seamlessly into bulb
                        const mercuryJoinAngle = Math.asin(halfInner / innerBulbR);
                        const mercuryJoinY = bulbCy - innerBulbR * Math.cos(mercuryJoinAngle);
                        const mercuryPath = `
              M${cx - halfInner} ${mercuryTop + halfInner}
              A${halfInner} ${halfInner} 0 0 1 ${cx + halfInner} ${mercuryTop + halfInner}
              L${cx + halfInner} ${mercuryJoinY}
              A${innerBulbR} ${innerBulbR} 0 1 1 ${cx - halfInner} ${mercuryJoinY}
              Z
            `;

                        return (
                            <g>
                                {/* White fill background */}
                                <path d={outlinePath} fill="var(--background)" stroke="none" />
                                {/* Mercury: single connected shape */}
                                <path d={mercuryPath} fill={themeColor} opacity={mercuryOpacity} />
                                {/* Border outline on top */}
                                <path d={outlinePath} fill="none" stroke="var(--foreground)" strokeWidth="1.5" />
                            </g>
                        );
                    })()}
                    {/* Temperature ticks */}
                    {[10, 20, 30, 40, 50].map((t) => {
                        const frac = (t - 10) / 40;
                        const y = 195 - frac * 140;
                        return (
                            <g key={t}>
                                <line x1="30" y1={y} x2="34" y2={y} stroke="var(--muted-foreground)" strokeWidth="0.8" />
                                <text x="28" y={y + 3} textAnchor="end" className="text-[8px] font-mono" fill="var(--muted-foreground)">{t}°</text>
                            </g>
                        );
                    })}


                    {/* Culture fill */}
                    <g clipPath="url(#beaker-clip-temp)">
                        <path
                            d={`M40 75 Q70 69 100 75 Q130 81 160 75 L160 220 L40 220 Z`}
                            fill={`rgba(60, ${waterGreen}, 80, ${waterAlpha})`}
                        >
                            <animate attributeName="d" dur="2.5s" repeatCount="indefinite"
                                values="M40 75 Q70 69 100 75 Q130 81 160 75 L160 220 L40 220 Z;M40 80 Q70 84 100 79 Q130 73 160 79 L160 220 L40 220 Z;M40 75 Q70 69 100 75 Q130 81 160 75 L160 220 L40 220 Z" />
                        </path>
                        {/* Temperature overlay + shimmer — clipped to wave surface */}
                        <g clipPath="url(#wave-clip-temp)">
                            <rect x="40" y="40" width="120" height="180" fill="url(#temp-culture-grad)" />
                            {/* Heat shimmer lines when hot */}
                            {tempFraction > 0.5 && (
                                <g opacity={Math.min(1, (tempFraction - 0.5) * 2)}>
                                    {[95, 125, 155, 185].map((y, i) => (
                                        <path
                                            key={y}
                                            d={`M${65 + i * 3} ${y} Q${75 + i * 2} ${y - 3} ${85 + i * 3} ${y} Q${95 + i * 2} ${y + 3} ${105 + i * 3} ${y}`}
                                            fill="none"
                                            stroke={`rgba(200, 80, 60, ${0.15 + tempFraction * 0.15})`}
                                            strokeWidth="0.8"
                                        />
                                    ))}
                                </g>
                            )}
                        </g>
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
                    <clipPath id="magnifier-clip-temp">
                        <circle cx={MX} cy={MY} r={MR - 2} />
                    </clipPath>
                    <g clipPath="url(#magnifier-clip-temp)">
                        {renderCells.map((cell) => {
                            const pinch = cell.splitting ? cell.splitProgress : 0;
                            const g1 = 150 + cell.hueShift;
                            return (
                                <g key={cell.id}>
                                    <path
                                        d={blobPath(cell.x, cell.y, cell.size, cell.shape, cell.rotation, pinch)}
                                        fill={`rgba(50, ${g1}, 70, 0.72)`}
                                        stroke={`rgba(40, 120, 55, 0.55)`}
                                        strokeWidth="0.7"
                                    />
                                    {!cell.splitting && (
                                        <circle
                                            cx={cell.x}
                                            cy={cell.y}
                                            r={cell.size * 0.13}
                                            fill={`rgba(30, 100, 45, 0.55)`}
                                        />
                                    )}
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
                            <circle cx={clockX} cy={clockY} r={clockR} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.2" />
                            <circle cx={clockX} cy={clockY} r={0.8} fill="var(--muted-foreground)" />
                            <line
                                x1={clockX} y1={clockY}
                                x2={clockX + Math.cos(handAngle) * (clockR * 0.6)}
                                y2={clockY + Math.sin(handAngle) * (clockR * 0.6)}
                                stroke="var(--muted-foreground)" strokeWidth="1.2" strokeLinecap="round"
                            />
                            <line
                                x1={clockX} y1={clockY}
                                x2={clockX + Math.cos(handAngle * 12) * (clockR * 0.8)}
                                y2={clockY + Math.sin(handAngle * 12) * (clockR * 0.8)}
                                stroke="var(--muted-foreground)" strokeWidth="0.8" strokeLinecap="round"
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

                {/* Temperature Response Curve & Biomass Growth Chart */}
                {(() => {
                    const chartX = 440;
                    const chartY = 127;
                    const chartW = 230;
                    const chartH = 130;
                    const chartRight = chartX + chartW;
                    const chartBottom = chartY + chartH;

                    const minT = 10;
                    const maxT = 50;
                    const muMaxChart = 4.0;

                    const growthFromT = (T: number) => {
                        return muMaxChart * Math.exp(-alpha * Math.pow(T - Topt, 2));
                    };

                    const curvePoints: string[] = [];
                    const numPoints = 100;
                    for (let i = 0; i <= numPoints; i++) {
                        const T = minT + (i / numPoints) * (maxT - minT);
                        const y = growthFromT(T);
                        const px = chartX + ((T - minT) / (maxT - minT)) * chartW;
                        const py = chartBottom - (y / muMaxChart) * chartH;
                        curvePoints.push(`${px.toFixed(1)},${py.toFixed(1)}`);
                    }
                    const curvePath = `M${curvePoints.join(' L')}`;

                    const currentMu = growthFromT(temp);
                    const thumbPx = chartX + ((temp - minT) / (maxT - minT)) * chartW;
                    const thumbPy = chartBottom - (currentMu / muMaxChart) * chartH;

                    const yTicks = [0, 1, 2, 3, 4];
                    const xTicks = [10, 20, 30, 40, 50];

                    // Biomass chart
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
                            {/* ── Equations ── */}
                            <g>
                                {/* Symbolic form */}
                                <text x={chartX + chartW / 2} y={55} textAnchor="middle" className="text-base font-mono" fontWeight="600" letterSpacing="-1">
                                    <tspan fill="hsl(var(--accent-science))">μ</tspan>
                                    <tspan fill="var(--foreground)"> = μ₀ × e</tspan>
                                    <tspan fontSize="0.7em" dy="-5"><tspan fill="var(--foreground)">-α(</tspan><tspan fill="rgb(200, 80, 60)">T</tspan><tspan fill="var(--foreground)">-T</tspan></tspan>
                                    <tspan fill="var(--foreground)" fontSize="0.5em" dy="3">opt</tspan>
                                    <tspan fontSize="0.7em" dy="-3" fill="var(--foreground)">)²</tspan>
                                    <tspan dy="5"></tspan>
                                </text>

                                {/* Numeric values */}
                                <text x={chartX + chartW / 2} y={83} textAnchor="middle" className="text-sm font-mono" fontWeight="500" letterSpacing="-1" opacity="0.5">
                                    <tspan fill="hsl(var(--accent-science))">{mu.toFixed(1)} /day</tspan>
                                    <tspan fill="var(--foreground)"> = {muMax.toFixed(0)} × e</tspan>
                                    <tspan fontSize="0.7em" dy="-4"><tspan fill="var(--foreground)">-{alpha}(</tspan><tspan fill="rgb(200, 80, 60)">{temp}</tspan><tspan fill="var(--foreground)">-{Topt})²</tspan></tspan>
                                    <tspan dy="4"></tspan>
                                </text>
                            </g>

                            {/* ── Temperature Response Curve ── */}
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
                                    const px = chartX + ((val - minT) / (maxT - minT)) * chartW;
                                    return (
                                        <g key={val}>
                                            <line x1={px} y1={chartBottom} x2={px} y2={chartBottom + 3} stroke="var(--muted-foreground)" strokeWidth="0.8" />
                                            <text x={px} y={chartBottom + 14} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)">
                                                {val}°
                                            </text>
                                        </g>
                                    );
                                })}

                                <text x={chartX - 20} y={chartY + chartH / 2} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)" transform={`rotate(-90, ${chartX - 20}, ${chartY + chartH / 2})`}>
                                    μ (/day)
                                </text>
                                <text x={chartX + chartW / 2} y={chartBottom + 28} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)">
                                    Temperature (°C)
                                </text>

                                {/* Optimal line */}
                                <line x1={chartX + ((Topt - minT) / (maxT - minT)) * chartW} y1={chartY} x2={chartX + ((Topt - minT) / (maxT - minT)) * chartW} y2={chartBottom} stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.5" />
                                <text x={chartX + ((Topt - minT) / (maxT - minT)) * chartW - 5} y={chartY + chartH / 2} textAnchor="middle" className="text-[10px] font-mono" fill="var(--muted-foreground)" transform={`rotate(-90, ${chartX + ((Topt - minT) / (maxT - minT)) * chartW - 5}, ${chartY + chartH / 2})`}>
                                    optimal
                                </text>

                                <path d={curvePath} fill="none" stroke={themeColor} strokeWidth="2.5" strokeLinejoin="round" />
                                <circle cx={thumbPx} cy={thumbPy} r={6} fill={themeColor} stroke="var(--background)" strokeWidth="2" />
                                <text x={thumbPx + 10} y={thumbPy - 8} textAnchor="start" className="text-xs font-mono" fill="var(--foreground)" fontWeight="600">
                                    μ = {currentMu.toFixed(2)}
                                </text>

                                <text x={chartX + chartW / 2} y={305} textAnchor="middle" className="text-sm font-mono" fill="var(--foreground)" fontWeight="500">
                                    Temperature Response Curve
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
                                        <path d={bFillPath} fill="rgba(200, 80, 60, 0.1)" stroke="none" />
                                        <text x={bChartX + bChartW * 0.38} y={bChartY + bChartH * 0.52} textAnchor="middle" className="text-[9px] font-mono" fill={themeColor} fontWeight="500" opacity="0.8">
                                            limitation effect
                                        </text>
                                    </>
                                )}
                                <path d={bOptimalPath} fill="none" stroke={themeColor} strokeWidth="1.5" strokeDasharray="4 3" strokeOpacity="0.35" />

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

export default TemperatureEffectsVisualizer;
