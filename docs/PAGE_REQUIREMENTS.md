# Page Requirements

Detailed specifications for each page.

---

## 1. Landing Page

**Route:** `/`
**Type:** Static with section cards
**Status:** ✅ Implemented

**Layout:**
1. Hero - Site title ("AlgaeMath"), tagline, centered
2. Section Grid - 6 cards in 3-column grid:
   - **Core Concepts** — "Interactive visualizations of key algae growth metrics. Designed for conceptual understanding."
   - **Equations** — "Various mathematical models behind algae growth metrics. Designed to show differences between models and their potential ranges."
   - **Simple Simulators** — "Quick, single-reactor simulators for open pond, flat panel, and tubular photobioreactor systems. Designed for flexibility & scenario comparisons."
   - **Reactor Models** — coming soon (opacity-30)
   - **Experiments** — coming soon (opacity-30)
   - **Techno-Economics** — coming soon (opacity-30)
3. Global footer (from layout.tsx) — copyright left, LinkedIn right

**Components:** Inline in `page.tsx` (no separate component files needed)

---

## 2. Core Concepts

**Route:** `/core-concepts`
**Type:** Single scrollable page with accordion sections
**Status:** ✅ Implemented (7 visualizers)

**Architecture:**
- `page.tsx` is a server component (exports `metadata`)
- `CoreConceptsAccordions.tsx` is a client component that renders all accordions
- Each visualizer is wrapped in `VisibleOnly` (IntersectionObserver) to unmount when off-screen

**Sections (two accordion groups):**

*Core Growth Concepts:*
1. **Growth Rate** — Cell animation + growth rate visualization
2. **Light Effects** — Cell animation + light response curves
3. **Temperature Effects** — Cell animation + temperature response
4. **Nutrient Effects** — Cell animation + nutrient limitation
5. **Combined Effects** — Combined growth factor visualization

*Specific Light Concepts:*
6. **Light Attenuation** — Beer-Lambert depth profile (slider-driven, no RAF loop)
7. **Light Absorption** — Pigment random walk animation

**Performance notes:**
- 5 of 7 visualizers use RAF loops with cell animations (3–6 setState calls per frame)
- All RAF loops import `shouldYieldToInteraction()` from `shared-timer.ts` — skips animation frames for 200ms after any click/tap
- `VisibleOnly` ensures off-screen visualizers are fully unmounted
- Accordions use uncontrolled `type="multiple"` (no open-panel limit)

**Components (in `app/core-concepts/components/`):**
- `CoreConceptsAccordions.tsx` — Accordion layout, section definitions, visualizer map
- `VisibleOnly.tsx` — IntersectionObserver wrapper
- `GrowthRateVisualizer.tsx`
- `LightEffectsVisualizer.tsx`
- `TemperatureEffectsVisualizer.tsx`
- `NutrientEffectsVisualizer.tsx`
- `CombinedEffectsVisualizer.tsx`
- `LightAttenuationVisualizer.tsx`
- `LightAbsorptionVisualizer.tsx`

---

## 3. Equations

**Route:** `/equations`
**Type:** Single scrollable page with model comparisons
**Status:** ✅ Implemented (5 sections)

**Sections (implemented):**
1. **Light Response** — Light models with interactive curves
2. **Temperature Response** — Temperature models with interactive curves
3. **Nutrient Response** — Nutrient limitation models
4. **pH Response** — pH effect models
5. **Light Attenuation** — Beer-Lambert, depth profiles

**Sections (planned):**
6. **Heat Flux** — 6+ components explained (see SIMULATION_DESIGN.md)
7. **Surface Optics** — Fresnel, Snell's law, refraction
8. **Growth Rate** — Multiplicative vs Liebig

**Each model shows:**
- Name & description
- Equation (LaTeX rendered via KaTeX)
- Variables table
- Use cases
- Limitations
- Reference citation
- Interactive curve (some sections)

**Components (in `app/equations/components/`):**
- `LightResponseSection.tsx`
- `TemperatureResponseSection.tsx`
- `NutrientResponseSection.tsx`
- `pHResponseSection.tsx`
- `LightAttenuationSection.tsx`

---

## 4. Models Pages

**Status:** 📋 Planned (placeholder directories only)

