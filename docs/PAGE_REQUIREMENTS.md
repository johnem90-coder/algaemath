# Page Requirements

Detailed specifications for each page.

---

## 1. Landing Page

**Route:** `/`
**Type:** Static with animations

**Sections:**
1. Hero - Site title, tagline, main CTA
2. Feature Grid - 8 clickable cards (one per main page)
   - Thumbnail/icon
   - Title
   - Short description (2-3 sentences)
   - "Explore" link
3. About Section - Brief project description
4. Footer - Contact, about link

**Downloads:** None

**Components:**
- `Hero.tsx`
- `PagePreviewCard.tsx` (reusable for 8 sections)
- `FeatureHighlight.tsx`

---

## 2. Core Concepts

**Route:** `/core-concepts`
**Type:** Single scrollable page with 10 interactive sections

**Sections (each with interactive explorer):**
1. **Density** - g/L, what it means, typical ranges
2. **Productivity** - Areal vs volumetric, units, calculation
3. **Growth Rate** - Exponential growth, doubling time
4. **Light Response** - Interactive curve with slider
5. **Temperature Response** - Interactive curve with zones
6. **Nutrient Response** - Interactive limitation curve
7. **Combined Effects** - Multiplicative vs Liebig
8. **Light Attenuation** - Beer-Lambert visualization
9. **Absorption & Efficiency** - PAR, quantum yield
10. **Adaptation** - Photoacclimation concepts

**Downloads:**
- PDF: Core concepts summary
- PDF: Visual guide

**Components (in `app/core-concepts/components/`):**
- `DensityExplorer.tsx`
- `ProductivityExplorer.tsx`
- `GrowthRateExplorer.tsx`
- `LightResponseExplorer.tsx`
- `TempResponseExplorer.tsx`
- `NutrientResponseExplorer.tsx`
- `CombinedEffects.tsx`
- `LightAttenuation.tsx`
- `AbsorptionEfficiency.tsx`
- `AdaptationExplorer.tsx`
- `DownloadSection.tsx`

---

## 3. Equations

**Route:** `/equations`
**Type:** Single scrollable page with model comparisons

**Sections (implemented):**
1. **Light Response** - Light models with interactive curves
2. **Temperature Response** - Temperature models with interactive curves
3. **Nutrient Response** - Nutrient limitation models
4. **pH Response** - pH effect models
5. **Light Attenuation** - Beer-Lambert, depth profiles

**Sections (planned):**
6. **Heat Flux** - 6+ components explained (see SIMULATION_DESIGN.md)
7. **Surface Optics** - Fresnel, Snell's law, refraction
8. **Growth Rate** - Multiplicative vs Liebig

**Each model shows:**
- Name & description
- Equation (LaTeX rendered)
- Variables table
- Use cases
- Limitations
- Reference citation
- Interactive curve (some sections)

**Downloads:**
- PDF: Complete equation reference
- PDF: Model comparison tables

**Components:**
- `EquationSection.tsx` (reusable template)
- `ModelComparison.tsx` (side-by-side display)
- `AnimatedCurve.tsx` (looping animations)
- `InteractiveEquation.tsx` (editable parameters)

---

## 4. Models Pages

### Open Pond (`/models/open-pond`)
**Type:** Descriptive with visuals

**Content:**
- System overview & description
- Animated pond diagram
- Mixing visualization (paddlewheel)
- Depth analysis charts
- Heat balance breakdown
- Design considerations

**Downloads:** PDF with specs & diagrams

### Flat Panel (`/models/flat-panel`)
**Content:**
- System overview
- Panel diagram
- Light path visualization
- Gas sparging animation
- Orientation analysis (angle effects)

**Downloads:** PDF with specs & diagrams

### Tubular PBR (`/models/pbr-tubular`)
**Content:**
- System overview
- Tubular diagram
- Flow visualization
- Photoperiod analysis (light/dark cycles)
- Scaling factors

**Downloads:** PDF with specs & diagrams

### Design Exploration (`/models/design-exploration`)
**Content:**
- Parameter sweep visualizations
- Cost vs productivity tradeoffs
- 2D/3D optimization plots
- Side-by-side design comparison

**Downloads:** PDF with design guidelines

---

## 5. Technoeconomics Pages

### All Three (`open-pond`, `flat-panel`, `pbr-tubular`)
**Type:** Interactive calculators with charts

