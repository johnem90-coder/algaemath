import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Techno-Economic Analysis — AlgaeMath",
  description:
    "Cost analysis and financial modeling for algae cultivation reactor systems.",
};

const analyses = [
  {
    href: "/technoeconomics/open-pond",
    title: "Open Raceway Pond",
    description:
      "Large-scale outdoor Spirulina cultivation in racetrack ponds with paddlewheel mixing. NREL-based cost correlations, 5-section equipment model, DCF financial analysis.",
    badge: "Open Pond",
  },
  {
    href: "/technoeconomics/flat-panel",
    title: "Flat Panel PBR",
    description:
      "Enclosed flat-panel photobioreactor with higher CO₂ uptake efficiency and no evaporative losses.",
    badge: "Flat Panel",
    soon: true,
  },
  {
    href: "/technoeconomics/pbr-tubular",
    title: "Tubular PBR",
    description:
      "Tubular photobioreactor with internal degasser and different energy profile.",
    badge: "Tubular",
    soon: true,
  },
];

export default function TechnoeconomicsPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-5xl px-6 pt-12 pb-12 md:pt-24 md:pb-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Techno-Economic{" "}
          <span className="text-[hsl(var(--accent-science))]">Analysis</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Equipment sizing, capital and operating costs, and financial metrics
          for algae cultivation systems — from pond geometry to minimum biomass
          selling price.
        </p>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-32">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {analyses.map((s) => {
            const card = (
              <div
                className={`group relative flex flex-col rounded-xl border p-6 transition-colors ${
                  s.soon
                    ? "opacity-30 cursor-default"
                    : "hover:border-[hsl(var(--accent-science))] hover:bg-[hsl(var(--accent-science-muted))]"
                }`}
              >
                <span className="mb-3 inline-block w-fit rounded-full bg-[hsl(var(--accent-science-muted))] px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-[hsl(var(--accent-science))]">
                  {s.badge}
                </span>
                <h2 className="text-lg font-medium tracking-tight">
                  {s.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {s.description}
                </p>
                {s.soon && (
                  <span className="mt-3 text-xs font-mono text-muted-foreground">
                    coming soon
                  </span>
                )}
              </div>
            );

            return s.soon ? (
              <div key={s.href}>{card}</div>
            ) : (
              <Link key={s.href} href={s.href} className="no-underline">
                {card}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
