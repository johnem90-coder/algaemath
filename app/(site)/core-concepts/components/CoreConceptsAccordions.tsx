"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import GrowthRateVisualizer from "./GrowthRateVisualizer";
import LightEffectsVisualizer from "./LightEffectsVisualizer";
import TemperatureEffectsVisualizer from "./TemperatureEffectsVisualizer";
import NutrientEffectsVisualizer from "./NutrientEffectsVisualizer";
import CombinedEffectsVisualizer from "./CombinedEffectsVisualizer";
import LightAttenuationVisualizer from "./LightAttenuationVisualizer";
import LightAbsorptionVisualizer from "./LightAbsorptionVisualizer";
import VisibleOnly from "./VisibleOnly";

const coreSections = [
    { id: "growth-rate", title: "Growth Rate" },
    { id: "light-effects", title: "Light Effects" },
    { id: "temperature-effects", title: "Temperature Effects" },
    { id: "nutrient-effects", title: "Nutrient Effects" },
    { id: "combined-effects", title: "Combined Effects" },
];

const lightSections = [
    { id: "light-attenuation", title: "Light Attenuation" },
    { id: "light-absorption", title: "Light Absorption" },
];

const visualizerMap: Record<string, React.FC> = {
    "growth-rate": GrowthRateVisualizer,
    "light-effects": LightEffectsVisualizer,
    "temperature-effects": TemperatureEffectsVisualizer,
    "nutrient-effects": NutrientEffectsVisualizer,
    "combined-effects": CombinedEffectsVisualizer,
    "light-attenuation": LightAttenuationVisualizer,
    "light-absorption": LightAbsorptionVisualizer,
};

export default function CoreConceptsAccordions() {
    return (
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
                                    <VisibleOnly>
                                        {Viz ? (
                                            <Viz />
                                        ) : (
                                            <p className="text-muted-foreground">
                                                Coming soon.
                                            </p>
                                        )}
                                    </VisibleOnly>
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
                                    <VisibleOnly>
                                        {Viz ? (
                                            <Viz />
                                        ) : (
                                            <p className="text-muted-foreground">
                                                Coming soon.
                                            </p>
                                        )}
                                    </VisibleOnly>
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            </div>
        </div>
    );
}
