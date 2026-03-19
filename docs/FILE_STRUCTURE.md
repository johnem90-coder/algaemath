# Complete File Structure

```
algaemathdotcom/
├── app/                                    # Next.js 16 App Router
│   ├── layout.tsx                          # Root layout (html/body/fonts only — no SiteHeader)
│   ├── globals.css                         # Global styles (Tailwind)
│   ├── favicon.ico                         # Site favicon
│   │
│   ├── (site)/                             # Route group — all public pages (URL paths unchanged)
│   │   ├── layout.tsx                      # Public layout (SiteHeader + footer + Analytics)
│   │   ├── page.tsx                        # Landing page (6 section cards, 3 active + 3 "coming soon")
│   │   │
│   ├── (site)/core-concepts/
│   │   ├── page.tsx                        # Server component (metadata + CoreConceptsAccordions)
│   │   └── components/
│   │       ├── CoreConceptsAccordions.tsx   # Client component — accordion layout for all visualizers
│   │       ├── VisibleOnly.tsx             # IntersectionObserver wrapper — unmounts children when off-screen
│   │       ├── GrowthRateVisualizer.tsx     # Cell animation + growth rate visualization
│   │       ├── LightEffectsVisualizer.tsx   # Cell animation + light response curves
│   │       ├── TemperatureEffectsVisualizer.tsx  # Cell animation + temperature response
│   │       ├── NutrientEffectsVisualizer.tsx     # Cell animation + nutrient limitation
│   │       ├── CombinedEffectsVisualizer.tsx     # Combined growth factor visualization
│   │       ├── LightAttenuationVisualizer.tsx    # Beer-Lambert depth profile (slider-driven, no RAF)
│   │       └── LightAbsorptionVisualizer.tsx     # Pigment random walk animation
│   │
│   ├── equations/
│   │   ├── page.tsx                        # Accordion page with 5 equation sections
│   │   └── components/
│   │       ├── LightResponseSection.tsx
│   │       ├── TemperatureResponseSection.tsx
│   │       ├── NutrientResponseSection.tsx
│   │       ├── pHResponseSection.tsx
│   │       └── LightAttenuationSection.tsx
│   │
│   ├── simple-simulators/
│   │   ├── page.tsx                        # Overview / index (3 simulator cards)
│   │   ├── open-pond/
│   │   │   ├── page.tsx                    # Open pond simulator page
│   │   │   └── components/
│   │   │       ├── OpenPondSimulator.tsx    # Main orchestrator (sim state, animation loop, pause/resume, data export)
│   │   │       ├── WorldMap.tsx            # SVG world map for city/season selection + weather data table
│   │   │       ├── PondCanvas.tsx          # Three.js 3D pond renderer wrapper
│   │   │       ├── SimulationCharts.tsx    # Biomass, productivity, accumulated biomass time-series SVG charts
│   │   │       ├── GrowthModelPanels.tsx   # "Under the Hood" accordion with interactive growth model panels
│   │   │       ├── DataStrip.tsx           # Live data cards (PAR, pond temp, density, growth rate, productivity, wind)
│   │   │       ├── PondControls.tsx        # Legacy controls (unused)
│   │   │       ├── WeatherPanel.tsx        # Legacy weather display (unused)
│   │   │       └── WindIndicator.tsx       # Wind direction compass
│   │   ├── flat-panel/                     # Placeholder (.gitkeep)
│   │   └── pbr-tubular/                    # Placeholder (.gitkeep)
│   │
│   ├── explorations/                       # Design Explorations page
│   │   ├── page.tsx                        # Server component (metadata + layout)
│   │   ├── components/
│   │   │   ├── DesignExplorer.tsx           # Main client component (Variable Depth + Layered Light, model selection, charts)
│   │   │   ├── DepthDiagram.tsx             # Three.js pond depth visualization (sun rays, water pulses)
│   │   │   └── LayeredDiagram.tsx           # Three.js layered pond visualization (N layers, sun rays, per-layer pulses)
│   │   ├── open-pond/                      # Placeholder (.gitkeep)
│   │   ├── flat-panel/                     # Placeholder (.gitkeep)
│   │   ├── pbr-tubular/                    # Placeholder (.gitkeep)
│   │   └── design-exploration/             # Placeholder (.gitkeep)
│   │
│   ├── technoeconomics/
│   │   ├── page.tsx                          # TEA index page (3 reactor type cards)
│   │   ├── open-pond/
│   │   │   ├── page.tsx                      # Open pond TEA page (server component)
│   │   │   └── components/
│   │   │       ├── OpenPondTEA.tsx            # Main client orchestrator (useMemo → runTEA)
│   │   │       ├── SystemSummaryCards.tsx     # 8 KPI cards (ponds, production, CAPEX, MBSP, etc.)
│   │   │       ├── InputVariablesTable.tsx    # Unit cost input parameters display
│   │   │       ├── SectionsOverviewTable.tsx  # CAPEX + OPEX breakdown by section
│   │   │       ├── CashFlowTable.tsx          # 30-year DCF schedule (expandable)
│   │   │       ├── SensitivityTable.tsx       # Revenue sensitivity at various sale prices
│   │   │       └── formatters.ts             # Number formatting (fmtDollars, fmtPercent, etc.)
│   │   ├── flat-panel/                       # Placeholder (.gitkeep)
│   │   └── pbr-tubular/                      # Placeholder (.gitkeep)
│   │
│   ├── dynamic-pbr/
│   │   └── controlled-environment/         # Placeholder (.gitkeep)
│   │
│   ├── experiments/                        # Placeholder directories (.gitkeep)
│   │   ├── light-response-fitting/
│   │   ├── temperature-response-fitting/
│   │   └── nutrient-uptake-fitting/
│   │
│   ├── admin/                              # Admin pages — no SiteHeader/footer, not in nav
│   │   ├── layout.tsx                      # Bare layout (loads /xyflow-style.css via <link>)
│   │   └── diagrams/
│   │       ├── page.tsx                    # Password gate (NEXT_PUBLIC_ADMIN_KEY, brute-force cooldown)
│   │       └── components/
│   │           ├── DiagramEditor.tsx       # React Flow canvas orchestrator
│   │           ├── Toolbar.tsx             # Top toolbar (shapes, colors, save/load/export)
│   │           └── nodes/
│   │               ├── RectangleNode.tsx
│   │               ├── RoundedRectNode.tsx
│   │               ├── DiamondNode.tsx
│   │               ├── CircleNode.tsx
│   │               ├── PillNode.tsx
│   │               └── index.ts            # nodeTypes registry + shapeDefaults
│   │
│   └── api/                                # API route placeholders (.gitkeep)
│       ├── climate/
│       ├── simulate/
│       │   ├── simple/
│       │   └── dynamic/
│       └── export/
│           ├── csv/
│           ├── pdf/
│           └── excel/
│
├── components/
│   ├── ui/                                 # Shadcn base components
│   │   ├── accordion.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── select.tsx
│   │   ├── slider.tsx
│   │   └── tabs.tsx
│   ├── layout/
│   │   └── SiteHeader.tsx                  # Site navigation header
│   ├── shared/                             # Placeholder (.gitkeep)
│   └── landing/                            # Placeholder (.gitkeep)
│
├── lib/
│   ├── models/                             # Physics calculation functions
│   │   ├── types.ts                        # Shared model interfaces
│   │   ├── light/
│   │   │   ├── index.ts                    # Light model registry
│   │   │   ├── steele.ts                   # Steele photoinhibition model
│   │   │   ├── beer-lambert.ts             # Beer-Lambert attenuation
│   │   │   ├── pigment-absorption.ts       # Pigment absorption spectra
│   │   │   └── solar-spectrum.ts           # Solar spectrum data
│   │   ├── temperature/
│   │   │   ├── index.ts                    # Temperature model registry
│   │   │   └── gaussian.ts                 # Gaussian temperature response
│   │   ├── nutrient/
│   │   │   ├── index.ts                    # Nutrient model registry
│   │   │   └── monod.ts                    # Modified Monod uptake
│   │   ├── pH/                             # Placeholder (.gitkeep)
│   │   └── combined/
│   │       ├── index.ts
│   │       └── multiplicative.ts           # Multiplicative growth model
│   │
│   ├── equations/                          # Rendering strings & metadata
│   │   ├── light.ts
│   │   ├── temperature.ts
│   │   ├── nutrient.ts
│   │   ├── pH.ts
│   │   ├── attenuation.ts
│   │   ├── latex/                          # Placeholder (.gitkeep)
│   │   └── metadata/                       # Placeholder (.gitkeep)
│   │
│   ├── simulation/                         # Simulation engines & renderers
│   │   ├── weather-types.ts                # HourlyWeather, SeasonWeather, RawDayData interfaces
│   │   ├── weather-api.ts                  # Open-Meteo API client + solar position
│   │   ├── weather-data.ts                 # Legacy static weather cache (superseded by JSON files)
│   │   ├── pond-renderer.ts                # Three.js open pond 3D renderer
│   │   ├── pond-types.ts                   # PondAPI interface
│   │   ├── cell-animation.ts               # Algae cell particle animation
│   │   ├── shared-timer.ts                 # Shared animation timer + interaction-priority yield mechanism
│   │   ├── world-map-path.ts               # Simplified world SVG path data
│   │   ├── simple-outdoor/                 # Open pond simulation engine
│   │   │   ├── types.ts                    # OpenPondTimestep, OpenPondConfig interfaces
│   │   │   ├── constants.ts                # Physical constants (σ, ρ, Cp, etc.)
│   │   │   ├── geometry.ts                 # Racetrack pond geometry calculator
│   │   │   ├── optics.ts                   # Fresnel reflection, Beer-Lambert, PAR conversion
│   │   │   ├── heat-balance.ts             # All 8 heat flux components + temperature ODE
│   │   │   ├── open-pond-engine.ts         # Main simulation loop (runSimulation)
│   │   │   └── index.ts                    # Re-exports
│   │   └── dynamic-pbr/                    # Placeholder (.gitkeep)
│   │
│   ├── technoeconomics/                    # TEA calculation engines
│   │   ├── types.ts                        # Shared interfaces (TEAConfig, TEAResult, SectionCost, etc.)
│   │   ├── common/
│   │   │   ├── constants.ts                # Physical constants, MACRS schedule, molecular weights
│   │   │   ├── geometry.ts                 # Racetrack pond geometry & system sizing
│   │   │   ├── nutrient-balance.ts         # Stoichiometric CO₂, nutrient, water demand
│   │   │   ├── cost-escalation.ts          # Cost correlations (tank, pond, dryer, paddlewheel)
│   │   │   ├── installation.ts             # Three-tier installation cost cascade
│   │   │   ├── energy.ts                   # Electricity, diesel, natural gas cost functions
│   │   │   └── equipment-options.ts        # Shared catalogs (pumps, tanks, filters, hoppers) & sizing functions
│   │   └── open-pond/
│   │       ├── index.ts                    # Re-exports
│   │       ├── config.ts                   # Default config from JSON → typed TEAConfig
│   │       ├── engine.ts                   # Main entry: runTEA(config) → TEAResult
│   │       ├── outputs.ts                  # Cost rollup, resource aggregation
│   │       ├── sections/
│   │       │   ├── inputs.ts               # Water treatment & delivery (10 equipment items)
│   │       │   ├── inoculum.ts             # Scaling ponds (3 tiers, count from timeline)
│   │       │   ├── biomass.ts              # Growth ponds (NREL cost correlation)
│   │       │   ├── harvesting.ts           # Dewatering (6 equipment items)
│   │       │   └── drying.ts               # Spray drying (3 equipment items)
│   │       └── data/                       # Reference data (JSON, compiled into client bundle)
│   │           ├── default-config.json     # All input parameters with defaults and ranges
│   │           ├── equipment-catalog.json  # Equipment specs, costs, energy, provenance
│   │           ├── cost-correlations.json  # Parametric cost formulas
│   │           ├── installation-factors.json # Three-tier installation cost factors per section
│   │           ├── labor-roles.json        # Per-section staffing and salaries
│   │           ├── land-prices.json        # US state land pricing reference
│   │           ├── nrel-pond-reference.json # NREL 2011 pond cost and energy data
│   │           └── nutrient-chemistry.json # Stoichiometric data for nutrient demand
│   ├── curve-fitting/                      # Placeholder (.gitkeep)
│   ├── export/                             # Placeholder (.gitkeep)
│   ├── data/                               # Placeholder (.gitkeep)
│   ├── utils/                              # Placeholder (.gitkeep)
│   └── utils.ts                            # Shared utility functions (cn helper)
│
├── scripts/
│   └── generate-weather-data.mjs           # Generates static weather JSON from Open-Meteo
│
├── public/
│   ├── robots.txt                          # Disallows /admin/ from search crawlers
│   ├── xyflow-style.css                    # React Flow CSS (static asset — avoids Turbopack bug)
│   ├── diagrams/                           # Saved diagram JSON files (manually placed after download)
│   ├── weather/                            # Pre-cached weather data (29 cities × 4 seasons)
│   │   ├── gainesville.json
│   │   ├── dallas.json
│   │   ├── san-diego.json
│   │   ├── honolulu.json
│   │   ├── sydney.json
│   │   ├── perth.json
│   │   ├── alice-springs.json
│   │   ├── delhi.json
│   │   ├── pune.json
│   │   ├── bangalore.json
│   │   ├── lima.json
│   │   ├── santiago.json
│   │   ├── natal.json
│   │   ├── mexico-city.json
│   │   ├── ho-chi-minh-city.json
│   │   ├── muscat.json
│   │   ├── jeddah.json
│   │   ├── cairo.json
│   │   ├── tripoli.json
│   │   ├── casablanca.json
│   │   ├── madrid.json
│   │   ├── rome.json
│   │   ├── paris.json
│   │   ├── berlin.json
│   │   ├── dakar.json
│   │   ├── lagos.json
│   │   ├── mombasa.json
│   │   ├── cape-town.json
│   │   └── johannesburg.json
│   ├── images/                             # Placeholder (.gitkeep)
│   └── downloads/                          # Static downloadable files
│       ├── pdfs/                            # Placeholder (.gitkeep)
│       ├── templates/                       # Placeholder (.gitkeep)
│       └── datasets/                        # Placeholder (.gitkeep)
│
├── docs/                                   # Project documentation
│   ├── PROJECT_OVERVIEW.md
│   ├── FILE_STRUCTURE.md
│   ├── SIMULATION_DESIGN.md
│   ├── MODEL_REGISTRY.md
│   ├── PAGE_REQUIREMENTS.md
│   ├── COMPONENT_LIBRARY.md
│   ├── API_DESIGN.md
│   ├── QUICK_START.md
│   └── GITHUB_WORKFLOW.md
│
└── test/                                   # Placeholder directories (.gitkeep)
    ├── models/
    ├── simulation/
    └── components/
```

