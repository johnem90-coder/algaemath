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
- `/` — Home page with logo + 2×4 grid of page cards (row 1: active, row 2: coming soon). Max width `6xl`, cards `lg:grid-cols-4`.
- `/core-concepts` — 7 interactive visualizers (growth rate, light, temp, nutrient, combined, attenuation, absorption)
- `/equations` — 5 equation sections with model cards (light, temp, nutrient, pH, attenuation)
- `/simple-simulators/open-pond` — Open pond simulator with 3D canvas, world map, growth model panels
- `/explorations` — Design explorer with three collapsible sections: Variable Depth, Layered Light Distribution, Light-Guide Panels. Each has a 3D Three.js pond animation, 2D SVG cross-section, dimension diagram, and Recharts charts — all fully wired with simulation data.
- `/technoeconomics` — TEA index page with reactor type cards
- `/technoeconomics/open-pond` — Open pond TEA with interactive sliders (facility size, sale price), financial overview table + lifetime value chart, process flow diagram (static SVG with interactive section highlighting), clickable sections overview with right slide-in detail panel, cost contribution, sensitivity, cash flow schedule, left slide-in System Inputs panel
- `/complex-simulators` — (coming soon) Full-system simulations with PID-controlled equipment
- `/sensors` — (coming soon) Concepts and mathematics behind optical density sensing, PAM fluorimetry, etc.

Admin pages live under `app/admin/` (no SiteHeader/footer, not in nav):
- `/admin/diagrams` — React Flow diagram editor (password-gated, full-viewport canvas). Saves diagram JSON to `public/diagrams/` for embedding on public pages.

## Commands
- `npm run dev` — Start dev server (Turbopack, default)
- `npm run dev -- --webpack` — Start dev server with webpack (required when working on `/admin/diagrams` — Turbopack panics on that route due to a known bug with `@xyflow/react`)
- `npm run build` — Production build
- `npm run lint` — ESLint

## Important Files
- `components/layout/SiteHeader.tsx` — Header with inline SVG logo + mobile hamburger menu. Nav includes active + coming-soon pages.
- `app/layout.tsx` — Root layout (html/body/fonts only — no SiteHeader)
- `app/(site)/layout.tsx` — Public site layout (SiteHeader + footer + Analytics)
- `app/admin/layout.tsx` — Admin layout (bare, no site chrome; loads `/xyflow-style.css` via `<link>`)
- `app/globals.css` — Tailwind v4 config with custom CSS variables
- `lib/simulation/cell-animation.ts` — Shared cell animation constants (MX=260, MY=195, MR=70)
- `lib/simulation/pond-sizes.ts` — Pond size database with `PondSize` interface, `makePond()` factory. Exports `POND_DEMO` (4.4×1.4m) and `POND_PRODUCTION` (250×17m).
- `public/robots.txt` — Disallows `/admin/` from search crawlers
- `public/xyflow-style.css` — React Flow CSS served as static asset (avoids Turbopack resolution bug)
- `public/diagrams/` — Diagram JSON files exported from the admin editor, embedded as static SVGs on public pages
- `app/(site)/technoeconomics/open-pond/components/DiagramView.tsx` — Pure SVG renderer for diagram JSON (no React Flow dependency); auto-detects sections via geometry, interactive hover/click linking with SectionsOverviewTable and Economic Details panel

## Explorations Page Architecture

### Demo Pond Geometry
All three sections use the same demo pond: 4.4m × 1.4m stadium (3.0m straight edge, 0.7m semicircle radius, 0.2m center berm). Shared constants `POND_*` defined at top of DesignExplorer.tsx:
- `POND_A_RECT = 3.6 m²` (two rectangular channels: 3.0 × 1.2)
- `POND_A_SEMI ≈ 1.539 m²` (two semicircular ends: π × 0.7²)
- `POND_A_TOTAL ≈ 5.139 m²`, `POND_CHANNEL_W = 0.6m`
- `POND_F_STRAIGHT ≈ 0.700`, `POND_F_CURVED ≈ 0.300`
- `DEMO_CONFIG` overrides `DEFAULT_CONFIG` with demo pond `area_ha`, `aspect_ratio`, `berm_width`. Used by all three sections for simulations.
- Volume overlay on 3D diagrams: 1 decimal below 20 kL, integers above.

