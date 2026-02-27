# Component Library

Reusable component patterns for consistent UX across the site.

**Note:** Many components described below are aspirational patterns for future development. Currently implemented page-specific components include the open pond simulator suite (`OpenPondSimulator`, `WorldMap`, `PondCanvas`, `PondControls`, `DataStrip`, `WeatherPanel`, `WindIndicator`) and the equations/core-concepts section components. The patterns below serve as a design guide for building new shared components.

---

## Shared Components (`components/shared/`)

### EquationDisplay
**Purpose:** Render LaTeX equations with KaTeX

**Props:**
```typescript
interface EquationDisplayProps {
  latex: string
  displayMode?: boolean      // Block vs inline
  variables?: Record<string, {
    name: string
    units: string
    description: string
  }>
  showDerivation?: boolean
  showReferences?: boolean
}
```

**Usage:**
```tsx
<EquationDisplay
  latex="\mu_L = \frac{I}{K_I + I + \frac{I^2}{K_{inh}}}"
  variables={banerjeeEquations.variables}
  showDerivation={true}
/>
```

---

### InteractiveChart
**Purpose:** Base chart component with Recharts

**Props:**
```typescript
interface InteractiveChartProps {
  data: Array<{x: number, y: number, [key: string]: any}>
  xLabel: string
  yLabel: string
  title?: string
  xUnit?: string
  yUnit?: string
  lines?: Array<{
    dataKey: string
    color: string
    name: string
  }>
  showGrid?: boolean
  showLegend?: boolean
  onHover?: (data: any) => void
}
```

**Usage:**
```tsx
<InteractiveChart
  data={simulationData}
  xLabel="Time"
  yLabel="Biomass Density"
  xUnit="days"
  yUnit="g/L"
  lines={[
    {dataKey: 'density', color: '#3b82f6', name: 'Density'}
  ]}
/>
```

---

### ModelSelector
**Purpose:** Dropdown to select physics models

**Props:**
```typescript
interface ModelSelectorProps {
  category: 'light' | 'temperature' | 'nutrient' | 'pH'
  value: string
  onChange: (modelId: string) => void
  showDescription?: boolean
}
```

**Usage:**
```tsx
<ModelSelector
  category="light"
  value={selectedLightModel}
  onChange={setSelectedLightModel}
  showDescription={true}
/>
```

**Behavior:**
- Fetches models from registry
- Shows model name + description
- Highlights currently selected

---

### ParameterSlider
**Purpose:** Labeled slider with units and live value

**Props:**
```typescript
interface ParameterSliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  description?: string
}
```

**Usage:**
```tsx
<ParameterSlider
  label="Light Intensity"
  value={intensity}
  onChange={setIntensity}
  min={0}
  max={2000}
  step={10}
  unit="umol/m2/s"
  description="PAR at culture surface"
/>
```

**Renders:**
```
Light Intensity: 850 umol/m2/s
[=========|==================]
PAR at culture surface
```

---

### DataExport
**Purpose:** Export button with format options

**Props:**
```typescript
interface DataExportProps {
  data: any[]
  filename: string
  formats: Array<'csv' | 'json' | 'pdf' | 'excel'>
  onExport?: (format: string) => void
}
```

**Usage:**
```tsx
<DataExport
  data={simulationResults}
  filename="simulation_results"
  formats={['csv', 'pdf']}
/>
```

**Behavior:**
- Dropdown to select format
- Triggers download
- Calls API endpoint for PDF/Excel

---

### AnimatedDiagram
**Purpose:** SVG diagram with animations

**Props:**
```typescript
interface AnimatedDiagramProps {
  svg: string | React.ReactNode
  animations?: Array<{
    element: string        // CSS selector
    property: string       // 'opacity', 'transform', etc.
    keyframes: any[]
    duration: number
  }>
  controls?: boolean       // Show play/pause
}
```

**Usage:**
```tsx
<AnimatedDiagram
  svg={<PondSVG />}
  animations={[
    {
      element: '.paddlewheel',
      property: 'transform',
      keyframes: [{rotate: '0deg'}, {rotate: '360deg'}],
      duration: 2000
    }
  ]}
  controls={true}
/>
```

---

### LoadingSimulation
**Purpose:** Loading state for simulations

**Props:**
```typescript
interface LoadingSimulationProps {
  progress?: number        // 0-100
  message?: string
}
```

**Usage:**
```tsx
<LoadingSimulation
  progress={simulationProgress}
  message="Running simulation... Day 5 of 14"
/>
```

---

