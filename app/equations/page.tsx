import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import LightResponseSection from './components/LightResponseSection';
import TemperatureResponseSection from './components/TemperatureResponseSection';

const placeholderSections = [
    { id: 'nutrient-response', title: 'Nutrient Response' },
    { id: 'ph-response', title: 'pH Response' },
    { id: 'light-attenuation', title: 'Light Attenuation' },
];

export const metadata = {
    title: 'Equations — AlgaeMath',
    description:
        'Mathematical models describing how light, temperature, nutrients, and pH influence algae growth rate.',
};

export default function EquationsPage() {
    return (
        <div className="min-h-screen">
            <header className="mx-auto max-w-7xl px-6 py-12 md:py-16">
                <div className="max-w-3xl space-y-3">
                    <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium tracking-wide text-slate-500">
                        Equations
                    </span>
                    <h1 className="text-3xl font-medium tracking-tight md:text-4xl">
                        Growth Rate Equations
                    </h1>
                    <p className="text-muted-foreground max-w-2xl">
                        Mathematical models describing how light, temperature, nutrients, and pH
                        influence algae growth rate.
                    </p>
                </div>
            </header>

            <section className="mx-auto max-w-[90rem] px-6 pb-24">
                <Accordion type="multiple" defaultValue={['light-response']} className="w-full">
                    <AccordionItem value="light-response">
                        <AccordionTrigger className="text-lg">
                            Light Response
                        </AccordionTrigger>
                        <AccordionContent>
                            <LightResponseSection />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="temperature-response">
                        <AccordionTrigger className="text-lg">
                            Temperature Response
                        </AccordionTrigger>
                        <AccordionContent>
                            <TemperatureResponseSection />
                        </AccordionContent>
                    </AccordionItem>

                    {placeholderSections.map((section) => (
                        <AccordionItem key={section.id} value={section.id}>
                            <AccordionTrigger className="text-lg">
                                {section.title}
                            </AccordionTrigger>
                            <AccordionContent>
                                <p className="text-muted-foreground py-8 text-center">
                                    Coming soon.
                                </p>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </section>
        </div>
    );
}
