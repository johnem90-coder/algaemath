import DesignExplorer from './components/DesignExplorer';

export const metadata = {
  title: 'Design Explorations — AlgaeMath',
  description:
    'Explore how pond geometry affects algae growth outcomes. Adjust depth and see density and total biomass curves update in real time.',
};

export default function DesignExplorationsPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-7xl px-6 py-12 md:py-16">
        <div className="max-w-3xl space-y-3">
          <span className="inline-block rounded-full bg-[hsl(var(--accent-science-muted))] px-3 py-1 text-xs font-medium tracking-wide text-[hsl(var(--accent-science))]">
            Design
          </span>
          <h1 className="text-3xl font-medium tracking-tight md:text-4xl">
            Design Explorations
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            See how changes in pond geometry affect growth dynamics. The simulation
            runs automatically over 7 repeating days using a typical weather profile.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-[90rem] px-6 pb-24">
        <DesignExplorer />
      </section>
    </div>
  );
}
