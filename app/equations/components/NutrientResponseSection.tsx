"use client";

import { useState, useMemo } from "react";
import {
    nutrientEquations,
    type NutrientEquation,
    type Parameter,
} from "@/lib/equations/nutrient";
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

function calcMonod(S: number, p: Record<string, number>): number {
    const Ks = p["K_s"];
    if (S <= 0) return 0;
    return S / (Ks + S);
}

function calcHaldane(S: number, p: Record<string, number>): number {
    const Ks = p["K_s"];
    const Ki = p["K_i"];
    if (S <= 0) return 0;
    return S / (Ks + S + (S * S) / Ki);
}

function calcHill(S: number, p: Record<string, number>): number {
    const Ks = p["K_s"];
    const n = p["n"];
    if (S <= 0) return 0;
    const Sn = Math.pow(S, n);
    const Ksn = Math.pow(Ks, n);
    return Sn / (Ksn + Sn);
}

const calculators: Record<string, (S: number, p: Record<string, number>) => number> = {
    monod: calcMonod,
    haldane: calcHaldane,
    hill: calcHill,
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

const S_MAX = 50; // mg/L — x-axis domain

function EquationCard({ equation }: { equation: NutrientEquation }) {
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
        const points: { S: number; fN: number; fNmin: number; fNmax: number }[] = [];
        for (let i = 0; i <= 200; i++) {
            const S = (i / 200) * S_MAX;
            let fN = calc(S, params);
            fN = Math.max(0, Math.min(1, fN));

            let fNmin = 1;
            let fNmax = 0;
            for (const combo of combos) {
                const val = Math.max(0, Math.min(1, calc(S, combo)));
                if (val < fNmin) fNmin = val;
                if (val > fNmax) fNmax = val;
            }

            points.push({
                S: Math.round(S * 100) / 100,
                fN: Math.round(fN * 1e6) / 1e6,
                fNmin: Math.round(fNmin * 1e6) / 1e6,
                fNmax: Math.round(fNmax * 1e6) / 1e6,
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
                            dataKey="fNmax"
                            fill="rgb(140, 80, 200)"
                            fillOpacity={0.2}
                            stroke="none"
                            isAnimationActive={false}
                        />
                        <Area
                            type="monotone"
                            dataKey="fNmin"
                            fill="#ffffff"
                            fillOpacity={1}
                            stroke="none"
                            isAnimationActive={false}
                        />
                        <XAxis
                            dataKey="S"
                            type="number"
                            domain={[0, S_MAX]}
                            ticks={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]}
                            label={{
                                value: "Nutrient Concentration, S (mg/L)",
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
                                value: "Nutrient Factor, f_N (-)",
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
                                "f_N",
                            ]}
                            labelFormatter={(label) =>
                                `S = ${label} mg/L`
                            }
                        />
                        <Line
                            type="monotone"
                            dataKey="fN"
                            stroke="rgb(140, 80, 200)"
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

export default function NutrientResponseSection() {
    return (
        <Accordion type="multiple" className="w-full">
            {nutrientEquations.map((eq) => (
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
