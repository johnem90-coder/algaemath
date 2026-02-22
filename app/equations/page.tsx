import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import LightResponseSection from './components/LightResponseSection';
import TemperatureResponseSection from './components/TemperatureResponseSection';
import NutrientResponseSection from './components/NutrientResponseSection';
import PHResponseSection from './components/pHResponseSection';
import LightAttenuationSection from './components/LightAttenuationSection';

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

                    <AccordionItem value="nutrient-response">
                        <AccordionTrigger className="text-lg">
                            Nutrient Response
                        </AccordionTrigger>
                        <AccordionContent>
                            <NutrientResponseSection />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="ph-response">
                        <AccordionTrigger className="text-lg">
                            pH Response
                        </AccordionTrigger>
                        <AccordionContent>
                            <PHResponseSection />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="light-attenuation">
                        <AccordionTrigger className="text-lg">
                            Light Attenuation
                        </AccordionTrigger>
                        <AccordionContent>
                            <LightAttenuationSection />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </section>
        </div>
    );
}
