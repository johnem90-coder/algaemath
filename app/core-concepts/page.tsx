import CoreConceptsAccordions from './components/CoreConceptsAccordions';

export const metadata = {
    title: 'Core Concepts — AlgaeMath',
    description:
        'Interactive visualizations of algae growth kinetics: light, temperature, nutrients, and combined effects.',
};

export default function CoreConceptsPage() {
    return (
        <div className="min-h-screen">
            <header className="mx-auto max-w-7xl px-6 py-12 md:py-16">
                <div className="max-w-3xl space-y-3">
                    <span className="inline-block rounded-full bg-[hsl(var(--accent-science-muted))] px-3 py-1 text-xs font-medium tracking-wide text-[hsl(var(--accent-science))]">
                        Concepts
                    </span>
                    <h1 className="text-3xl font-medium tracking-tight md:text-4xl">
                        Concepts in Algae Growth
                    </h1>
                    <p className="text-muted-foreground max-w-2xl">
                        Foundational concepts behind algae biology, growth kinetics, and the
                        factors that drive productivity in cultivation systems.
                    </p>
                </div>
            </header>

            <section className="mx-auto max-w-[90rem] px-6 pb-24">
                <CoreConceptsAccordions />
            </section>
        </div>
    );
}
