"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { getGlobalStart } from '@/lib/simulation/shared-timer';

const LOOP_DURATION = 6000;
const PAUSE_START = 1000;
const PAUSE_END = 1000;
const TOTAL_CYCLE = PAUSE_START + LOOP_DURATION + PAUSE_END;

const Iopt = 300;
const Topt = 30;
const alphaT = 0.01;
const Ks = 1;
const Sopt = 10;
const muMax = 4.0;

function lightFactor(I: number): number {
    const ratio = I / Iopt;
    return ratio > 0 ? ratio * Math.exp(1 - ratio) : 0;
}

function tempFactor(T: number): number {
    return Math.exp(-alphaT * Math.pow(T - Topt, 2));
}

function nutrientFactor(S: number): number {
    const sf = (Ks + Sopt) / Sopt;
    return Math.min(1, sf * S / (Ks + S));
}

const CombinedEffectsVisualizer = () => {
    const [intensity, setIntensity] = useState([300]);
    const [temperature, setTemperature] = useState([30]);
    const [nutrient, setNutrient] = useState([10]);
    const [dayProgress, setDayProgress] = useState(0);
    const [timeLabel, setTimeLabel] = useState('0:00');
    const [animPhase, setAnimPhase] = useState<'pause-start' | 'running' | 'pause-end'>('pause-start');
    const animRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);

    const I = intensity[0];
    const T = temperature[0];
    const S = nutrient[0];

    const fI = lightFactor(I);
    const fT = tempFactor(T);
    const fS = nutrientFactor(S);
    const muEff = muMax * fI * fT * fS;

    const animate = useCallback(
        (timestamp: number) => {
            if (!startTimeRef.current) startTimeRef.current = getGlobalStart(timestamp);
            const elapsed = (timestamp - startTimeRef.current) % TOTAL_CYCLE;

            if (elapsed < PAUSE_START) {
                setAnimPhase('pause-start');
                setTimeLabel('0:00');
                setDayProgress(0);
            } else if (elapsed < PAUSE_START + LOOP_DURATION) {
                setAnimPhase('running');
                const progress = (elapsed - PAUSE_START) / LOOP_DURATION;
                setDayProgress(progress);
                const hours = Math.floor(progress * 24);
                const mins = Math.floor((progress * 24 - hours) * 60);
                setTimeLabel(`${hours}:${mins.toString().padStart(2, '0')}`);
            } else {
                setAnimPhase('pause-end');
                setTimeLabel('24:00');
                setDayProgress(1);
            }

            animRef.current = requestAnimationFrame(animate);
        },
        []
    );

    useEffect(() => {
        startTimeRef.current = 0;
        animRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animRef.current);
    }, [animate]);

    const startMass = 1;
    const maxMass = 16;
    const currentMass = startMass * Math.pow(2, muEff * dayProgress);
    const endMass = startMass * Math.pow(2, muEff);

    const lightColor = 'rgb(210, 150, 20)';
    const tempColor = 'rgb(200, 80, 60)';
    const nutrientColor = 'rgb(140, 80, 200)';

    // Slider thumb positions (h-52 = 208px, thumb 20px → travel 188px)
    const lightFrac = 1 - I / 1000;
    const lightThumbTop = 10 + lightFrac * 188;
    const tempFrac = 1 - (T - 10) / 40;
    const tempThumbTop = 10 + tempFrac * 188;
    const nutFrac = 1 - S / 20;
    const nutThumbTop = 10 + nutFrac * 188;

    // SVG layout — biomass chart first (determines bottom alignment)
    const bChartX = 765;
    const bChartY = 57;
    const bChartW = 260;
    const bChartH = 200;
    const bChartRight = bChartX + bChartW;
    const bChartBottom = bChartY + bChartH;

    // 3 response curves side by side, bottom-aligned with biomass chart
    const rcW = 190;
    const rcH = 140;
    const rcY = bChartBottom - rcH; // bottom-aligned with biomass chart
    const rc1X = 50;
    const rcGap = 30;
    const rc2X = rc1X + rcW + rcGap;
    const rc3X = rc2X + rcW + rcGap;

    // Clock — right-justified with nutrient response chart
    const clockR = 7;
    const clockY = 24;
    const clockRightEdge = rc3X + rcW; // right edge of nutrient chart
    const handAngle = dayProgress * Math.PI * 2 - Math.PI / 2;

    // Current positions on response curves
    const lightCurX = rc1X + (I / 1000) * rcW;
    const lightCurY = rcY + rcH - fI * rcH;
    const tempCurX = rc2X + ((T - 10) / 40) * rcW;
    const tempCurY = rcY + rcH - fT * rcH;
    const nutCurX = rc3X + (S / 20) * rcW;
    const nutCurY = rcY + rcH - fS * rcH;

    // Curve generators
    const genLightCurve = () => {
        const pts: string[] = [];
        for (let i = 0; i <= 80; i++) {
            const v = (i / 80) * 1000;
            const f = lightFactor(v);
            pts.push(`${(rc1X + (v / 1000) * rcW).toFixed(1)},${(rcY + rcH - f * rcH).toFixed(1)}`);
        }
        return `M${pts.join(' L')}`;
    };
    const genTempCurve = () => {
        const pts: string[] = [];
        for (let i = 0; i <= 80; i++) {
            const v = 10 + (i / 80) * 40;
            const f = tempFactor(v);
            pts.push(`${(rc2X + ((v - 10) / 40) * rcW).toFixed(1)},${(rcY + rcH - f * rcH).toFixed(1)}`);
        }
        return `M${pts.join(' L')}`;
    };
    const genNutrientCurve = () => {
        const pts: string[] = [];
        for (let i = 0; i <= 80; i++) {
            const v = (i / 80) * 20;
            const f = nutrientFactor(v);
            pts.push(`${(rc3X + (v / 20) * rcW).toFixed(1)},${(rcY + rcH - f * rcH).toFixed(1)}`);
        }
        return `M${pts.join(' L')}`;
    };

    // Biomass curves for stacked limitation bands
    const genBiomassCurve = (mu: number) => {
        const pts: string[] = [];
        for (let i = 0; i <= 60; i++) {
            const t = i / 60;
            const mass = Math.min(maxMass, startMass * Math.pow(2, mu * t));
            const px = bChartX + t * bChartW;
            const py = bChartBottom - ((mass - startMass) / (maxMass - startMass)) * bChartH;
            pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
        }
        return pts;
    };

    const bOptimalPts = genBiomassCurve(muMax);                    // optimal (all factors = 1)
    const bAfterLightPts = genBiomassCurve(muMax * fI);            // after light limitation
    const bAfterTempPts = genBiomassCurve(muMax * fI * fT);        // after light + temp limitation
    const bCurvePoints = genBiomassCurve(muEff);                   // after all limitations

    const bOptimalPath = `M${bOptimalPts.join(' L')}`;
    const bAfterLightPath = `M${bAfterLightPts.join(' L')}`;
    const bAfterTempPath = `M${bAfterTempPts.join(' L')}`;
    const bCurvePath = `M${bCurvePoints.join(' L')}`;

    // Fill paths between consecutive limitation levels
    const makeFill = (upperPts: string[], lowerPts: string[]) =>
        `M${upperPts.join(' L')} L${[...lowerPts].reverse().join(' L')} Z`;

    const lightFillPath = makeFill(bOptimalPts, bAfterLightPts);
    const tempFillPath = makeFill(bAfterLightPts, bAfterTempPts);
    const nutrientFillPath = makeFill(bAfterTempPts, bCurvePoints);

    const bCurrentPx = bChartX + dayProgress * bChartW;
    const bCurrentPy = bChartBottom - ((currentMass - startMass) / (maxMass - startMass)) * bChartH;

    const renderMiniChart = (
        cx: number, cy: number, w: number, h: number,
        curvePath: string, dotX: number, dotY: number,
        color: string, title: string, xLabel: string,
        factorVal: number, factorName: string,
    ) => {
        const bottom = cy + h;
        const right = cx + w;
        return (
            <g>
                {/* Axes */}
                <line x1={cx} y1={cy} x2={cx} y2={bottom} stroke="hsl(var(--border))" strokeWidth="1" />
                <line x1={cx} y1={bottom} x2={right} y2={bottom} stroke="hsl(var(--border))" strokeWidth="1" />
                {/* Grid */}
                {[0.2, 0.4, 0.6, 0.8, 1.0].map((f) => (
                    <g key={f}>
                        <line x1={cx} y1={bottom - f * h} x2={right} y2={bottom - f * h} stroke="hsl(var(--border))" strokeWidth="0.5" strokeOpacity="0.3" />
                        <text x={cx - 4} y={bottom - f * h + 3} textAnchor="end" className="text-[7px] font-mono" fill="hsl(var(--muted-foreground))">{f}</text>
                    </g>
                ))}
                {/* Curve */}
                <path d={curvePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
                {/* Dot */}
                <circle cx={dotX} cy={dotY} r={4} fill={color} stroke="hsl(var(--background))" strokeWidth="1.5" />
                {/* Labels */}
                <text x={cx + w / 2} y={bottom + 14} textAnchor="middle" className="text-xs font-mono" fill="hsl(var(--muted-foreground))">{xLabel}</text>
                <text x={cx + w / 2} y={cy - 8} textAnchor="middle" className="text-[11px] font-mono" fill={color} fontWeight="600">
                    {factorName} = {factorVal.toFixed(3)}
                </text>
                <text x={cx + w / 2} y={cy - 21} textAnchor="middle" className="text-xs font-mono" fill="hsl(var(--foreground))" fontWeight="500">{title}</text>
            </g>
        );
    };

    return (
        <div className="flex items-end gap-6 py-4 select-none">
            {/* Vertical sliders — all in one box */}
            <div className="flex gap-4 shrink-0 border-2 border-dashed border-muted-foreground/30 rounded-lg px-4 py-4 relative mt-6">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background px-2 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                    ↕ drag to adjust
                </span>

                {/* Light slider */}
                {(() => {
                    const optTop = 10 + (1 - Iopt / 1000) * 188;
                    return (
                        <div className="flex flex-col items-center w-14">
                            <span className="text-sm font-mono font-bold mb-1" style={{ color: lightColor }}>I</span>
                            <span className="text-[10px] font-mono text-muted-foreground mb-1">μE/m²/s</span>
                            <div className="h-52 relative w-full flex justify-center">
                                {/* Optimal arrow on left */}
                                <span className="absolute text-[11px] pointer-events-none text-muted-foreground" style={{ right: 'calc(50% + 12px)', top: optTop, transform: 'translateY(-50%)' }}>→</span>
                                <Slider orientation="vertical" min={0} max={1000} step={20} value={intensity} onValueChange={setIntensity}
                                    className="h-full [&_span:first-child]:!bg-border [&_span_span]:!bg-[rgb(210,150,20)] [&_span[role=slider]]:!border-[rgb(210,150,20)] [&_span[role=slider]]:!bg-background" />
                                {/* Value on right */}
                                <span className="absolute text-[10px] font-mono font-bold pointer-events-none leading-tight" style={{ left: 'calc(50% + 14px)', top: lightThumbTop - 1, transform: 'translateY(-30%)', color: lightColor }}>
                                    {I}
                                </span>
                            </div>
                        </div>
                    );
                })()}

                {/* Temperature slider */}
                {(() => {
                    const optTop = 10 + (1 - (Topt - 10) / 40) * 188;
                    return (
                        <div className="flex flex-col items-center w-14">
                            <span className="text-sm font-mono font-bold mb-1" style={{ color: tempColor }}>T</span>
                            <span className="text-[10px] font-mono text-muted-foreground mb-1">°C</span>
                            <div className="h-52 relative w-full flex justify-center">
                                <span className="absolute text-[11px] pointer-events-none text-muted-foreground" style={{ right: 'calc(50% + 12px)', top: optTop, transform: 'translateY(-50%)' }}>→</span>
                                <Slider orientation="vertical" min={10} max={50} step={1} value={temperature} onValueChange={setTemperature}
                                    className="h-full [&_span:first-child]:!bg-border [&_span_span]:!bg-[rgb(200,80,60)] [&_span[role=slider]]:!border-[rgb(200,80,60)] [&_span[role=slider]]:!bg-background" />
                                <span className="absolute text-[10px] font-mono font-bold pointer-events-none leading-tight" style={{ left: 'calc(50% + 14px)', top: tempThumbTop - 1, transform: 'translateY(-30%)', color: tempColor }}>
                                    {T}°
                                </span>
                            </div>
                        </div>
                    );
                })()}

                {/* Nutrient slider */}
                {(() => {
                    const optTop = 10 + (1 - Sopt / 20) * 188;
                    return (
                        <div className="flex flex-col items-center w-14">
                            <span className="text-sm font-mono font-bold mb-1" style={{ color: nutrientColor }}>S</span>
                            <span className="text-[10px] font-mono text-muted-foreground mb-1">mM</span>
                            <div className="h-52 relative w-full flex justify-center">
                                <span className="absolute text-[11px] pointer-events-none text-muted-foreground" style={{ right: 'calc(50% + 12px)', top: optTop, transform: 'translateY(-50%)' }}>→</span>
                                <Slider orientation="vertical" min={0} max={20} step={0.5} value={nutrient} onValueChange={setNutrient}
                                    className="h-full [&_span:first-child]:!bg-border [&_span_span]:!bg-[rgb(140,80,200)] [&_span[role=slider]]:!border-[rgb(140,80,200)] [&_span[role=slider]]:!bg-background" />
                                <span className="absolute text-[10px] font-mono font-bold pointer-events-none leading-tight" style={{ left: 'calc(50% + 14px)', top: nutThumbTop - 1, transform: 'translateY(-30%)', color: nutrientColor }}>
                                    {S.toFixed(1)}
                                </span>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* SVG Scene */}
            <svg viewBox="0 0 1045 320" className="w-full min-w-[900px]" aria-label="Combined effects visualization">
                {/* Equation — left-justified with light response chart */}
                <text x={rc1X} y={20} textAnchor="start" className="text-base font-mono" fontWeight="600" letterSpacing="-1">
                    <tspan fill="hsl(var(--accent-science))">μ</tspan>
                    <tspan fill="hsl(var(--foreground))"> = μ₀ × </tspan>
                    <tspan fill={lightColor}>f(I)</tspan>
                    <tspan fill="hsl(var(--foreground))"> × </tspan>
                    <tspan fill={tempColor}>f(T)</tspan>
                    <tspan fill="hsl(var(--foreground))"> × </tspan>
                    <tspan fill={nutrientColor}>f(S)</tspan>
                </text>
                <text x={rc1X} y={40} textAnchor="start" className="text-sm font-mono" fontWeight="500" letterSpacing="-1" opacity="0.5">
                    <tspan fill="hsl(var(--accent-science))">{muEff.toFixed(2)} /day</tspan>
                    <tspan fill="hsl(var(--foreground))"> = {muMax} × </tspan>
                    <tspan fill={lightColor}>{fI.toFixed(3)}</tspan>
                    <tspan fill="hsl(var(--foreground))"> × </tspan>
                    <tspan fill={tempColor}>{fT.toFixed(3)}</tspan>
                    <tspan fill="hsl(var(--foreground))"> × </tspan>
                    <tspan fill={nutrientColor}>{fS.toFixed(3)}</tspan>
                </text>

                {/* Expanded single-line equation */}
                <text x={rc1X} y={58} textAnchor="start" className="text-sm font-mono" fontWeight="500" letterSpacing="-1" opacity="0.5">
                    <tspan fill="hsl(var(--accent-science))">{muEff.toFixed(2)}</tspan>
                    <tspan fill="hsl(var(--foreground))"> = {muMax} × (</tspan>
                    <tspan fill={lightColor}>{I}</tspan>
                    <tspan fill="hsl(var(--foreground))">/{Iopt})·e</tspan>
                    <tspan fontSize="0.8em" dy="-3"><tspan fill="hsl(var(--foreground))">1-(</tspan><tspan fill={lightColor}>{I}</tspan><tspan fill="hsl(var(--foreground))">/{Iopt})</tspan></tspan>
                    <tspan dy="3" fill="hsl(var(--foreground))"> × e</tspan>
                    <tspan fontSize="0.8em" dy="-3"><tspan fill="hsl(var(--foreground))">-0.01(</tspan><tspan fill={tempColor}>{T}</tspan><tspan fill="hsl(var(--foreground))">-{Topt})²</tspan></tspan>
                    <tspan dy="3" fill="hsl(var(--foreground))"> × ({Ks}+{Sopt})/{Sopt}·</tspan>
                    <tspan fill={nutrientColor}>{S.toFixed(1)}</tspan>
                    <tspan fill="hsl(var(--foreground))">/({Ks}+</tspan>
                    <tspan fill={nutrientColor}>{S.toFixed(1)}</tspan>
                    <tspan fill="hsl(var(--foreground))">)</tspan>
                </text>

                <g>
                    <circle cx={clockRightEdge - 118} cy={clockY} r={clockR} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.2" />
                    <circle cx={clockRightEdge - 118} cy={clockY} r={0.8} fill="hsl(var(--muted-foreground))" />
                    <line x1={clockRightEdge - 118} y1={clockY} x2={clockRightEdge - 118 + Math.cos(handAngle) * (clockR * 0.6)} y2={clockY + Math.sin(handAngle) * (clockR * 0.6)} stroke="hsl(var(--muted-foreground))" strokeWidth="1.2" strokeLinecap="round" />
                    <line x1={clockRightEdge - 118} y1={clockY} x2={clockRightEdge - 118 + Math.cos(handAngle * 12) * (clockR * 0.8)} y2={clockY + Math.sin(handAngle * 12) * (clockR * 0.8)} stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" strokeLinecap="round" />
                    <text x={clockRightEdge - 104} y={clockY + 4} textAnchor="start" className="text-sm font-mono" fill="hsl(var(--foreground))">
                        t = {timeLabel} h
                    </text>
                    <rect x={clockRightEdge - 100} y={clockY + 12} width={100} height={3} rx={1.5} fill="hsl(var(--border))" />
                    <rect x={clockRightEdge - 100} y={clockY + 12} width={animPhase === 'pause-start' ? 0 : animPhase === 'pause-end' ? 100 : 100 * dayProgress} height={3} rx={1.5} fill="hsl(var(--accent-science))" />
                </g>

                {/* Three response curves */}
                {renderMiniChart(rc1X, rcY, rcW, rcH, genLightCurve(), lightCurX, lightCurY, lightColor, 'Light Response', 'I (μE/m²/s)', fI, 'f(I)')}

                {renderMiniChart(rc2X, rcY, rcW, rcH, genTempCurve(), tempCurX, tempCurY, tempColor, 'Temp Response', 'T (°C)', fT, 'f(T)')}

                {renderMiniChart(rc3X, rcY, rcW, rcH, genNutrientCurve(), nutCurX, nutCurY, nutrientColor, 'Nutrient Response', 'S (mM)', fS, 'f(S)')}

                {/* Labels under response curves */}
                <text x={(rc3X + rcW + rc1X) / 2} y={305} textAnchor="middle" className="text-sm font-mono" fill="hsl(var(--foreground))" fontWeight="500">
                    Response Curves (factor 0–1)
                </text>

                {/* ── Biomass Growth Chart (same size as other visualizers) ── */}
                <g>
                    <line x1={bChartX} y1={bChartY} x2={bChartX} y2={bChartBottom} stroke="hsl(var(--border))" strokeWidth="1" />
                    <line x1={bChartX} y1={bChartBottom} x2={bChartRight} y2={bChartBottom} stroke="hsl(var(--border))" strokeWidth="1" />

                    {[1, 4, 8, 12, 16].map((val) => {
                        const py = bChartBottom - ((val - startMass) / (maxMass - startMass)) * bChartH;
                        return (
                            <g key={val}>
                                <line x1={bChartX - 3} y1={py} x2={bChartX} y2={py} stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" />
                                <line x1={bChartX} y1={py} x2={bChartRight} y2={py} stroke="hsl(var(--border))" strokeWidth="0.5" strokeOpacity="0.3" />
                                <text x={bChartX - 6} y={py + 3.5} textAnchor="end" className="text-xs font-mono" fill="hsl(var(--muted-foreground))">{val}</text>
                            </g>
                        );
                    })}

                    {[0, 6, 12, 18, 24].map((hr) => {
                        const px = bChartX + (hr / 24) * bChartW;
                        return (
                            <g key={hr}>
                                <line x1={px} y1={bChartBottom} x2={px} y2={bChartBottom + 3} stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" />
                                <text x={px} y={bChartBottom + 14} textAnchor="middle" className="text-xs font-mono" fill="hsl(var(--muted-foreground))">{hr}h</text>
                            </g>
                        );
                    })}

                    <text x={bChartX - 24} y={bChartY + bChartH / 2} textAnchor="middle" className="text-xs font-mono" fill="hsl(var(--muted-foreground))" transform={`rotate(-90, ${bChartX - 24}, ${bChartY + bChartH / 2})`}>
                        Biomass (kg)
                    </text>

                    {/* Stacked limitation bands */}
                    {fI < 1 && <path d={lightFillPath} fill="rgba(210, 150, 20, 0.25)" stroke="none" />}
                    {fT < 1 && <path d={tempFillPath} fill="rgba(200, 80, 60, 0.25)" stroke="none" />}
                    {fS < 1 && <path d={nutrientFillPath} fill="rgba(140, 80, 200, 0.25)" stroke="none" />}

                    {/* Optimal dashed line */}
                    <path d={bOptimalPath} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.3" />

                    {/* Border dashed lines between bands */}
                    {fI < 0.98 && (fT < 0.98 || fS < 0.98) && (
                        <path d={bAfterLightPath} fill="none" stroke={lightColor} strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.5" />
                    )}
                    {fT < 0.98 && fS < 0.98 && (
                        <path d={bAfterTempPath} fill="none" stroke={tempColor} strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.5" />
                    )}

                    {/* Limitation labels */}
                    {fI < 0.98 && (
                        <text x={bChartX + 20} y={bChartY + bChartH * 0.18} textAnchor="start" className="text-[10px] font-mono" fill={lightColor} fontWeight="600">
                            light limitation
                        </text>
                    )}
                    {fT < 0.98 && (
                        <text x={bChartX + 20} y={bChartY + bChartH * 0.33} textAnchor="start" className="text-[10px] font-mono" fill={tempColor} fontWeight="600">
                            temp limitation
                        </text>
                    )}
                    {fS < 0.98 && (
                        <text x={bChartX + 20} y={bChartY + bChartH * 0.48} textAnchor="start" className="text-[10px] font-mono" fill={nutrientColor} fontWeight="600">
                            nutrient limitation
                        </text>
                    )}

                    <path d={bCurvePath} fill="none" stroke="hsl(var(--accent-science))" strokeWidth="2" strokeLinejoin="round" />
                    <circle cx={bCurrentPx} cy={bCurrentPy} r={4} fill="hsl(var(--accent-science))" stroke="hsl(var(--background))" strokeWidth="1.5" />

                    {/* Adaptive mass label */}
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
                            <text x={clampedX} y={labelY} textAnchor="middle" className="text-xs font-mono" fill="hsl(var(--foreground))" fontWeight="600">
                                {currentMass.toFixed(1)} kg
                            </text>
                        );
                    })()}

                    <text x={bChartX + bChartW / 2} y={305} textAnchor="middle" className="text-sm font-mono" fill="hsl(var(--foreground))" fontWeight="500">
                        Biomass Growth
                    </text>
                </g>
            </svg>
        </div>
    );
};

export default CombinedEffectsVisualizer;
