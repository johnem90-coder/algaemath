"use client";

import { useState, useMemo } from "react";
import {
    lightEquations,
    type LightEquation,
    type Parameter,
} from "@/lib/equations/light";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
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
import katex from "katex";
import "katex/dist/katex.min.css";

/* ── Local calculation functions ──────────────────────────────────── */

function calcMonod(I: number, p: Record<string, number>): number {
    const Ks = p["K_s"];
    return I / (Ks + I);
}

function calcHaldane(I: number, p: Record<string, number>): number {
    const Ks = p["K_s"];
    const Ki = p["K_i"];
    return I / (Ks + I + (I * I) / Ki);
}

function calcWebb(I: number, p: Record<string, number>): number {
    const Iopt = p["I_{opt}"];
    const alpha = p["\\alpha"];
    return 1 - Math.exp((-alpha * I) / Iopt);
}

function calcSteele(I: number, p: Record<string, number>): number {
    const Iopt = p["I_{opt}"];
    if (I <= 0) return 0;
    const ratio = I / Iopt;
    return ratio * Math.exp(1 - ratio);
}

function calcBetaFunction(I: number, p: Record<string, number>): number {
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
}

const calculators: Record<string, (I: number, p: Record<string, number>) => number> = {
    monod: calcMonod,
    haldane: calcHaldane,
    webb: calcWebb,
    steele: calcSteele,
    "beta-function": calcBetaFunction,
};

/* ── Parameter envelope helper ────────────────────────────────────── */

function getParamGrid(parameters: Parameter[]): Record<string, number>[] {
    if (parameters.length === 0) return [{}];
    const steps = parameters.length <= 2 ? 20 : parameters.length <= 3 ? 10 : 6;
    const grids = parameters.map((p) => {
        const vals: number[] = [];
        for (let i = 0; i <= steps; i++) {
            vals.push(p.min + (p.max - p.min) * (i / steps));
        }
        return { symbol: p.symbol, vals };
    });
    let combos: Record<string, number>[] = [{}];
    for (const { symbol, vals } of grids) {
        combos = combos.flatMap((c) => vals.map((v) => ({ ...c, [symbol]: v })));
    }
    return combos;
}

/* ── KaTeX helper ─────────────────────────────────────────────────── */

function renderLatex(latex: string): string {
    return katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
        fleqn: true,
    });
}

/* ── Equation card ────────────────────────────────────────────────── */

