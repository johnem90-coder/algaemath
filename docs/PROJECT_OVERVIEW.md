# AlgaeMath.com - Project Overview

**Goal:** Interactive educational platform for photobioreactor modeling

**Tech Stack:** Next.js 16 + React 19 + TypeScript 5 + Tailwind CSS 4 + Three.js + Vercel
**Approach:** Build one page at a time, test thoroughly before moving on

---

## Site Structure (8 Main Pages, ~25 Total)

1. **Landing Page** - Overview with clickable page previews
2. **Core Concepts** - Single scrollable page with 7 interactive sections (accordion-based)
3. **Equations** - Single scrollable page comparing all equation variants
4. **Models** (4 sub-pages)
   - Open Pond
   - Flat Panel PBR
   - Tubular PBR
   - Design Exploration
5. **Technoeconomics** (3 sub-pages)
   - Open Pond
   - Flat Panel PBR
   - Tubular PBR
6. **Simple Outdoor Simulators** (3 sub-pages)
   - Open Pond (1-2 week climate-based)
   - Flat Panel PBR
   - Tubular PBR
7. **Dynamic PBR Simulator** - Advanced control system simulation
8. **Experiments & Model Fitting** (3 sub-pages)
   - Light Response Fitting
   - Temperature Response Fitting
   - Nutrient Uptake Fitting

---

## Core Architecture Principles

### 1. Model Registry Pattern
All physics models (light, temperature, nutrient, pH) stored as:
- Calculation function
- Metadata (equation, references, parameters)
- LaTeX rendering strings

**Location:** `lib/models/[category]/`

### 2. Separation of Concerns
- **`lib/models/`** - Pure calculation functions
- **`lib/equations/`** - Rendering strings (LaTeX, metadata)
- **`lib/simulation/`** - Simulation engines, weather data, 3D renderers
- **`components/`** - UI components
- **`app/`** - Pages and routes
- **`scripts/`** - Data generation scripts (weather cache, etc.)
- **`public/weather/`** - Pre-cached weather JSON data (29 cities × 4 seasons)

### 3. Weather Data Pipeline
Weather data is fetched from Open-Meteo Historical Weather API via `scripts/generate-weather-data.mjs` and stored as static JSON files in `public/weather/[city-slug].json`. Each file contains all 4 seasons of hourly weather data. Files are lazy-loaded at runtime when a city is selected.

### 4. Downloads / Data Export
- Simulation data export is built client-side (CSV download + interactive data table overlay)
- Future: PDFs, Excel templates for other pages

### 5. Performance Patterns
- **VisibleOnly wrapper:** IntersectionObserver-based component that unmounts children when off-screen (used for core concepts visualizers)
- **Interaction-priority yielding:** All RAF animation loops check `shouldYieldToInteraction()` from `shared-timer.ts` — pauses animations for 200ms on any click/tap to free the main thread for event processing
- **Lazy weather loading:** City weather data loaded on-demand from static JSON, cached in memory

---

## Development Workflow

1. **Plan in browser** (Claude chat) - Architecture, component design
2. **Build in VSCode** - Implementation with Claude Code
3. **Test locally** - `npm run dev`, verify functionality
4. **Commit when complete** - Git workflow
5. **Move to next page** - Repeat

---

## Key Files to Reference

- `docs/FILE_STRUCTURE.md` - Complete directory structure
- `docs/MODEL_REGISTRY.md` - How to add/use physics models
- `docs/SIMULATION_DESIGN.md` - Engineering equations and process models for simulators
- `docs/PAGE_REQUIREMENTS.md` - Specifications for each page
- `docs/COMPONENT_LIBRARY.md` - Reusable component patterns
- `docs/API_DESIGN.md` - Backend API endpoint design
- `docs/GITHUB_WORKFLOW.md` - Git and GitHub practices

---

## Current Status

**Phase:** Building Simulators
**Completed:**
- Project setup, deployment to Vercel (with Vercel Analytics)
- Landing page with 6 section cards (3 active, 3 "coming soon" at opacity-30)
- Core Concepts page (7 interactive visualizers in accordion layout: growth rate, light effects, temperature effects, nutrient effects, combined effects, light attenuation, light absorption)
  - Uses `CoreConceptsAccordions` client component with `VisibleOnly` wrappers for performance
  - Interaction-priority yield mechanism prevents RAF loops from blocking UI
- Equations page (5 sections: Light Response, Temperature Response, Nutrient, pH, Light Attenuation — each with LaTeX equations and interactive curves)
- Simple Simulators index page with 3 cards (1 active, 2 "coming soon" at opacity-30)
- Open Pond simulator — fully functional:
  - 3D pond renderer (Three.js) with weather-driven effects (wind, rain, clouds, day/night)
  - SVG world map with city selection (29 cities across 6 continents) and season picker
  - Weather data pipeline: Open-Meteo API → static JSON files in `public/weather/` → lazy-loaded at runtime
  - Simulation engine (`lib/simulation/simple-outdoor/`) implementing full mass balance, heat balance (8 flux components), Fresnel optics, Beer-Lambert light attenuation, and harvest logic
  - Time-series charts (biomass density, productivity, accumulated biomass)
  - Weather gauges overlay (rain, cloud, wind + compass) on 3D renderer
  - Pond dimensions overlay on 3D renderer
  - "Under the Hood" accordion with interactive growth model panels (light response, temperature response, light attenuation, mass balance, water balance — each with SVG charts, KaTeX equations, and live simulation values)
  - Inline simulation controls (days slider, harvest mode, harvest parameter sliders) in each accordion trigger
  - Pause/resume/stop simulation support
  - **Simulation data export:** "Simulation Data" button appears after sim completes — toggles scrollable data table overlay with sticky columns, plus CSV download with metadata header and all 40+ columns
- Simulation design document (engineering equations, heat balance, optics)
- Global footer with copyright line (left) and LinkedIn link (right, LinkedIn blue with grey hover)
- Site header with navigation

**Next:**
- Heat / Energy Balance accordion panel (planned for open pond simulator)
- Flat Panel PBR and Tubular PBR simulators
- Models pages, Technoeconomics pages
- Dynamic PBR Simulator
- Experiments & Model Fitting pages
