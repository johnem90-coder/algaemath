import type { Metadata } from "next";
import OpenPondTEA from "./components/OpenPondTEA";

export const metadata: Metadata = {
  title: "Open Pond TEA — AlgaeMath",
  description:
    "Techno-economic analysis for large-scale Spirulina cultivation in open raceway ponds. Equipment sizing, cost breakdown, and financial analysis.",
};

export default function OpenPondTEAPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-7xl px-6 py-12 md:py-16">
        <div className="max-w-3xl space-y-3">
          <span className="inline-block rounded-full bg-[hsl(var(--accent-science-muted))] px-3 py-1 text-xs font-medium tracking-wide text-[hsl(var(--accent-science))]">
            TEA
          </span>
          <h1 className="text-3xl font-medium tracking-tight md:text-4xl">
            Open Raceway Pond
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Techno-economic analysis for large-scale Spirulina cultivation.
            Equipment sizing, capital and operating costs, and financial metrics
            (MBSP, NPV, IRR) based on NREL reference data.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-[90rem] px-6 pb-24">
        <OpenPondTEA />
      </section>
    </div>
  );
}