### Open Pond (`/models/open-pond`)
### Flat Panel (`/models/flat-panel`)
### Tubular PBR (`/models/pbr-tubular`)
### Design Exploration (`/models/design-exploration`)

---

## 5. Technoeconomics Pages

**Status:** 📋 Planned (placeholder directories only)

### All Three (`open-pond`, `flat-panel`, `pbr-tubular`)

---

## 6. Simple Outdoor Simulators

### Index Page (`/simple-simulators`)
**Status:** ✅ Implemented

3 cards in grid: Open Raceway Pond (active), Flat Panel PBR (coming soon, opacity-30), Tubular PBR (coming soon, opacity-30).

### Open Pond (`/simple-simulators/open-pond`)
**Status:** ✅ Implemented

**Description:** "Interactive simulations of an open raceway algae pond, accounting for weather/environmental effects. Adjustable modes & response variables/coefficients."

**Inputs:**
- Location (SVG world map with 29 predefined cities across 6 continents)
- Season selection (Spring, Summer, Autumn, Winter — maps to 14-day date ranges)
- Simulation duration (1–14 days, adjustable via slider)
- Growth model parameters (µ_max, I_opt, T_opt, alpha, death rate, epsilon, kb)
- Harvest mode (none, semi-continuous, periodic) with configurable thresholds

**Real-time Outputs:**
- 3D pond visualization (Three.js) with weather-driven effects
- Weather gauges overlay (rain, cloud, wind + compass direction)
- Pond dimensions overlay
- Time-series SVG charts (biomass density, productivity, accumulated biomass)
- Day/time display

**"Under the Hood" Panels (GrowthModelPanels):**
- Light Response — model curves with live position marker, parameter sliders
- Temperature Response — model curves with live temperature marker, parameter sliders
- Light Attenuation — depth profile + Fresnel transmission chart
- Mass Balance — growth/harvest/net tracking charts
- Water Balance — cumulative evaporation, makeup, harvest water charts
- Heat / Energy Balance — placeholder (coming soon)
- Inline sub-controls (days, harvest mode, harvest parameter sliders) in each accordion trigger

**Simulation Data Export:**
- "Simulation Data" button appears top-right of 3D renderer after simulation completes
- Toggles a scrollable data table overlay covering the 3D renderer area
- Sticky Date and Hour columns, all 40+ simulation variables displayed
- "Download CSV" button generates CSV with metadata comment header
- CSV filename: `open-pond-{city}-{season}-{days}d.csv`

**Controls:**
- Run Simulation / Pause / Resume / Stop buttons
- Day/time indicator

**Components (in `app/simple-simulators/open-pond/components/`):**
- `OpenPondSimulator.tsx` — Main orchestrator (simulation state, animation loop, pause/resume, data export overlay, CSV download)
- `WorldMap.tsx` — SVG world map with city markers, season selection, weather data table overlay
- `PondCanvas.tsx` — Three.js 3D pond renderer with weather-driven effects
- `SimulationCharts.tsx` — SVG time-series charts with harvest config sliders
- `GrowthModelPanels.tsx` — "Under the Hood" accordion with interactive growth model panels
- `DataStrip.tsx` — Live data cards (PAR, pond temp, density, growth rate, productivity, wind)
- `PondControls.tsx` — Legacy (unused)
- `WeatherPanel.tsx` — Legacy (unused)
- `WindIndicator.tsx` — Wind direction compass

### Flat Panel PBR (`/simple-simulators/flat-panel`)
**Status:** 📋 Planned (placeholder directory only)

### Tubular PBR (`/simple-simulators/pbr-tubular`)
**Status:** 📋 Planned (placeholder directory only)

---

## 7. Dynamic PBR Simulator

**Route:** `/dynamic-pbr/controlled-environment`
**Status:** 📋 Planned (placeholder directory only)

---

## 8. Experiments & Model Fitting

**Status:** 📋 Planned (placeholder directories only)

---

## Common Patterns Across Pages

### All Pages Have:
1. Page header with title & description
2. Responsive layout (mobile, tablet, desktop)
3. Global footer (copyright + LinkedIn link) from `layout.tsx`

### Interactive Pages Have:
- Parameter sliders with units
- Real-time chart updates
- Model selection dropdowns
- Export functionality (CSV for simulators)
