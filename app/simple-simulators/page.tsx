import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Simple Simulators — AlgaeMath",
  description:
    "Quick, single-reactor simulators for open-pond, flat-panel, and tubular PBR systems.",
};

const simulators = [
  {
    href: "/simple-simulators/open-pond",
    title: "Open Raceway Pond",
    description:
      "Interactive simulations of an outdoor pond growing algae. Location based. Breakdown of calculations. Data downloads available.",
    badge: "Open Pond",
  },
  {
    href: "/simple-simulators/flat-panel",
    title: "Flat Panel PBR",
    description:
      "Enclosed flat-panel photobioreactor with light path visualization and gas sparging.",
    badge: "Flat Panel",
    soon: true,
  },
  {
    href: "/simple-simulators/pbr-tubular",
    title: "Tubular PBR",
    description:
      "Tubular photobioreactor with flow visualization, photoperiod analysis, and scaling factors.",
    badge: "Tubular",
    soon: true,
  },
];

export default function SimpleSimulatorsPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-5xl px-6 pt-12 pb-12 md:pt-24 md:pb-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Simple{" "}
          <span className="text-[hsl(var(--accent-science))]">Simulators</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Quick, interactive simulators for common algae cultivation reactor
          types — explore how environmental conditions affect growth in real
          time.
        </p>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-32">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {simulators.map((s) => {
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
