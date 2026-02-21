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

### Light Models
- `monod` - Simple hyperbolic
- `steele` - Exponential inhibition
- `banerjee` - Power inhibition
- `pfaffinger` - Power-law inhibition
- `eilers-peeters` - Alternative formulation
- `haldane` - Substrate inhibition adapted

### Temperature Models
- `marsullo` - Lethal-based exponential
- `james` - Gaussian
- `arrhenius` - Basic activation energy
- `modified-arrhenius` - With optimum
- `cardinal` - Three-point cardinal
- `beta-function` - Flexible shape

### Nutrient Models
- `monod` - Hyperbolic limitation
- `droop` - Internal quota
- `morel` - Multi-nutrient

### pH Models
- `cardinal` - Three-point
- `gaussian` - Normal distribution

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
2. Implement interface from `types.ts`
3. Add to registry in `index.ts`
4. Add LaTeX in `lib/equations/latex/[category]/[new-model].ts`
5. Add test in `test/models/[category]/[new-model].test.ts`

## Benefits

- Single source of truth
- Type-safe parameters
- Easy to add new models
- Consistent across site
- Testable
- Documented with metadata