function EquationCard({ equation }: { equation: LightEquation }) {
    const [params, setParams] = useState<Record<string, number>>(() => {
        const defaults: Record<string, number> = {};
        for (const p of equation.parameters) {
            defaults[p.symbol] = p.default;
        }
        return defaults;
    });

    const updateParam = (symbol: string, value: number) => {
        setParams((prev) => ({ ...prev, [symbol]: value }));
    };

    const data = useMemo(() => {
        const calc = calculators[equation.id];
        const combos = getParamGrid(equation.parameters);
        const points: { I: number; fL: number; fLmin: number; fLmax: number }[] = [];
        for (let i = 0; i <= 200; i++) {
            const I = (i / 200) * 1500;
            let fL = calc(I, params);
            fL = Math.max(0, Math.min(1, fL));

            let fLmin = 1;
            let fLmax = 0;
            for (const combo of combos) {
                const val = Math.max(0, Math.min(1, calc(I, combo)));
                if (val < fLmin) fLmin = val;
                if (val > fLmax) fLmax = val;
            }

            points.push({
                I: Math.round(I * 10) / 10,
                fL: Math.round(fL * 1e6) / 1e6,
                fLmin: Math.round(fLmin * 1e6) / 1e6,
                fLmax: Math.round(fLmax * 1e6) / 1e6,
            });
        }
        return points;
    }, [params, equation.id, equation.parameters]);

    const latexHtml = useMemo(
        () =>
            equation.piecewise
                ? renderLatex(`\\small ${equation.latexFull}`)
                : renderLatex(`\\Large ${equation.latexNormalized}`),
        [equation],
    );

    return (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[240px_1fr_400px] lg:h-[320px]">
            {/* Left — vertical sliders */}
            <div className="flex items-center justify-center">
                {equation.parameters.map((p) => (
                    <div
                        key={p.symbol}
                        className="flex w-12 flex-col items-center gap-2"
                    >
                        <span
                            className="text-xs text-muted-foreground"
                            dangerouslySetInnerHTML={{
                                __html: katex.renderToString(p.symbol, {
                                    throwOnError: false,
                                }),
                            }}
                        />
                        <Slider
                            orientation="vertical"
                            min={p.min}
                            max={p.max}
                            step={p.step}
                            value={[params[p.symbol]]}
                            onValueChange={([v]) => updateParam(p.symbol, v)}
                            className="h-48"
                        />
                        <span className="text-xs font-medium tabular-nums">
                            {params[p.symbol]}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            {p.unit}
                        </span>
                    </div>
                ))}
            </div>

            {/* Center — chart */}
            <div className="min-h-[320px]">
                <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart
                        data={data}
                        margin={{ top: 8, right: 16, bottom: 24, left: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <Area
                            type="monotone"
                            dataKey="fLmax"
                            fill="#cbd5e1"
                            fillOpacity={0.4}
                            stroke="none"
                            isAnimationActive={false}
                        />
                        <Area
                            type="monotone"
                            dataKey="fLmin"
                            fill="#ffffff"
                            fillOpacity={1}
                            stroke="none"
                            isAnimationActive={false}
                        />
                        <XAxis
                            dataKey="I"
                            type="number"
                            domain={[0, 1500]}
                            ticks={[0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500]}
                            label={{
                                value: "Intensity, I (µE/m²/s)",
                                position: "insideBottom",
                                offset: -13,
                                className: "fill-muted-foreground text-xs",
                            }}
                            tick={{ fontSize: 11 }}
                        />
                        <YAxis
                            domain={[0, 1]}
                            tickCount={6}
                            label={{
                                value: "Light Factor, f_L (-)",
                                angle: -90,
                                position: "center",
                                dx: -15,
                                className: "fill-muted-foreground text-xs",
                            }}
                            tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                            formatter={(value) => [
                                Number(value).toFixed(4),
                                "f_L",
                            ]}
                            labelFormatter={(label) =>
                                `I = ${label} µE/m²/s`
                            }
                        />
                        <Line
                            type="monotone"
                            dataKey="fL"
                            stroke="#475569"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Right — equation, description, parameter table */}
            <div className="space-y-2 overflow-y-auto">
                <div
                    className="overflow-x-auto [&_.fleqn>.katex]:!pl-0"
                    dangerouslySetInnerHTML={{ __html: latexHtml }}
                />

                <p className="text-sm leading-relaxed text-muted-foreground">
                    {equation.description}
                </p>

                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-1 pr-3 font-medium">Symbol</th>
                            <th className="pb-1 pr-3 font-medium">Name</th>
                            <th className="pb-1 font-medium">Unit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {equation.parameters.map((p) => (
                            <tr key={p.symbol} className="border-b last:border-0">
                                <td
                                    className="py-1 pr-3"
                                    dangerouslySetInnerHTML={{
                                        __html: katex.renderToString(p.symbol, {
                                            throwOnError: false,
                                        }),
                                    }}
                                />
                                <td className="py-1 pr-3">{p.label}</td>
                                <td className="py-1 text-muted-foreground">
                                    {p.unit}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ── Main section ─────────────────────────────────────────────────── */

export default function LightResponseSection() {
    return (
        <Accordion type="multiple" className="w-full">
            {lightEquations.map((eq) => (
                <AccordionItem key={eq.id} value={eq.id}>
                    <AccordionTrigger className="text-base font-medium">
                        {eq.name}
                    </AccordionTrigger>
                    <AccordionContent>
                        <EquationCard equation={eq} />
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}
