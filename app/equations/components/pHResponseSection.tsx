"use client";

import { useState, useMemo } from "react";
import {
    pHEquations,
    type PHEquation,
    type Parameter,
} from "@/lib/equations/pH";
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

function calcGaussianSymmetric(pH: number, p: Record<string, number>): number {
    const pHopt = p["pH_{opt}"];
    const alpha = p["\\alpha"];
    const d = pH - pHopt;
    return Math.exp(-alpha * d * d);
}

function calcGaussianAsymmetric(pH: number, p: Record<string, number>): number {
    const pHopt = p["pH_{opt}"];
    const alpha = p["\\alpha"];
    const beta = p["\\beta"];
    const shape = pH < pHopt ? alpha : beta;
    const d = pH - pHopt;
    return Math.exp(-shape * d * d);
}

function calcCardinal(pH: number, p: Record<string, number>): number {
    const pHmin = p["pH_{min}"];
    const pHopt = p["pH_{opt}"];
    const pHmax = p["pH_{max}"];
    if (pH <= pHmin || pH >= pHmax) return 0;
    const num = (pH - pHmin) * (pH - pHmax);
    const den = (pHopt - pHmin) * (pHopt - pHmax);
    return Math.max(0, num / den);
}

const calculators: Record<string, (pH: number, p: Record<string, number>) => number> = {
    "gaussian-symmetric": calcGaussianSymmetric,
    "gaussian-asymmetric": calcGaussianAsymmetric,
    cardinal: calcCardinal,
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

function EquationCard({ equation }: { equation: PHEquation }) {
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
        const points: { pH: number; fPH: number; fPHmin: number; fPHmax: number }[] = [];
        for (let i = 0; i <= 200; i++) {
            const pH = 3 + (i / 200) * 9;
            let fPH = calc(pH, params);
            fPH = Math.max(0, Math.min(1, fPH));

            let fPHmin = 1;
            let fPHmax = 0;
            for (const combo of combos) {
                const val = Math.max(0, Math.min(1, calc(pH, combo)));
                if (val < fPHmin) fPHmin = val;
                if (val > fPHmax) fPHmax = val;
            }

            points.push({
                pH: Math.round(pH * 100) / 100,
                fPH: Math.round(fPH * 1e6) / 1e6,
                fPHmin: Math.round(fPHmin * 1e6) / 1e6,
                fPHmax: Math.round(fPHmax * 1e6) / 1e6,
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
                            dataKey="fPHmax"
                            fill="rgb(20, 150, 140)"
                            fillOpacity={0.2}
                            stroke="none"
                            isAnimationActive={false}
                        />
                        <Area
                            type="monotone"
                            dataKey="fPHmin"
                            fill="#ffffff"
                            fillOpacity={1}
                            stroke="none"
                            isAnimationActive={false}
                        />
                        <XAxis
                            dataKey="pH"
                            type="number"
                            domain={[3, 12]}
                            ticks={[3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12]}
                            label={{
                                value: "pH",
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
                                value: "pH Factor, f_pH (-)",
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
                                "f_pH",
                            ]}
                            labelFormatter={(label) => `pH = ${label}`}
                        />
                        <Line
                            type="monotone"
                            dataKey="fPH"
                            stroke="rgb(20, 150, 140)"
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

export default function pHResponseSection() {
    return (
        <Accordion type="multiple" className="w-full">
            {pHEquations.map((eq) => (
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
