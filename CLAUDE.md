# AlgaeMath — Claude Code Project Notes

## Project Overview
AlgaeMath is a Next.js (App Router) site with interactive tools for algae cultivation engineering. Built with TypeScript, Tailwind CSS v4, Recharts, Three.js, and KaTeX.

## Key Architecture
- **Framework**: Next.js 15 with App Router, "use client" for interactive components
- **Styling**: Tailwind CSS v4 with `@import "tailwindcss"` in globals.css
- **Fonts**: Geist (sans) + Geist Mono loaded via `next/font/google`
- **UI Components**: shadcn/ui (Slider, Accordion, etc.) in `components/ui/`
- **Logo**: Inline SVG in SiteHeader.tsx and app/page.tsx using Geist font

## Mobile Responsive Design (established patterns)
- **Horizontal sliders on mobile**: Vertical sliders are hidden on mobile (`hidden sm:flex` or `hidden md:flex` or `hidden lg:flex`) and replaced with horizontal `<Slider>` components (`sm:hidden` / `md:hidden` / `lg:hidden`). The horizontal sliders show parameter label + value on a row above the slider.
- **Show/hide layout divergence**: When mobile and desktop layouts differ significantly, render both and use responsive visibility classes. Use `sm:contents` or `lg:contents` to dissolve wrapper divs on larger screens.
- **Touch handling**: Add `touch-pan-y` to chart containers to prevent horizontal page scrolling when interacting with charts. Add `overflow-x-hidden` on body.
- **SVG viewBox cropping**: For complex SVG visualizations, use separate SVGs with different viewBox crops for mobile vs desktop. Extract render functions to avoid content duplication.
- **Breakpoints used**: `sm:` (640px) for header nav, `md:` (768px) for explorations/simulators, `lg:` (1024px) for equations grid and growth model panels.

## Pages & Key Components
- `/` — Home page with logo + page cards
- `/core-concepts` — 7 interactive visualizers (growth rate, light, temp, nutrient, combined, attenuation, absorption)
- `/equations` — 5 equation sections with model cards (light, temp, nutrient, pH, attenuation)
- `/simple-simulators/open-pond` — Open pond simulator with 3D canvas, world map, growth model panels
- `/explorations` — Design explorer with variable depth + layered light sections
- `/technoeconomics` — TEA index page with reactor type cards
- `/technoeconomics/open-pond` — Open pond TEA with interactive sliders (facility size, sale price), KPI cards, MBSP breakdown, quarterly lifetime value chart, clickable sections overview with right slide-in detail panel, cost contribution, sensitivity, cash flow schedule, left slide-in unit cost panel

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint

## Important Files
- `components/layout/SiteHeader.tsx` — Header with inline SVG logo + mobile hamburger menu
- `app/layout.tsx` — Root layout with `overflow-x-hidden` on body
- `app/globals.css` — Tailwind v4 config with custom CSS variables
- `lib/simulation/cell-animation.ts` — Shared cell animation constants (MX=260, MY=195, MR=70)

## TEA Engine Architecture
- **Engine**: `lib/technoeconomics/open-pond/engine.ts` — `runTEA(configOverrides?)` pure function, config → TEAResult
- **Types**: `lib/technoeconomics/types.ts` — TEAConfig (80+ params), TEAResult, SectionCost, ConstructionTimeline, AnnualCashFlow, etc.
- **Config**: `lib/technoeconomics/open-pond/config.ts` + `data/default-config.json` — default config with JSON → flat TEAConfig parsing
- **Sections**: `lib/technoeconomics/open-pond/sections/` — inputs, inoculum, biomass, harvesting, drying (each independent)
- **Common**: `lib/technoeconomics/common/` — geometry, nutrient-balance, financials (NPV/IRR/MBSP/DCF), construction (batched timeline + ramp-up), constants, energy, cost-escalation, installation
- **Construction model**: Fully sequential batches of up to 10 ponds; each pond = 1 week build + 4 weeks batch test. CAPEX staged per batch. Production ramps up as batches complete.
- **Frontend**: `app/technoeconomics/open-pond/components/` — OpenPondTEA (main), SystemSummaryCards, SectionsOverviewTable (clickable cells), MBSPBreakdownTable, CostContributionTable, LifetimeValueChart (Recharts, quarterly), CashFlowTable, SensitivityTable, SectionDetailPanel (right slide-in), InputCostsPanel (left slide-in), InputVariablesTable, formatters

## TEA Slide-in Panel Pattern
- Panels use `fixed` positioning with `translate-x` transitions for open/close
- Tab attached to panel edge (overlaps border by 1px to hide seam), `writing-mode: vertical-rl`
- Right panel (Economic Details): max `min(50vw, 640px)`, shows section cost breakdown
- Left panel (Unit Costs): max `min(20vw, 360px)`, shows input commodity prices
- Backdrop (`bg-black/30`) closes panel on click; Escape key also closes