### Pond Sizes Database
`lib/simulation/pond-sizes.ts` — Centralized pond geometry definitions with `PondSize` interface. `makePond(id, name, length, width, berm)` factory computes all derived fields (radius, straightLength, channelWidth, areaRect, areaSemi, areaTotal, fractionStraight, fractionCurved). Exports `POND_DEMO` and `POND_PRODUCTION`.

### 3D Diagrams
`DepthDiagram.tsx`, `LayeredDiagram.tsx`, `LightGuidePanelDiagram.tsx` — Three.js with transparent background (`alpha: true`), matching lighting rigs, camera at `Spherical(9.0, 1.0, 0.65)`, line-based sun ray animation. Each exports a standalone `*CrossSection` component for mobile use (lightweight SVG, no Three.js dependency).

### 2D Cross-Sections
Inline SVG with `useId()`-based gradient IDs. Proportional aspect ratio: `drawW` pixels = 600mm channel width. **Desktop**: rendered inside diagram component (`hidden md:flex`, 220px column). **Mobile**: rendered separately via exported `DepthCrossSection`, `LayeredCrossSection`, `LightGuidePanelCrossSection` components in DesignExplorer's `md:hidden` blocks — keeps diagram component internals untouched.

### Responsive Layout
- **Desktop (lg+)**: `flex-wrap` row with vertical slider | diagram (fixed `w-[480px]`, cross-section 220px + 3D canvas) | charts (2× 320px). Charts wrap to second row when viewport is too narrow.
- **Desktop (md–lg)**: Same but charts always on second row due to wrap.
- **Mobile**: Horizontal sliders, standalone cross-section SVG above 260px 3D animation, charts stacked full-width.
- **Under the Hood titles**: Responsive abbreviation — "Light Response" → "Lt. Resp.", "Temperature Response" → "Temp. Resp." below `xl` breakpoint. Model pill names also abbreviated (e.g., "Steele" → "St.", "Beta Function" → "Beta").

### Light-Guide Panels Simulation Engine
`runLightGuidePanelSimulation()` in DesignExplorer.tsx — custom simulation with hybrid PAR model:
- **Straight sections (~70%)**: Panels capture surface flux (no Fresnel loss), redistribute horizontally. `I_panel = I_incoming × spacing / (2 × depth)`. Horizontal Beer-Lambert attenuation over `halfSpacing`. Uses `beerLambertAvg()` and `lightedDepthFraction()` from optics.ts.
- **Curved sections (~30%)**: Standard top-down Beer-Lambert via `computePAR()`.
- Growth rates computed per-zone, blended by `POND_F_STRAIGHT` / `POND_F_CURVED`.
- Reuses base simulation for thermal trajectory (heat balance insensitive to light redistribution), re-steps biomass with custom PAR model.
- Accepts `precomputedBase` for envelope optimization (avoids redundant heat balance runs).
- Envelope: 2D sweep (10 depth steps × 8 panel ticks = 80 bio loops + 10 base sims), independent of slider values.

### Chart Axis Utilities
- `niceAxis(rawMax)` — generates human-friendly tick marks (5–10 ticks).
- `smartFormat(ticks)` — determines minimum decimal places (1–2) to avoid duplicate tick labels; filters ticks if 2 decimals still produce duplicates. Returns `{ ticks, fmt }`.
- Light models: Steele, Monod, Haldane, Webb, Beta Function (5 options). Temperature models: Gaussian, Asym. Gaussian, Quad. Exp., Beta Function (4 options). Each has `name` and `short` for responsive display.

### DesignExplorer.tsx
Main orchestrator with collapsible sections, state for all sliders, weather data loading. All three sections fully wired with simulation data, envelope bands, dynamic axes, and Under the Hood sub-sections with model selector pills and 3-column chart grids.

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
