# Model Registry Pattern

## Overview

All physics models follow a standard pattern for consistency and reusability.

## Structure for Each Model Category

### Directory Layout
```
lib/models/light/
├── index.ts          # Registry - exports all models
├── types.ts          # TypeScript interfaces
├── monod.ts          # Individual model
├── steele.ts
├── banerjee.ts
└── ...
```

### Model Interface (`types.ts`)
```typescript
export interface LightModelParams {
  I_half_sat: number      // Half-saturation (μmol/m²/s)
  I_inhibition?: number   // Inhibition constant (optional)
}

export interface LightModel {
  id: string
  name: string
  description: string
  category: 'simple' | 'inhibition' | 'advanced'

  // Calculation function
  calculate: (I: number, params: LightModelParams) => number

  // Metadata
  reference: {
    citation: string
    doi?: string
    year: number
  }

  parameterRanges: Record<string, [number, number]>
  useCases: string[]
  limitations: string[]
}
```

### Individual Model (`banerjee.ts`)
```typescript
import { LightModel, LightModelParams } from './types'

export const banerjee: LightModel = {
  id: 'banerjee',
  name: 'Banerjee Photoinhibition Model',
  description: 'Exponential inhibition with separate terms',
  category: 'inhibition',

  calculate: (I: number, params: LightModelParams) => {
    const { I_half_sat, I_inhibition } = params
    return I / (I_half_sat + I + (I * I) / I_inhibition!)
  },

  reference: {
    citation: 'Banerjee et al. (1998)',
    doi: '10.1016/S0141-0229(98)00002-8',
    year: 1998
  },

  parameterRanges: {
    I_half_sat: [50, 300],
    I_inhibition: [200, 800]
  },

  useCases: [
    'High-light outdoor systems',
    'Species with known photoinhibition'
  ],

  limitations: [
    'No photoacclimation',
    'Instant response assumed'
  ]
}
```

### Registry (`index.ts`)
```typescript
import { monod } from './monod'
import { steele } from './steele'
import { banerjee } from './banerjee'
// ... import all models

export const lightModels: Record<string, LightModel> = {
  monod,
  steele,
  banerjee,
  // ... register all
}

// Helper functions
export const getLightModel = (id: string) => lightModels[id]
export const listLightModels = () => Object.values(lightModels)

// Export everything
export * from './types'
export { monod, steele, banerjee }
```

## Model Categories

Implemented models are marked with a checkmark. Others are planned.

### Light Models
- ✅ `steele` - Exponential inhibition (Steele photoinhibition)
- `monod` - Simple hyperbolic
- `banerjee` - Power inhibition
- `pfaffinger` - Power-law inhibition
- `eilers-peeters` - Alternative formulation
- `haldane` - Substrate inhibition adapted

Also implemented in `lib/models/light/`: `beer-lambert.ts` (attenuation), `pigment-absorption.ts`, `solar-spectrum.ts`.

### Temperature Models
- ✅ `gaussian` - Gaussian response curve
- `marsullo` - Lethal-based exponential
- `arrhenius` - Basic activation energy
- `modified-arrhenius` - With optimum
- `cardinal` - Three-point cardinal
- `beta-function` - Flexible shape

### Nutrient Models
- ✅ `monod` - Hyperbolic limitation (modified Monod)
- `droop` - Internal quota
- `morel` - Multi-nutrient

### pH Models
- `cardinal` - Three-point
- `gaussian` - Normal distribution

### Combined Models
- ✅ `multiplicative` - µ_eff = µ_max × f(I) × f(T) × f(S)

## Usage Examples

### In a Simulator
```typescript
import { lightModels } from '@/lib/models/light'

const modelId = 'banerjee'  // User selection
const model = lightModels[modelId]

const mu_light = model.calculate(intensity, {
  I_half_sat: 112.2,
  I_inhibition: 369.3
})
```

### In Equations Page
```typescript
import { listLightModels } from '@/lib/models/light'

const allModels = listLightModels()

// Render comparison
allModels.map(model => (
  <div>
    <h3>{model.name}</h3>
    <p>{model.description}</p>
    <EquationDisplay latex={model.equation_latex} />
  </div>
))
```

### Model Comparison
```typescript
const intensity = 500
const results = Object.values(lightModels).map(model => ({
  name: model.name,
  value: model.calculate(intensity, defaultParams[model.id])
}))
```

## Adding a New Model

1. Create `lib/models/[category]/[new-model].ts`
2. Implement interface from `lib/models/types.ts`
3. Add to registry in `lib/models/[category]/index.ts`
4. Add LaTeX/metadata in `lib/equations/[category].ts`
5. Add test in `test/models/[category]/`

**Note:** The simulation engine consumes growth factors (0–1) from these models. The engineering equations that combine them into net growth rate and drive the mass/energy balances are documented in `docs/SIMULATION_DESIGN.md`.

## Benefits

- Single source of truth
- Type-safe parameters
- Easy to add new models
- Consistent across site
- Testable
- Documented with metadata