## Key Directories Explained

### `app/` - Pages & Routes
Each folder = a route. `page.tsx` = the page content. Page-specific components live in `app/[page]/components/`.

### `components/` - UI Components
- `ui/` - Base Shadcn components (button, slider, accordion, etc.)
- `layout/` - Site header with navigation
- `shared/` - Used across multiple pages (placeholder)
- `landing/` - Landing page components (placeholder)

### `lib/models/` - Physics Models
Each category (light, temperature, etc.) has:
- `index.ts` - Registry of all models
- `types.ts` - TypeScript interfaces (shared at `lib/models/types.ts`)
- `[model-name].ts` - Individual model implementations

Currently implemented: Steele (light), Gaussian (temperature), Monod (nutrient), Multiplicative (combined).

### `lib/equations/` - Equation Metadata
LaTeX strings, variable definitions, parameter ranges. Used by the Equations page for rendering.

### `lib/simulation/` - Simulation Engines & Renderers
- Weather pipeline: `weather-types.ts` → `weather-api.ts` → JSON files in `public/weather/`
- 3D rendering: `pond-renderer.ts`, `cell-animation.ts`, `pond-types.ts`
- Animation: `shared-timer.ts` (global timer + interaction-priority yield)
- Map data: `world-map-path.ts`
- `simple-outdoor/` - Open pond simulation engine implementing equations from SIMULATION_DESIGN.md:
  - `types.ts` defines `OpenPondTimestep` (per-timestep output) and `OpenPondConfig` (user-adjustable parameters)
  - `constants.ts` has all physical constants (Stefan-Boltzmann, water properties, etc.)
  - `geometry.ts` computes racetrack pond dimensions from area, aspect ratio, and depth
  - `optics.ts` handles Fresnel reflection, Snell's law refraction, Beer-Lambert attenuation, and PAR conversion
  - `heat-balance.ts` computes all 8 heat flux components (solar, longwave in/out, evaporative, convective, conductive, biomass, net)
  - `open-pond-engine.ts` runs the full hourly-timestep simulation loop with mass balance, heat balance, and harvest logic
- `dynamic-pbr/` - Future dynamic PBR simulation

### `public/weather/` - Weather Data
Pre-cached weather JSON for 29 cities across 6 continents. Each file contains 4 seasons (spring, summer, autumn, winter) with 14 days of hourly weather data per season. Generated by `scripts/generate-weather-data.mjs` from the Open-Meteo Historical Weather API. Lazy-loaded at runtime when a city is selected.

### `scripts/` - Data Generation
`generate-weather-data.mjs` fetches historical weather from Open-Meteo API and writes static JSON files to `public/weather/`.

### `public/downloads/` - Static Files
Pre-generated PDFs, Excel templates, datasets that don't change. Dynamic exports (simulation results) are generated client-side as CSV.
