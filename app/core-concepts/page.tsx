import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import GrowthRateVisualizer from './components/GrowthRateVisualizer';
import LightEffectsVisualizer from './components/LightEffectsVisualizer';
import TemperatureEffectsVisualizer from './components/TemperatureEffectsVisualizer';
import NutrientEffectsVisualizer from './components/NutrientEffectsVisualizer';
import CombinedEffectsVisualizer from './components/CombinedEffectsVisualizer';
import LightAttenuationVisualizer from './components/LightAttenuationVisualizer';
import LightAbsorptionVisualizer from './components/LightAbsorptionVisualizer';

const coreSections = [
    { id: 'growth-rate', title: 'Growth Rate' },
    { id: 'light-effects', title: 'Light Effects' },
    { id: 'temperature-effects', title: 'Temperature Effects' },
    { id: 'nutrient-effects', title: 'Nutrient Effects' },
    { id: 'combined-effects', title: 'Combined Effects' },
];

const lightSections = [
    { id: 'light-attenuation', title: 'Light Attenuation' },
    { id: 'light-absorption', title: 'Light Absorption' },
];

const visualizerMap: Record<string, React.FC> = {
    'growth-rate': GrowthRateVisualizer,
    'light-effects': LightEffectsVisualizer,
    'temperature-effects': TemperatureEffectsVisualizer,
    'nutrient-effects': NutrientEffectsVisualizer,
    'combined-effects': CombinedEffectsVisualizer,
    'light-attenuation': LightAttenuationVisualizer,
    'light-absorption': LightAbsorptionVisualizer,
};

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
                <div className="space-y-12">
                    {/* Core Growth Concepts */}
                    <div>
                        <h2 className="mb-4 text-xl font-medium tracking-tight">
                            Core Growth Concepts
                        </h2>
                        <Accordion type="multiple" className="w-full">
                            {coreSections.map((section) => {
                                const Viz = visualizerMap[section.id];
                                return (
                                    <AccordionItem key={section.id} value={section.id}>
                                        <AccordionTrigger className="text-lg">
                                            {section.title}
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            {Viz ? <Viz /> : <p className="text-muted-foreground">Coming soon.</p>}
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    </div>

                    {/* Specific Light Concepts */}
                    <div>
                        <h2 className="mb-4 text-xl font-medium tracking-tight">
                            Specific Light Concepts
                        </h2>
                        <Accordion type="multiple" className="w-full">
                            {lightSections.map((section) => {
                                const Viz = visualizerMap[section.id];
                                return (
                                    <AccordionItem key={section.id} value={section.id}>
                                        <AccordionTrigger className="text-lg">
                                            {section.title}
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            {Viz ? <Viz /> : <p className="text-muted-foreground">Coming soon.</p>}
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    </div>
                </div>
            </section>
        </div>
    );
}