### ResultsCard
**Purpose:** Display key metric

**Props:**
```typescript
interface ResultsCardProps {
  title: string
  value: number | string
  unit?: string
  change?: number          // % change
  trend?: 'up' | 'down' | 'neutral'
  description?: string
}
```

**Usage:**
```tsx
<ResultsCard
  title="Average Productivity"
  value={8.5}
  unit="g/m2/day"
  change={+12.5}
  trend="up"
  description="Compared to previous simulation"
/>
```

---

## Page-Specific Component Patterns

### Core Concepts Components

All follow this pattern:
```tsx
interface ConceptExplorerProps {
  defaultParams?: Record<string, number>
  interactive?: boolean
}

export function LightResponseExplorer({
  defaultParams,
  interactive = true
}: ConceptExplorerProps) {
  // State for parameters
  const [intensity, setIntensity] = useState(500)
  const [model, setModel] = useState('banerjee')

  // Calculate results
  const mu = lightModels[model].calculate(intensity, params)

  return (
    <div className="concept-explorer">
      <h3>Light Response</h3>
      <p>Explanation text...</p>

      {interactive && (
        <>
          <ModelSelector
            category="light"
            value={model}
            onChange={setModel}
          />
          <ParameterSlider
            label="Intensity"
            value={intensity}
            onChange={setIntensity}
            min={0}
            max={2000}
            unit="umol/m2/s"
          />
        </>
      )}

      <InteractiveChart
        data={generateCurve(model, params)}
        xLabel="Light Intensity"
        yLabel="Growth Factor"
      />

      <CurrentPosition
        value={intensity}
        result={mu}
      />
    </div>
  )
}
```

---

### Simulator Components

Pattern for all simulator pages:

```tsx
export function SimulatorPage() {
  // Inputs
  const [location, setLocation] = useState('')
  const [dateRange, setDateRange] = useState<[Date, Date]>()
  const [initialConditions, setInitialConditions] = useState({})

  // Simulation state
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<SimulationResult[]>([])
  const [progress, setProgress] = useState(0)

  // Run simulation
  const handleRun = async () => {
    setIsRunning(true)
    const stream = await runSimulation({
      location,
      dateRange,
      initialConditions
    })

    for await (const chunk of stream) {
      setResults(prev => [...prev, chunk])
      setProgress(chunk.progress)
    }

    setIsRunning(false)
  }

  return (
    <div className="simulator-page">
      <SimulationControls
        onRun={handleRun}
        isRunning={isRunning}
        onReset={() => setResults([])}
      />

      <div className="inputs">
        <LocationInput value={location} onChange={setLocation} />
        <DateRangeInput value={dateRange} onChange={setDateRange} />
        <InitialConditions
          value={initialConditions}
          onChange={setInitialConditions}
        />
      </div>

      {isRunning && <LoadingSimulation progress={progress} />}

      {results.length > 0 && (
        <div className="outputs">
          <LiveOutputs data={results} />
          <InternalFactors data={results} />
          <ClimateOverlay data={climateData} />
        </div>
      )}

      {results.length > 0 && (
        <ResultsExport
          data={results}
          formats={['csv', 'pdf']}
        />
      )}
    </div>
  )
}
```

---

## Styling Patterns

### Color Palette
```css
/* Primary (Blue) */
--primary-50: #eff6ff
--primary-500: #3b82f6
--primary-700: #1d4ed8

/* Success (Green) */
--success-500: #22c55e

/* Warning (Yellow) */
--warning-500: #eab308

/* Error (Red) */
--error-500: #ef4444

/* Neutral (Gray) */
--gray-50: #f9fafb
--gray-500: #6b7280
--gray-900: #111827
```

### Typography
```css
/* Headings */
h1: 2.5rem, font-bold
h2: 2rem, font-semibold
h3: 1.5rem, font-semibold

/* Body */
p: 1rem, font-normal
small: 0.875rem

/* Code/Math */
code: font-mono
equation: font-serif (for LaTeX)
```

### Spacing
```css
/* Consistent spacing scale */
--space-1: 0.25rem
--space-2: 0.5rem
--space-4: 1rem
--space-6: 1.5rem
--space-8: 2rem
--space-12: 3rem
```

---

## Accessibility

All components must:
- Support keyboard navigation
- Have ARIA labels
- High contrast (WCAG AA)
- Screen reader compatible
- Focus indicators visible

Example:
```tsx
<button
  onClick={handleClick}
  aria-label="Run simulation"
  className="focus:ring-2 focus:ring-primary-500"
>
  Run
</button>
```
