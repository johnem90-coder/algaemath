# Complete File Structure

```
algaemathdotcom/
├── app/                                    # Next.js 16 App Router
│   ├── layout.tsx                          # Root layout
│   ├── page.tsx                            # Landing page
│   ├── globals.css                         # Global styles (Tailwind)
│   │
│   ├── core-concepts/
│   │   ├── page.tsx                        # Single scrollable page
│   │   └── components/
│   │       ├── CombinedEffectsVisualizer.tsx
│   │       ├── GrowthRateVisualizer.tsx
│   │       ├── LightAbsorptionVisualizer.tsx
│   │       ├── LightAttenuationVisualizer.tsx
│   │       ├── LightEffectsVisualizer.tsx
│   │       ├── NutrientEffectsVisualizer.tsx
│   │       └── TemperatureEffectsVisualizer.tsx
│   │
│   ├── equations/
│   │   ├── page.tsx                        # Single scrollable page
│   │   └── components/
│   │       ├── LightResponseSection.tsx
│   │       ├── TemperatureResponseSection.tsx
│   │       ├── NutrientResponseSection.tsx
│   │       ├── pHResponseSection.tsx
│   │       └── LightAttenuationSection.tsx
│   │
│   ├── simple-simulators/
│   │   ├── page.tsx                        # Overview / index
│   │   ├── open-pond/
│   │   │   ├── page.tsx                    # Open pond simulator page
│   │   │   └── components/
│   │   │       ├── OpenPondSimulator.tsx    # Main orchestrator (sim state, animation loop, pause/resume)
│   │   │       ├── WorldMap.tsx            # SVG world map for city/season selection
│   │   │       ├── PondCanvas.tsx          # Three.js 3D pond renderer wrapper
│   │   │       ├── SimulationCharts.tsx    # Biomass, productivity, accumulated biomass time-series charts
│   │   │       ├── GrowthModelPanels.tsx   # "Under the Hood" accordion with interactive growth model panels
│   │   │       ├── DataStrip.tsx           # Live data cards (PAR, pond temp, density, growth rate, productivity, wind)
│   │   │       ├── PondControls.tsx        # Legacy controls (may be removed)
│   │   │       ├── WeatherPanel.tsx        # Legacy weather display (may be removed)
│   │   │       └── WindIndicator.tsx       # Wind direction compass
│   │   ├── flat-panel/                     # Placeholder
│   │   └── pbr-tubular/                    # Placeholder
│   │
│   ├── models/
│   │   ├── open-pond/                      # Placeholder
│   │   ├── flat-panel/                     # Placeholder
│   │   ├── pbr-tubular/                    # Placeholder
│   │   └── design-exploration/             # Placeholder
│   │
│   ├── technoeconomics/
│   │   ├── open-pond/                      # Placeholder
│   │   ├── flat-panel/                     # Placeholder
│   │   └── pbr-tubular/                    # Placeholder
│   │
│   ├── dynamic-pbr/
│   │   └── controlled-environment/         # Placeholder
│   │
│   ├── experiments/
│   │   ├── light-response-fitting/         # Placeholder
│   │   ├── temperature-response-fitting/   # Placeholder
│   │   └── nutrient-uptake-fitting/        # Placeholder
│   │
│   └── api/                                # API routes (placeholder)
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
│   ├── layout/                             # Navigation, header
│   │   └── SiteHeader.tsx
│   ├── shared/                             # Reusable across pages
│   └── landing/                            # Landing page components
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
│   │   ├── pH/                             # pH models (placeholder)
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
│   │   ├── latex/                          # LaTeX string storage
│   │   └── metadata/                       # Equation metadata
│   │
│   ├── simulation/                         # Simulation engines & renderers
│   │   ├── weather-types.ts                # HourlyWeather, SeasonWeather interfaces
│   │   ├── weather-api.ts                  # Open-Meteo API client + solar position
│   │   ├── weather-data.ts                 # Static weather cache (generated)
│   │   ├── pond-renderer.ts                # Three.js open pond 3D renderer
│   │   ├── pond-types.ts                   # PondAPI interface
│   │   ├── cell-animation.ts               # Algae cell particle animation
│   │   ├── shared-timer.ts                 # Shared animation timer
│   │   ├── world-map-path.ts               # Simplified world SVG path data
│   │   ├── simple-outdoor/                 # Open pond simulation engine
│   │   │   ├── types.ts                    # OpenPondTimestep, OpenPondConfig interfaces
│   │   │   ├── constants.ts                # Physical constants (σ, ρ, Cp, etc.)
│   │   │   ├── geometry.ts                 # Racetrack pond geometry calculator
│   │   │   ├── optics.ts                   # Fresnel reflection, Beer-Lambert, PAR conversion
│   │   │   ├── heat-balance.ts             # All 8 heat flux components + temperature ODE
│   │   │   ├── open-pond-engine.ts         # Main simulation loop (runSimulation)
│   │   │   └── index.ts                    # Re-exports
│   │   └── dynamic-pbr/                    # Placeholder for dynamic PBR
│   │
│   ├── technoeconomics/                    # Placeholder
│   ├── curve-fitting/                      # Placeholder
│   ├── export/                             # Placeholder
│   ├── data/                               # Placeholder
│   ├── utils/                              # Placeholder
│   └── utils.ts                            # Shared utility functions
│
├── scripts/
│   └── generate-weather-data.mjs           # Generates static weather cache from Open-Meteo
│
├── public/
│   ├── images/
│   └── downloads/                          # Static downloadable files
│       ├── pdfs/
│       ├── templates/
│       └── datasets/
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
└── test/
    ├── models/
    ├── simulation/
    └── components/
```

