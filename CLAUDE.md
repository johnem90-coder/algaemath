# AlgaeMath — Claude Code Project Notes

## Project Overview
AlgaeMath is a Next.js (App Router) site with interactive tools for algae cultivation engineering. Built with TypeScript, Tailwind CSS v4, Recharts, Three.js, and KaTeX.

## Key Architecture
- **Framework**: Next.js 16 with App Router, "use client" for interactive components
- **Styling**: Tailwind CSS v4 with `@import "tailwindcss"` in globals.css
- **Fonts**: Geist (sans) + Geist Mono loaded via `next/font/google`
- **UI Components**: shadcn/ui (Slider, Accordion, etc.) in `components/ui/`
- **Logo**: Inline SVG in SiteHeader.tsx and app/(site)/page.tsx using Geist font
- **Route groups**: `app/(site)/` holds all public pages (SiteHeader + footer via `app/(site)/layout.tsx`); `app/admin/` is admin-only (no site chrome)

## Mobile Responsive Design (established patterns)
- **Horizontal sliders on mobile**: Vertical sliders are hidden on mobile (`hidden sm:flex` or `hidden md:flex` or `hidden lg:flex`) and replaced with horizontal `<Slider>` components (`sm:hidden` / `md:hidden` / `lg:hidden`). The horizontal sliders show parameter label + value on a row above the slider.
- **Show/hide layout divergence**: When mobile and desktop layouts differ significantly, render both and use responsive visibility classes. Use `sm:contents` or `lg:contents` to dissolve wrapper divs on larger screens.
- **Touch handling**: Add `touch-pan-y` to chart containers to prevent horizontal page scrolling when interacting with charts. Add `overflow-x-hidden` on body.
- **SVG viewBox cropping**: For complex SVG visualizations, use separate SVGs with different viewBox crops for mobile vs desktop. Extract render functions to avoid content duplication.
- **Breakpoints used**: `sm:` (640px) for header nav, `md:` (768px) for explorations/simulators, `lg:` (1024px) for equations grid and growth model panels.

## Pages & Key Components
All public pages live under `app/(site)/` (URL paths unchanged):
- `/` — Home page with logo + page cards
- `/core-concepts` — 7 interactive visualizers (growth rate, light, temp, nutrient, combined, attenuation, absorption)
- `/equations` — 5 equation sections with model cards (light, temp, nutrient, pH, attenuation)
- `/simple-simulators/open-pond` — Open pond simulator with 3D canvas, world map, growth model panels
- `/explorations` — Design explorer with variable depth + layered light sections
- `/technoeconomics` — TEA index page with reactor type cards
- `/technoeconomics/open-pond` — Open pond TEA with interactive sliders (facility size, sale price), financial overview table + lifetime value chart, process flow diagram (static SVG with interactive section highlighting), clickable sections overview with right slide-in detail panel, cost contribution, sensitivity, cash flow schedule, left slide-in System Inputs panel

Admin pages live under `app/admin/` (no SiteHeader/footer, not in nav):
- `/admin/diagrams` — React Flow diagram editor (password-gated, full-viewport canvas). Saves diagram JSON to `public/diagrams/` for embedding on public pages.

## Commands
- `npm run dev` — Start dev server (Turbopack, default)
- `npm run dev -- --webpack` — Start dev server with webpack (required when working on `/admin/diagrams` — Turbopack panics on that route due to a known bug with `@xyflow/react`)
- `npm run build` — Production build
- `npm run lint` — ESLint

