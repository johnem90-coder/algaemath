import Link from 'next/link';

const sections = [
  {
    href: '/core-concepts',
    title: 'Core Concepts',
    description:
      'Interactive visualizations of algae growth kinetics — light, temperature, nutrients, and combined effects.',
    badge: 'Concepts',
  },
  {
    href: '/equations',
    title: 'Equations',
    description:
      'The mathematical models behind algae growth, presented with live LaTeX rendering.',
    badge: 'Equations',
  },
  {
    href: '/simple-simulators',
    title: 'Simple Simulators',
    description:
      'Quick, single-reactor simulators for flat-panel, open-pond, and tubular PBR systems.',
    badge: 'Simulate',
    soon: true,
  },
  {
    href: '/models',
    title: 'Reactor Models',
    description:
      'Detailed reactor models with full parameter sweeps and design exploration tools.',
    badge: 'Models',
    soon: true,
  },
  {
    href: '/experiments',
    title: 'Experiments',
    description:
      'Curve-fitting tools for light-response, temperature-response, and nutrient-uptake data.',
    badge: 'Experiments',
    soon: true,
  },
  {
    href: '/technoeconomics',
    title: 'Techno-Economics',
    description:
      'Cost analysis and economic viability calculators for algae cultivation systems.',
    badge: 'TEA',
    soon: true,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="mx-auto max-w-5xl px-6 pt-12 pb-12 md:pt-24 md:pb-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          <span className="text-[hsl(var(--accent-science))]">Algae</span>Math
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Interactive tools for algae cultivation engineering — from foundational
          biology to reactor design and techno-economics.
        </p>
      </header>

      {/* Section cards */}
      <section className="mx-auto max-w-5xl px-6 pb-32">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => {
            const card = (
              <div
                className={`group relative flex flex-col rounded-xl border p-6 transition-colors ${s.soon
                    ? 'opacity-60 cursor-default'
                    : 'hover:border-[hsl(var(--accent-science))] hover:bg-[hsl(var(--accent-science-muted))]'
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

      {/* Footer */}
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} AlgaeMath — Open-source algae cultivation tools
      </footer>
    </div>
  );
}