**Content:**
- CapEx breakdown (pie chart)
- OpEx breakdown (stacked bar)
- Production cost over time ($/kg biomass)
- Sensitivity analysis (tornado diagram)
- NPV/IRR calculator (interactive)

**Downloads:**
- Excel: Cost calculator template
- PDF: Economic analysis report

**Components (shared across all three):**
- `CapExBreakdown.tsx`
- `OpExBreakdown.tsx`
- `ProductionCostChart.tsx`
- `SensitivityAnalysis.tsx`
- `NPVCalculator.tsx`

---

## 6. Simple Outdoor Simulators

### All Three (`open-pond`, `flat-panel`, `pbr-tubular`)
**Type:** Interactive simulation (1-2 weeks)

**Inputs:**
- Location (SVG world map with predefined cities + custom coordinates)
- Season selection (Spring, Summer, Autumn, Winter — maps to 14-day date ranges)
- Initial conditions (biomass, depth, etc.)
- System parameters (area, design specs)

**Real-time Outputs:**
- Growth rate chart
- Density chart
- Productivity chart (areal & volumetric)
- Harvest mass chart
- Energy use/efficiency

**Internal Factors (shown alongside):**
- Light response curve (current position marked)
- Temperature response curve (current position)
- Attenuation profile (depth vs intensity)
- Climate overlay (weather data)

**Controls:**
- Play/pause/reset
- Speed control
- Time scrubber

**Downloads:**
- CSV: Time-series simulation data
- PDF: Simulation summary report

**Components (open-pond, implemented):**
- `OpenPondSimulator.tsx` - Main orchestrator
- `WorldMap.tsx` - SVG world map with city markers and weather data table
- `PondCanvas.tsx` - Three.js 3D pond renderer
- `PondControls.tsx` - Play/pause/speed/time controls
- `DataStrip.tsx` - Live data cards overlay
- `WeatherPanel.tsx` - Current weather conditions display
- `WindIndicator.tsx` - Wind direction compass

**Additional components (planned for all simulator types):**
- `LiveOutputs/` (Recharts time-series)
- `InternalFactors/` (response curves with current position markers)
- `ResultsExport.tsx`

---

## 7. Dynamic PBR Simulator

**Route:** `/dynamic-pbr/controlled-environment`
**Type:** Advanced interactive simulation

**Features:**
- All features from Simple Simulators PLUS:
- User-defined setpoints (temp, pH, nutrients, light, CO2)
- Real-time system monitoring:
  - Heater (on/off, power draw)
  - Fan (RPM, airflow)
  - Nutrient pump (flow rate, volume dosed)
  - Water pump (evaporation makeup)
  - CO2 bubble column (dissolution, pH effect)
  - LED control (spectrum, intensity, PWM)
- Feedback loop visualization
- PID tuning interface (Kp, Ki, Kd)
- Animated process diagram
- Event log (all control actions)

**Downloads:**
- CSV: Full system state history
- PDF: Control system performance report

**Components:**
- Everything from Simple Simulators
- `ControlPanel/` (setpoints)
- `SystemsMonitoring/` (real-time status)
- `FeedbackLoops/` (control visualization)
- `ProcessDiagram.tsx`
- `EventLog.tsx`

---

## 8. Experiments & Model Fitting

### All Three Experiments
**Type:** Data visualization & analysis

**Content:**
- Experiment overview & motivation
- Methods description (how data collected)
- Raw data scatter plot
- Multiple fitted curves overlaid
- Residual plots
- Goodness of fit metrics (R2, RMSE, AIC, BIC)
- Parameter table (fitted values)
- Model comparison discussion

**Downloads:**
- CSV: Raw experimental data
- CSV: Fitted model parameters
- PDF: Methods & results document

**Components (shared):**
- `ExperimentalData.tsx`
- `ModelFitting.tsx`
- `ResidualPlot.tsx`
- `GoodnessOfFit.tsx`
- `ParameterTable.tsx`
- `MethodsDescription.tsx`

---

## Common Patterns Across Pages

### All Pages Have:
1. Page header with title & description
2. Navigation breadcrumbs
3. Responsive layout (mobile, tablet, desktop)
4. Loading states
5. Error boundaries

### Interactive Pages Have:
- Parameter sliders with units
- Real-time chart updates
- Model selection dropdowns
- Reset button
- Export functionality

### Static Pages Have:
- Clear section headers
- Visual diagrams/animations
- Download buttons
- Citation references
