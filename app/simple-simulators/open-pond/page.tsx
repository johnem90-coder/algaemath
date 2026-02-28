import type { Metadata } from "next";
import OpenPondSimulator from "./components/OpenPondSimulator";

export const metadata: Metadata = {
  title: "Open Pond Simulator — AlgaeMath",
  description:
    "Interactive 3D visualization of an open raceway pond for algae cultivation with dynamic weather, lighting, and biomass controls.",
};

export default function OpenPondPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-7xl px-6 py-12 md:py-16">
        <div className="max-w-3xl space-y-3">
          <span className="inline-block rounded-full bg-[hsl(var(--accent-science-muted))] px-3 py-1 text-xs font-medium tracking-wide text-[hsl(var(--accent-science))]">
            Simulator
          </span>
          <h1 className="text-3xl font-medium tracking-tight md:text-4xl">
            Open Raceway Pond
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Interactive simulations of an open raceway algae pond, accounting for
            weather/environmental effects. Adjustable modes &amp; response
            variables/coefficients.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-[90rem] px-6 pb-24">
        <OpenPondSimulator />
      </section>
    </div>
  );
}
