"use client";

import { useState } from 'react';
import { Slider } from '@/components/ui/slider';

const L = 0.1;   // path length in meters (10 cm flask)

const LightAttenuationVisualizer = () => {
    const [i0State, setI0State] = useState([500]);
    const [densityState, setDensityState] = useState([2]);
    const [kaState, setKaState] = useState([150]);

    const I0 = i0State[0];
    const X = densityState[0];
    const Ka = kaState[0];

    // Beer-Lambert: I(z) = I0 * exp(-Ka * X * z)
    const KaX = Ka * X;
    const zZero = (KaX > 0.001 && I0 > 1) ? Math.log(I0) / KaX : L;
    const zEff = Math.min(zZero, L); // effective integration limit (where I > 1)
    const KaXZeff = KaX * zEff;
    const Iavg = KaXZeff > 0.001 ? (I0 / KaXZeff) * (1 - Math.exp(-KaXZeff)) : I0;
    const KaXL = KaX * L;

    // Slider thumb positions (h-52 = 208px, thumb 20px → travel 188px)
    const i0Frac = 1 - I0 / 1000;
    const i0ThumbTop = 10 + i0Frac * 188;
    const xFrac = 1 - X / 10;
    const xThumbTop = 10 + xFrac * 188;

    const kaColor = 'rgb(160, 90, 200)';
    const lightColor = 'rgb(210, 150, 20)';
    const densityColor = 'rgb(40, 160, 100)';

    // Ka slider thumb position
    const kaFrac = 1 - (Ka - 100) / 400;
    const kaThumbTop = 10 + kaFrac * 188;

    // SVG layout
    const flaskX = 40;
    const flaskW = 100;
    const flaskTop = 60;
    const flaskBottom = 240;
    const flaskH = flaskBottom - flaskTop;

    const chartX = 260;
    const chartH = 216;
    const chartW = 350;
    const chartY = 260 - chartH;
    const chartBottom = 260;
    const chartRight = chartX + chartW;

    const eqX = chartRight + 50;

    // Generate attenuation curve for chart
    const genCurve = () => {
        const pts: string[] = [];
        for (let i = 0; i <= 100; i++) {
            const z = (i / 100) * L;
            const Iz = I0 * Math.exp(-Ka * X * z);
            const px = chartX + (z / L) * chartW;
            const py = chartBottom - (Iz / 1000) * chartH;
            pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
        }
        return `M${pts.join(' L')}`;
    };

    // Fill area under curve
    const genFillPath = () => {
        const pts: string[] = [];
        for (let i = 0; i <= 100; i++) {
            const z = (i / 100) * L;
            const Iz = I0 * Math.exp(-Ka * X * z);
            const px = chartX + (z / L) * chartW;
            const py = chartBottom - (Iz / 1000) * chartH;
            pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
        }
        return `M${chartX},${chartBottom} L${pts.join(' L')} L${chartRight},${chartBottom} Z`;
    };

    const IavgY = chartBottom - (Iavg / 1000) * chartH;

    // Flask gradient opacity based on density
    const flaskDensityOpacity = Math.min(0.85, 0.1 + X * 0.075);

    return (
        <div className="flex items-end gap-6 py-4 select-none">
            {/* Vertical sliders */}
            <div className="flex gap-4 shrink-0 border-2 border-dashed border-muted-foreground/30 rounded-lg px-4 py-4 relative mt-6">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background px-2 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                    ↕ drag to adjust
                </span>

                {/* I₀ slider */}
                <div className="flex flex-col items-center w-14">
                    <span className="text-sm font-mono font-bold mb-1" style={{ color: lightColor }}>I₀</span>
                    <span className="text-[10px] font-mono text-muted-foreground mb-1">μE/m²/s</span>
                    <div className="h-52 relative w-full flex justify-center">
                        <Slider orientation="vertical" min={0} max={1000} step={20} value={i0State} onValueChange={setI0State}
                            className="h-full [&_span:first-child]:!bg-border [&_span_span]:!bg-[rgb(210,150,20)] [&_span[role=slider]]:!border-[rgb(210,150,20)] [&_span[role=slider]]:!bg-background" />
                        <span className="absolute text-[10px] font-mono font-bold pointer-events-none leading-tight" style={{ left: 'calc(50% + 14px)', top: i0ThumbTop - 1, transform: 'translateY(-30%)', color: lightColor }}>
                            {I0}
                        </span>
                    </div>
                </div>

                {/* X (density) slider */}
                <div className="flex flex-col items-center w-14">
                    <span className="text-sm font-mono font-bold mb-1" style={{ color: densityColor }}>X</span>
                    <span className="text-[10px] font-mono text-muted-foreground mb-1">g/L</span>
                    <div className="h-52 relative w-full flex justify-center">
                        <Slider orientation="vertical" min={0} max={10} step={0.2} value={densityState} onValueChange={setDensityState}
                            className="h-full [&_span:first-child]:!bg-border [&_span_span]:!bg-[rgb(40,160,100)] [&_span[role=slider]]:!border-[rgb(40,160,100)] [&_span[role=slider]]:!bg-background" />
                        <span className="absolute text-[10px] font-mono font-bold pointer-events-none leading-tight" style={{ left: 'calc(50% + 14px)', top: xThumbTop - 1, transform: 'translateY(-30%)', color: densityColor }}>
                            {X.toFixed(1)}
                        </span>
                    </div>
                </div>

                {/* ε (absorption) slider */}
                <div className="flex flex-col items-center w-14">
                    <span className="text-sm font-mono font-bold mb-1" style={{ color: kaColor }}>ε</span>
                    <span className="text-[10px] font-mono text-muted-foreground mb-1">m²/kg</span>
                    <div className="h-52 relative w-full flex justify-center">
                        <Slider orientation="vertical" min={100} max={500} step={10} value={kaState} onValueChange={setKaState}
                            className="h-full [&_span:first-child]:!bg-border [&_span_span]:!bg-[rgb(160,90,200)] [&_span[role=slider]]:!border-[rgb(160,90,200)] [&_span[role=slider]]:!bg-background" />
                        <span className="absolute text-[10px] font-mono font-bold pointer-events-none leading-tight" style={{ left: 'calc(50% + 14px)', top: kaThumbTop - 1, transform: 'translateY(-30%)', color: kaColor }}>
                            {Ka}
                        </span>
                    </div>
                </div>
            </div>

            {/* SVG Scene */}
            <svg viewBox="0 0 1045 320" className="w-full min-w-[900px]" aria-label="Light attenuation visualization">
                <defs>
                    {/* Light attenuation gradient — fades left→right */}
                    <linearGradient id="flask-light-atten" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={`rgba(240, 190, 50, ${0.1 + (I0 / 1000) * 0.6})`} />
                        <stop offset="100%" stopColor={`rgba(240, 190, 50, ${Math.max(0.02, (I0 / 1000) * 0.6 * Math.exp(-KaXL))})`} />
                    </linearGradient>
                    <clipPath id="beaker-clip-atten">
                        <path d="M61 41 L51 200 Q51 214 65 214 L135 214 Q149 214 149 200 L139 41 Z" />
                    </clipPath>
                    {/* Chart fill gradient */}
                    <linearGradient id="chart-fill-atten" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lightColor} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={lightColor} stopOpacity="0.05" />
                    </linearGradient>
                    <marker id="arrowhead-atten" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                        <path d="M0,0 L6,2 L0,4" fill="var(--muted-foreground)" />
                    </marker>
                </defs>

                {/* ── Culture Beaker ── */}
                <g transform="translate(0, 50)">
                    {/* Light panel on left */}
                    <rect x="30" y="44" width="18" height="171" fill={`rgba(230, 170, 40, ${0.15 + (I0 / 1000) * 0.85})`} />
                    <path d="M48,43 L33,43 Q30,43 30,46 L30,212 Q30,215 33,215 L48,215" fill="none" stroke="var(--foreground)" strokeWidth="2" strokeLinejoin="round" />
                    <text x="22" y="130" textAnchor="middle" className="text-[10px] font-mono" fill="var(--muted-foreground)" transform="rotate(-90, 22, 130)">Light</text>

                    {/* Light rays emanating rightward into culture */}
                    {[55, 75, 95, 115, 135, 155, 175, 195].map((ry) => {
                        const rayEnd = 48 + (90) * Math.exp(-Ka * X * L * ((ry - 55) / 140));
                        return (
                            <line key={ry} x1="48" y1={ry} x2={rayEnd} y2={ry}
                                stroke={`rgba(230, 170, 40, ${(I0 / 1000) * 0.3})`}
                                strokeWidth="1.2" />
                        );
                    })}

                    {/* Culture fill */}
                    <g clipPath="url(#beaker-clip-atten)">
                        <path
                            d="M40 75 Q70 69 100 75 Q130 81 160 75 L160 220 L40 220 Z"
                            fill={`rgba(40, 140, 80, ${flaskDensityOpacity})`}
                        >
                            <animate attributeName="d" dur="2.5s" repeatCount="indefinite"
                                values="M40 75 Q70 69 100 75 Q130 81 160 75 L160 220 L40 220 Z;M40 80 Q70 84 100 79 Q130 73 160 79 L160 220 L40 220 Z;M40 75 Q70 69 100 75 Q130 81 160 75 L160 220 L40 220 Z" />
                        </path>
                        {/* Light overlay: yellow/orange gradient fading left→right */}
                        <rect x="40" y="40" width="120" height="180" fill="url(#flask-light-atten)" />
                    </g>

                    {/* Beaker outline */}
                    <path d="M60 40 L50 200 Q50 215 65 215 L135 215 Q150 215 150 200 L140 40" fill="none" stroke="var(--border)" strokeWidth="2.5" strokeLinejoin="round" />
                    <path d="M55 40 L60 40 M140 40 L145 40" fill="none" stroke="var(--border)" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M55 40 Q55 36 58 36" fill="none" stroke="var(--border)" strokeWidth="2" />
                    <path d="M145 40 Q145 36 142 36" fill="none" stroke="var(--border)" strokeWidth="2" />
                    {/* Graduation marks */}
                    <line x1="52" y1="100" x2="58" y2="100" stroke="var(--border)" strokeWidth="1" />
                    <line x1="51" y1="140" x2="57" y2="140" stroke="var(--border)" strokeWidth="1" />
                    <line x1="51" y1="180" x2="56" y2="180" stroke="var(--border)" strokeWidth="1" />

                    {/* Depth arrow */}
                    <line x1="55" y1="228" x2="145" y2="228" stroke="var(--muted-foreground)" strokeWidth="1" markerEnd="url(#arrowhead-atten)" />
                    <text x="100" y="242" textAnchor="middle" className="text-[10px] font-mono" fill="var(--muted-foreground)">depth z</text>
                    <text x="100" y="258" textAnchor="middle" className="text-sm font-mono" fill="var(--foreground)" fontWeight="500">Culture</text>
                </g>

                {/* ── Attenuation Chart ── */}
                <g>
                    {/* Title — bottom-aligned with "Culture" */}
                    <text x={chartX + chartW / 2} y={308} textAnchor="middle" className="text-sm font-mono" fill="var(--foreground)" fontWeight="500">
                        Light vs Depth
                    </text>

                    {/* Axes */}
                    <line x1={chartX} y1={chartY} x2={chartX} y2={chartBottom} stroke="var(--border)" strokeWidth="1" />
                    <line x1={chartX} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="var(--border)" strokeWidth="1" />

                    {/* Y-axis ticks */}
                    {[0, 200, 400, 600, 800, 1000].map((val) => {
                        const py = chartBottom - (val / 1000) * chartH;
                        return (
                            <g key={val}>
                                <line x1={chartX - 3} y1={py} x2={chartRight} y2={py} stroke="var(--border)" strokeWidth="0.5" strokeOpacity="0.3" />
                                <text x={chartX - 6} y={py + 3.5} textAnchor="end" className="text-xs font-mono" fill="var(--muted-foreground)">{val}</text>
                            </g>
                        );
                    })}

                    {/* X-axis ticks */}
                    {[0, 20, 40, 60, 80, 100].map((zmm) => {
                        const px = chartX + (zmm / 100) * chartW;
                        return (
                            <g key={zmm}>
                                <line x1={px} y1={chartBottom} x2={px} y2={chartBottom + 3} stroke="var(--muted-foreground)" strokeWidth="0.8" />
                                <text x={px} y={chartBottom + 14} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)">{zmm}</text>
                            </g>
                        );
                    })}

                    {/* Axis labels */}
                    <text x={chartX - 35} y={chartY + chartH / 2} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)" transform={`rotate(-90, ${chartX - 35}, ${chartY + chartH / 2})`}>
                        I (μE/m²/s)
                    </text>
                    <text x={chartX + chartW / 2} y={chartBottom + 28} textAnchor="middle" className="text-xs font-mono" fill="var(--muted-foreground)">
                        Depth z (mm)
                    </text>

                    {/* Fill under curve */}
                    <path d={genFillPath()} fill="url(#chart-fill-atten)" />

                    {/* Attenuation curve */}
                    <path d={genCurve()} fill="none" stroke={lightColor} strokeWidth="2.5" strokeLinejoin="round" />

                    {/* I₀ marker at z=0 */}
                    <circle cx={chartX} cy={chartBottom - (I0 / 1000) * chartH} r={4} fill={lightColor} stroke="var(--background)" strokeWidth="1.5" />
                    <text x={chartX + 8} y={chartBottom - (I0 / 1000) * chartH + 4} className="text-[10px] font-mono font-bold" fill={lightColor}>
                        I₀ = {I0}
                    </text>

                    {/* Iavg horizontal dashed line + thumb on curve */}
                    {(() => {
                        // Find z where I(z) = Iavg
                        const zAvg = (Iavg > 0 && I0 > 0 && KaX > 0.001) ? -Math.log(Iavg / I0) / KaX : L / 2;
                        const clampedZ = Math.max(0, Math.min(L, zAvg));
                        const thumbPx = chartX + (clampedZ / L) * chartW;
                        const thumbPy = chartBottom - (Iavg / 1000) * chartH;
                        const zZeroPx = chartX + (zEff / L) * chartW;
                        return (
                            <g>
                                {/* Horizontal dashed line from y-axis to ~0 line */}
                                <line x1={chartX} y1={thumbPy} x2={zZeroPx} y2={thumbPy}
                                    stroke="rgb(220, 180, 50)" strokeWidth="1.5" strokeDasharray="6 3" />
                                <circle cx={thumbPx} cy={thumbPy} r={5} fill="rgb(220, 180, 50)" stroke="var(--background)" strokeWidth="1.5" />
                                <text x={thumbPx + 9} y={thumbPy - 8} className="text-[10px] font-mono font-bold" fill="rgb(220, 180, 50)">
                                    Iavg = {Iavg.toFixed(0)}
                                </text>
                            </g>
                        );
                    })()}

                    {/* Vertical dashed line where I(z) ≈ 0 (drops below 1) */}
                    {(() => {
                        if (KaX <= 0.001 || I0 <= 1 || zZero >= L) return null;
                        const px = chartX + (zZero / L) * chartW;
                        return (
                            <g>
                                {/* Shaded "dark zone" region */}
                                <rect x={px} y={chartY} width={chartRight - px} height={chartH} fill="var(--muted-foreground)" fillOpacity="0.08" />
                                <line x1={px} y1={chartY} x2={px} y2={chartBottom} stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="4 3" />

                                {/* Label inside dark zone */}
                                <text x={px + (chartRight - px) / 2} y={chartY + chartH / 2 - 6} textAnchor="middle" className="text-[10px] font-mono" fill="var(--muted-foreground)" opacity="0.7">
                                    not enough
                                </text>
                                <text x={px + (chartRight - px) / 2} y={chartY + chartH / 2 + 8} textAnchor="middle" className="text-[10px] font-mono" fill="var(--muted-foreground)" opacity="0.7">
                                    light to grow
                                </text>
                            </g>
                        );
                    })()}
                </g>

                {/* ── Equations ── */}
                <g transform="translate(0, 26)">
                    {/* Title */}
                    <text x={eqX} y={chartY - 4} className="text-xs font-mono" fill="var(--foreground)" fontWeight="600">
                        Beer-Lambert Law
                    </text>

                    {/* Integral form */}
                    <text x={eqX} y={chartY + 24} className="text-sm font-mono" fontWeight="500">
                        <tspan fill={lightColor}>I</tspan>
                        <tspan fill="var(--foreground)">(z) = </tspan>
                        <tspan fill={lightColor}>I₀</tspan>
                        <tspan fill="var(--foreground)"> · e</tspan>
                        <tspan fontSize="0.8em" dy="-4"><tspan fill="var(--foreground)">−</tspan><tspan fill={kaColor}>ε</tspan><tspan fill="var(--foreground)">·</tspan><tspan fill={densityColor}>X</tspan><tspan fill="var(--foreground)">·z</tspan></tspan>
                        <tspan dy="4"> </tspan>
                    </text>

                    {/* Iavg symbolic form */}
                    <text x={eqX} y={chartY + 54} className="text-sm font-mono" fontWeight="500">
                        <tspan fill={lightColor}>I</tspan>
                        <tspan fill="var(--foreground)" fontSize="0.7em" dy="3">avg</tspan>
                        <tspan dy="-3" fill="var(--foreground)"> = </tspan>
                        <tspan fill={lightColor}>I₀</tspan>
                        <tspan fill="var(--foreground)"> / (</tspan>
                        <tspan fill={kaColor}>ε</tspan>
                        <tspan fill="var(--foreground)">·</tspan>
                        <tspan fill={densityColor}>X</tspan>
                        <tspan fill="var(--foreground)">·L) · (1 − e</tspan>
                        <tspan fontSize="0.8em" dy="-4"><tspan fill="var(--foreground)">−</tspan><tspan fill={kaColor}>ε</tspan><tspan fill="var(--foreground)">·</tspan><tspan fill={densityColor}>X</tspan><tspan fill="var(--foreground)">·L</tspan></tspan>
                        <tspan dy="4" fill="var(--foreground)">)</tspan>
                    </text>

                    {/* Divider */}
                    <line x1={eqX} y1={chartY + 68} x2={eqX + 280} y2={chartY + 68} stroke="var(--border)" strokeWidth="0.5" />

                    {/* Dynamic numeric equation */}
                    <text x={eqX} y={chartY + 92} className="text-sm font-mono" fontWeight="500" opacity="0.5">
                        <tspan fill="rgb(220, 180, 50)">I</tspan>
                        <tspan fill="rgb(220, 180, 50)" fontSize="0.7em" dy="3">avg</tspan>
                        <tspan fill="rgb(220, 180, 50)" dy="-3"> = {Iavg.toFixed(1)} μE/m²/s</tspan>
                    </text>
                    <text x={eqX + 35} y={chartY + 112} className="text-sm font-mono" fontWeight="500" opacity="0.5">
                        <tspan fill="var(--foreground)">= </tspan>
                        <tspan fill={lightColor}>{I0}</tspan>
                        <tspan fill="var(--foreground)"> / (</tspan>
                        <tspan fill={kaColor}>{Ka}</tspan>
                        <tspan fill="var(--foreground)">×</tspan>
                        <tspan fill={densityColor}>{X.toFixed(1)}</tspan>
                        <tspan fill="var(--foreground)">×{L}) · (1 − e</tspan>
                        <tspan fill="var(--foreground)" fontSize="0.8em" dy="-3">−</tspan>
                        <tspan fill={kaColor} fontSize="0.8em">{Ka}</tspan>
                        <tspan fill="var(--foreground)" fontSize="0.8em">×</tspan>
                        <tspan fill={densityColor} fontSize="0.8em">{X.toFixed(1)}</tspan>
                        <tspan fill="var(--foreground)" fontSize="0.8em">×{L}</tspan>
                        <tspan dy="3" fill="var(--foreground)">)</tspan>
                    </text>

                    {/* Growing / Not Growing percentages */}
                    {(() => {
                        const growingPct = Math.min(100, (zEff / L) * 100);
                        const notGrowingPct = 100 - growingPct;
                        return (
                            <g transform={`translate(${eqX}, ${chartY + 142})`}>
                                <text y={0} className="text-xs font-mono" fontWeight="600" fill="hsl(var(--accent-science))">
                                    Growing: {growingPct.toFixed(0)}%
                                </text>
                                <text y={18} className="text-xs font-mono" fontWeight="600" fill="var(--muted-foreground)">
                                    Not Growing: {notGrowingPct.toFixed(0)}%
                                </text>
                            </g>
                        );
                    })()}
                </g>
            </svg>
        </div>
    );
};

export default LightAttenuationVisualizer;