## Important Files
- `components/layout/SiteHeader.tsx` — Header with inline SVG logo + mobile hamburger menu
- `app/layout.tsx` — Root layout (html/body/fonts only — no SiteHeader)
- `app/(site)/layout.tsx` — Public site layout (SiteHeader + footer + Analytics)
- `app/admin/layout.tsx` — Admin layout (bare, no site chrome; loads `/xyflow-style.css` via `<link>`)
- `app/globals.css` — Tailwind v4 config with custom CSS variables
- `lib/simulation/cell-animation.ts` — Shared cell animation constants (MX=260, MY=195, MR=70)
- `public/robots.txt` — Disallows `/admin/` from search crawlers
- `public/xyflow-style.css` — React Flow CSS served as static asset (avoids Turbopack resolution bug)
- `public/diagrams/` — Diagram JSON files exported from the admin editor, embedded as static SVGs on public pages
- `app/(site)/technoeconomics/open-pond/components/DiagramView.tsx` — Pure SVG renderer for diagram JSON (no React Flow dependency); auto-detects sections via geometry, interactive hover/click linking with SectionsOverviewTable and Economic Details panel

## TEA Engine Architecture
- **Engine**: `lib/technoeconomics/open-pond/engine.ts` — `runTEA(configOverrides?)` pure function, config → TEAResult
- **Types**: `lib/technoeconomics/types.ts` — TEAConfig (80+ params), TEAResult, SectionCost, ConstructionTimeline, AnnualCashFlow, etc.
- **Config**: `lib/technoeconomics/open-pond/config.ts` + `data/default-config.json` — default config with JSON → flat TEAConfig parsing
- **Sections**: `lib/technoeconomics/open-pond/sections/` — inputs, inoculum, biomass, harvesting, drying (each independent)
- **Common**: `lib/technoeconomics/common/` — geometry, nutrient-balance, financials (NPV/IRR/MBSP/DCF), construction (batched timeline + ramp-up), constants, energy, cost-escalation, installation
- **Construction model**: Fully sequential batches of up to 10 ponds; each pond = 1 week build + 4 weeks batch test. CAPEX staged per batch. Production ramps up as batches complete.
- **Frontend**: `app/(site)/technoeconomics/open-pond/components/` — OpenPondTEA (main), FinancialOverviewTable, SectionsOverviewTable (clickable cells with hover linking, including land), DiagramView (pure SVG process flow with section detection + highlighting), CostContributionTable, LifetimeValueChart (Recharts, quarterly), CashFlowTable, SensitivityTable, SectionDetailPanel (right slide-in, two-axis navigation by section or category with highlight+scroll), InputCostsPanel (left slide-in "System Inputs"), InputVariablesTable (all ~80 config params by category), formatters

## TEA Slide-in Panel Pattern
- Panels use `fixed` positioning with `translate-x` transitions for open/close
- Tab attached to panel edge (overlaps border by 1px to hide seam), `writing-mode: vertical-rl`
- Right panel (Economic Details): max `min(50vw, 640px)`, two-axis navigation — click section name for all categories, click column header for all sections, click specific cell for all sections with highlight+scroll to that section. Renders detailed tables per category (equipment, installation with multipliers, materials, energy, maintenance, labor). Land included in capital_cost views.
- Left panel (System Inputs): max `min(30vw, 420px)`, shows all ~80 TEA config parameters organized into 15 categories including labor breakdowns by section with individual roles
- Backdrop (`bg-black/30`) closes panel on click; Escape key also closes
- When right panel is open, the Process Flow diagram section gets `position: relative; z-index: 45` (above backdrop z-40, below panel z-50) and `paddingRight: min(50vw, 640px)` with transition, keeping the diagram visible and interactive. Clicking a section in the diagram updates the panel content.

## Diagram Embedding Pattern
- Admin editor saves diagrams as JSON to `public/diagrams/`; public pages render them via `DiagramView` as pure SVG (no React Flow dependency)
- `DiagramView` auto-detects sections from the diagram geometry: finds nodes with labels matching "X Section", matches them to nearby container rectangles, then assigns remaining nodes by geometric containment
- Shared `hoveredSection` state links DiagramView ↔ SectionsOverviewTable bidirectionally (hover a table row → diagram highlights, hover a diagram section → table row highlights)
- Section node IDs match TEA engine section IDs: inputs, inoculum, biomass, harvesting, drying
