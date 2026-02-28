# AlgaeMath.com - Project Overview

**Goal:** Interactive educational platform for photobioreactor modeling

**Tech Stack:** Next.js 16 + React 19 + TypeScript 5 + Tailwind CSS 4 + Three.js + Vercel
**Approach:** Build one page at a time, test thoroughly before moving on

---

## Site Structure (8 Main Pages, ~25 Total)

1. **Landing Page** - Overview with clickable page previews
2. **Core Concepts** - Single scrollable page with 10 interactive sections
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

### 3. Downloads Distribution
Each page provides its own relevant downloads:
- Informational pages: PDFs
- Simulators: CSV data + PDF reports
- Technoeconomics: Excel templates + PDFs

---

## Development Workflow

1. **Plan in browser** (Claude chat) - Architecture, component design
2. **Build in VSCode** - Implementation with Copilot
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
- Landing page
- Core Concepts page (7 interactive visualizers: light effects, temperature effects, nutrient effects, combined effects, growth rate, light absorption, light attenuation)
- Equations page (Light Response, Temperature Response, Nutrient, pH, Light Attenuation sections)
- Open Pond simulator — fully functional:
  - 3D pond renderer (Three.js) with weather-driven effects (wind, rain, clouds, day/night)
  - SVG world map with city selection and season picker
  - Weather data pipeline (Open-Meteo API + static TypeScript cache)
  - Simulation engine (`lib/simulation/simple-outdoor/`) implementing full mass balance, heat balance (8 flux components), Fresnel optics, Beer-Lambert light attenuation, and harvest logic
  - Time-series charts (biomass density, productivity, accumulated biomass)
  - "Under the Hood" accordion with interactive growth model panels (light response, temperature response, light attenuation, mass balance, water balance — each with SVG charts, KaTeX equations, and live simulation values)
  - Inline simulation controls (days slider, harvest mode, harvest parameter sliders) in each accordion trigger
  - Pause/resume simulation support
  - Pond dimensions overlay on 3D renderer
  - Live data strip (PAR, pond temp, density, growth rate, productivity, wind)
- Simulation design document (engineering equations, heat balance, optics)

**In Progress:**
- Heat / Energy Balance accordion panel (planned, not yet implemented)

**Next:**
- Flat Panel PBR and Tubular PBR simulators
- Models pages, Technoeconomics pages
- Dynamic PBR Simulator
- Experiments & Model Fitting pages
