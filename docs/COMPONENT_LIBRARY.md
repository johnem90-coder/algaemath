# Component Library

Reusable component patterns for consistent UX across the site.

**Note:** Many components described below are aspirational patterns for future development. Currently implemented page-specific components include the open pond simulator suite (`OpenPondSimulator`, `WorldMap`, `PondCanvas`, `SimulationCharts`, `GrowthModelPanels`), the equations section components, and the core-concepts visualizers. Charts are rendered as SVG (not Recharts) for the simulator. The patterns below serve as a design guide for building new shared components.

---

## Implemented Components

### Layout Components

#### SiteHeader (`components/layout/SiteHeader.tsx`)
Site-wide navigation header. Rendered in root `layout.tsx`.

#### Global Footer (in `app/layout.tsx`)
Site-wide footer with:
- Copyright line on the left: `© {year} AlgaeMath — Open-source algae cultivation tools`
- LinkedIn link on the right (LinkedIn blue `#0A66C2`, grey on hover)
- `border-t py-6` styling, `max-w-[90rem]` container

### Core Concepts Components (`app/core-concepts/components/`)

#### CoreConceptsAccordions
Client component that manages two accordion groups ("Core Growth Concepts" and "Specific Light Concepts"). Each section maps to a visualizer component via `visualizerMap`. Uses uncontrolled `type="multiple"` accordions — no open-panel limit.

#### VisibleOnly
IntersectionObserver wrapper that unmounts children when off-screen. Prevents RAF loops from running for non-visible visualizers. Returns a placeholder `<div>` with a `ref` when not visible.

#### Visualizers (7 total)
All follow a similar pattern:
- Use `requestAnimationFrame` for animation (except `LightAttenuationVisualizer` which is slider-driven)
- Import `shouldYieldToInteraction()` from `shared-timer.ts` for interaction-priority yielding
- Use `getGlobalStart()` for synchronized animation timing
- Render cell animations + parameter curves via SVG/canvas

### Open Pond Simulator Components (`app/simple-simulators/open-pond/components/`)

#### OpenPondSimulator
Main orchestrator component. Manages:
- Simulation state (running, paused, complete)
- Animation loop via `requestAnimationFrame` with interpolation
- Weather data loading and caching
- Simulation config state (growth model parameters, harvest settings)
- Data export (CSV download + data table overlay)
- Weather gauge overlays (rain, cloud, wind + compass)
- Pond dimensions overlay

#### WorldMap
SVG world map with:
- 29 city markers (clickable)
- Season selection dropdown
- Weather data table overlay (toggled, shows hourly weather for selected city/season)
- Loading state indicator

#### PondCanvas
Three.js 3D pond renderer wrapper. Accepts API handle via `onPondReady` callback. API methods: `setDensity`, `setTime`, `setWind`, `setClouds`, `setRain`.

#### SimulationCharts
SVG time-series charts for simulation results:
- Biomass density vs time
- Productivity (areal) vs time
- Accumulated biomass vs time
- Includes harvest config sliders (harvest mode, thresholds) and days slider
- Vertical playback cursor shows current simulation position

#### GrowthModelPanels
"Under the Hood" accordion with 5 interactive panels:
- Light Response — model curves, live position marker, µ_max/I_opt/alpha sliders
- Temperature Response — model curves, live marker, T_opt slider
- Light Attenuation — depth profile + Fresnel transmission chart
- Mass Balance — growth/harvest/net tracking
- Water Balance — cumulative evaporation, makeup, harvest water

Each panel shows live simulation values and KaTeX equations.

### Design Explorations Components (`app/explorations/components/`)

#### DesignExplorer
Main client component for the Explorations page. Contains:
- **Variable Depth section** — vertical depth slider (50–500mm), DepthDiagram, biomass density + total biomass charts with envelope bands, Under the Hood (light response, temperature response, productivity)
- **Layered Light Distribution section** — vertical layer slider (1–10), LayeredDiagram, same chart structure
- **Model selection** — pill-button selectors in Under the Hood for light model (Steele/Monod/Haldane/Webb) and temperature model (Gaussian/Asym. Gaussian/Quad. Exp./Beta Function). Shared state between both sections. Changing model re-runs the full simulation via `lightFactorFn`/`tempFactorFn` on config.
- Pre-computed envelope bands via `useMemo` sweeping all parameter values
- Dynamic y-axis scaling via `niceAxis()` with intuitive step sizes (5–10 ticks)
- Minimal dot+text hover tooltips (no box/cursor)

#### DepthDiagram
Three.js 3D pond visualization accepting `depthMm` prop. Features:
- Stadium-shaped (racetrack) pond with gold→green gradient
- Emissive sun sphere with animated golden rays (jittered grid, randomized speed/phase/opacity)
- Water pulse rings descending through pond depth
- Transparent background, responsive resize
- Bottom-left SVG overlay (pond dimensions), top-right volume display

#### LayeredDiagram
Three.js 3D layered pond visualization accepting `layers` prop (1–10). Features:
- N stadium-shaped water layers stacked vertically with gaps between
- Layer color transitions from gold to pale gold as layer count increases
- Top faces dark (algae green), side walls show gradient (matching DepthDiagram style)
- Sun rays land on topmost layer surface, rebuilt when layer count changes
- Per-layer water pulse rings with staggered timing
- Same overlay structure as DepthDiagram (dimensions + volume)

---

## Shared UI Components (`components/ui/`)

Shadcn/ui components:
- `accordion.tsx` — Radix UI Accordion
- `button.tsx` — Button variants
- `card.tsx` — Card container
- `select.tsx` — Select dropdown
- `slider.tsx` — Range slider
- `tabs.tsx` — Tab navigation

---

## Performance Patterns

### Interaction-Priority Yielding (`lib/simulation/shared-timer.ts`)
Global `pointerdown` listener sets a 200ms yield window. All RAF animation loops check `shouldYieldToInteraction()` at the top of each frame and skip work when yielding, freeing the main thread to process click events.

```typescript
import { shouldYieldToInteraction } from '@/lib/simulation/shared-timer';

const animate = (timestamp: number) => {
  if (shouldYieldToInteraction()) {
    animRef.current = requestAnimationFrame(animate);
    return;  // Skip this frame
  }
  // ... animation logic
};
```

### VisibleOnly Wrapper
Used in Core Concepts to prevent off-screen visualizers from running RAF loops:

```tsx
<VisibleOnly>
  <HeavyVisualizerComponent />
</VisibleOnly>
```

---

## Aspirational Component Patterns

The following are design patterns for future development. See the original component designs for details on: `EquationDisplay`, `InteractiveChart`, `ModelSelector`, `ParameterSlider`, `DataExport`, `AnimatedDiagram`, `LoadingSimulation`, `ResultsCard`.

---

## Styling Conventions

### CSS Variables (via Tailwind CSS 4)
- Uses `hsl(var(--accent-science))` for the green accent color
- Uses `hsl(var(--accent-science-muted))` for muted accent backgrounds
- `text-muted-foreground` for secondary text
- `text-foreground` for primary text

### Layout
- Page content max-width: `max-w-[90rem]` for wide pages, `max-w-7xl` for standard, `max-w-5xl` for narrow
- Standard page padding: `px-6`
- Page header: `py-12 md:py-16`

### Typography
- Page titles: `text-3xl font-medium tracking-tight md:text-4xl`
- Section headings: `text-xl font-medium tracking-tight`
- Badges: `text-xs font-medium tracking-wide` in rounded-full pill
- Data/monospace: `font-mono text-[9px]` for tables, `text-[10px]` for labels
- Coming soon cards: `opacity-30 cursor-default`
