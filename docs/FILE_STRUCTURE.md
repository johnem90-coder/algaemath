# Complete File Structure

```
algaemath/
├── app/                                    # Next.js 14 App Router
│   ├── layout.tsx                          # Root layout
│   ├── page.tsx                            # Landing page
│   │
│   ├── core-concepts/
│   │   └── page.tsx                        # Single scrollable page
│   │
│   ├── equations/
│   │   ├── page.tsx                        # Single scrollable page
│   │   └── components/
│   │       ├── LightResponseSection.tsx
│   │       └── TemperatureResponseSection.tsx
│   │
│   ├── models/
│   │   ├── page.tsx                        # Overview
│   │   ├── open-pond/page.tsx
│   │   ├── flat-panel/page.tsx
│   │   ├── pbr-tubular/page.tsx
│   │   └── design-exploration/page.tsx
│   │
│   ├── technoeconomics/
│   │   ├── page.tsx                        # Overview
│   │   ├── open-pond/page.tsx
│   │   ├── flat-panel/page.tsx
│   │   └── pbr-tubular/page.tsx
│   │
│   ├── simple-simulators/
│   │   ├── page.tsx                        # Overview
│   │   ├── open-pond/page.tsx
│   │   ├── flat-panel/page.tsx
│   │   └── pbr-tubular/page.tsx
│   │
│   ├── dynamic-pbr/
│   │   └── controlled-environment/page.tsx
│   │
│   ├── experiments/
│   │   ├── page.tsx                        # Overview
│   │   ├── light-response-fitting/page.tsx
│   │   ├── temperature-response-fitting/page.tsx
│   │   └── nutrient-uptake-fitting/page.tsx
│   │
│   └── api/                                # API routes
│       ├── climate/route.ts
│       ├── simulate/
│       │   ├── simple/route.ts
│       │   └── dynamic/route.ts
│       └── export/
│           ├── csv/route.ts
│           ├── pdf/route.ts
│           └── excel/route.ts
│
├── components/
│   ├── ui/                                 # Shadcn base components
│   ├── layout/                             # Navigation, footer
│   └── shared/                             # Reusable across pages
│
├── lib/
│   ├── models/                             # Physics calculation functions
│   │   ├── light/
│   │   ├── temperature/
│   │   ├── nutrient/
│   │   ├── pH/
│   │   └── combined/
│   │
│   ├── equations/                          # Rendering strings & metadata
│   │   ├── light.ts
│   │   └── temperature.ts
│   │
│   ├── simulation/
│   │   ├── simple-outdoor/
│   │   └── dynamic-pbr/
│   │
│   ├── technoeconomics/
│   ├── curve-fitting/
│   ├── export/
│   ├── data/
│   └── utils/
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
│   ├── MODEL_REGISTRY.md
│   ├── PAGE_REQUIREMENTS.md
│   ├── COMPONENT_LIBRARY.md
│   └── GITHUB_WORKFLOW.md
│
└── test/
    ├── models/
    ├── simulation/
    └── components/
```

## Key Directories Explained

### `app/` - Pages & Routes
Each folder = a route. `page.tsx` = the page content.

### `components/` - UI Components
- `ui/` - Base Shadcn components (button, slider, etc.)
- `layout/` - Navigation, header, footer
- `shared/` - Used across multiple pages
- Page-specific components live in `app/[page]/components/`

### `lib/models/` - Physics Models
Each category (light, temperature, etc.) has:
- `index.ts` - Registry of all models
- `types.ts` - TypeScript interfaces
- `[model-name].ts` - Individual model implementations

### `lib/equations/` - Equation Metadata
LaTeX strings, variable definitions, parameter ranges.
Used by the Equations page for rendering.

### `lib/simulation/` - Simulation Engines
- `simple-outdoor/` - Climate-based simulations
- `dynamic-pbr/` - Control system simulations

### `public/downloads/` - Static Files
Pre-generated PDFs, Excel templates, datasets that don't change.

Dynamic exports (simulation results) generated via API routes.