## Key Directories Explained

### `app/` - Pages & Routes
Each folder = a route. `page.tsx` = the page content. Page-specific components live in `app/[page]/components/`.

### `components/` - UI Components
- `ui/` - Base Shadcn components (button, slider, etc.)
- `layout/` - Site header, navigation
- `shared/` - Used across multiple pages
- `landing/` - Landing page components

### `lib/models/` - Physics Models
Each category (light, temperature, etc.) has:
- `index.ts` - Registry of all models
- `types.ts` - TypeScript interfaces (shared at `lib/models/types.ts`)
- `[model-name].ts` - Individual model implementations

Currently implemented: Steele (light), Gaussian (temperature), Monod (nutrient), Multiplicative (combined).

### `lib/equations/` - Equation Metadata
LaTeX strings, variable definitions, parameter ranges. Used by the Equations page for rendering.

### `lib/simulation/` - Simulation Engines & Renderers
- Weather pipeline: `weather-types.ts` → `weather-api.ts` → `weather-data.ts`
- 3D rendering: `pond-renderer.ts`, `cell-animation.ts`, `pond-types.ts`
- Animation: `shared-timer.ts`
- Map data: `world-map-path.ts`
- `simple-outdoor/` - Open pond simulation engine implementing equations from SIMULATION_DESIGN.md:
  - `types.ts` defines `OpenPondTimestep` (per-timestep output) and `OpenPondConfig` (user-adjustable parameters)
  - `constants.ts` has all physical constants (Stefan-Boltzmann, water properties, etc.)
  - `geometry.ts` computes racetrack pond dimensions from area, aspect ratio, and depth
  - `optics.ts` handles Fresnel reflection, Snell's law refraction, Beer-Lambert attenuation, and PAR conversion
  - `heat-balance.ts` computes all 8 heat flux components (solar, longwave in/out, evaporative, convective, conductive, biomass, net)
  - `open-pond-engine.ts` runs the full hourly-timestep simulation loop with mass balance, heat balance, and harvest logic
- `dynamic-pbr/` - Future dynamic PBR simulation

### `scripts/` - Data Generation
`generate-weather-data.mjs` fetches historical weather from Open-Meteo API and writes static TypeScript cache to `lib/simulation/weather-data.ts`.

### `public/downloads/` - Static Files
Pre-generated PDFs, Excel templates, datasets that don't change. Dynamic exports (simulation results) will be generated client-side or via API routes.
