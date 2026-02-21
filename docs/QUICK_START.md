# Quick Start Guide

How to get started building AlgaeMath.com

---

## Initial Setup

### 1. Create Next.js Project
```bash
npx create-next-app@latest algaemath --typescript --tailwind --app
cd algaemath
```

### 2. Install Dependencies
```bash
# UI Components
npm install @radix-ui/react-slot class-variance-authority clsx tailwind-merge

# Charts
npm install recharts

# LaTeX Rendering
npm install katex @types/katex

# Forms
npm install react-hook-form zod @hookform/resolvers

# Icons
npm install lucide-react

# Animation
npm install framer-motion
```

### 3. Set Up Shadcn/ui
```bash
npx shadcn-ui@latest init
```

Add components as needed:
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add slider
npx shadcn-ui@latest add select
npx shadcn-ui@latest add card
```

### 4. Project Structure
Create the directory structure from `FILE_STRUCTURE.md`.

```bash
mkdir -p app/{core-concepts,equations,models,technoeconomics,simple-simulators,dynamic-pbr,experiments}
mkdir -p components/{ui,layout,shared,landing}
mkdir -p lib/{models,equations,simulation,technoeconomics,curve-fitting,export,data,utils}
mkdir -p public/{images,downloads}
```

---

## Development Workflow

### Page-by-Page Process

1. **Plan in Claude Chat**
   - Discuss component structure
   - Design data flow
   - Review API needs

2. **Build in VSCode**
   - Create page file: `app/[page]/page.tsx`
   - Create components: `app/[page]/components/`
   - Use Copilot for boilerplate
   - Implement logic manually

3. **Test Locally**
   ```bash
   npm run dev
   ```
   - Open http://localhost:3000
   - Test all interactions
   - Verify responsive design
   - Check console for errors

4. **Commit When Complete**
   ```bash
   git add .
   git commit -m "feat: complete [page name]"
   git push
   ```

5. **Move to Next Page**

---

## First Page to Build

**Recommendation: Core Concepts - Light Response Explorer**

Why?
- Self-contained (no API needed)
- Tests model registry pattern
- Tests interactive components
- Visual & satisfying
- Reusable for other concepts

### Step-by-Step

#### 1. Create Model Registry
```typescript
// lib/models/light/types.ts
export interface LightModel {
  id: string
  name: string
  calculate: (I: number, params: any) => number
  // ... rest from MODEL_REGISTRY.md
}
```

#### 2. Implement One Model
```typescript
// lib/models/light/banerjee.ts
export const banerjee: LightModel = {
  id: 'banerjee',
  name: 'Banerjee Model',
  calculate: (I, params) => {
    const { I_half_sat, I_inhibition } = params
    return I / (I_half_sat + I + (I * I) / I_inhibition)
  },
  // ...
}
```

#### 3. Create Registry
```typescript
// lib/models/light/index.ts
export const lightModels = {
  banerjee,
  // ... add more later
}
```

#### 4. Build Component
```typescript
// app/core-concepts/components/LightResponseExplorer.tsx
'use client'

import { useState } from 'react'
import { lightModels } from '@/lib/models/light'
import { Slider } from '@/components/ui/slider'
import { LineChart, Line, XAxis, YAxis } from 'recharts'

export function LightResponseExplorer() {
  const [intensity, setIntensity] = useState(500)
  const model = lightModels.banerjee

  const params = {
    I_half_sat: 112.2,
    I_inhibition: 369.3
  }

  // Generate curve data
  const curveData = Array.from({length: 100}, (_, i) => {
    const I = i * 20  // 0 to 2000
    return {
      I,
      mu: model.calculate(I, params)
    }
  })

  // Current value
  const currentMu = model.calculate(intensity, params)

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Light Response</h3>
      <p>Explore how light intensity affects growth rate...</p>

      <div>
        <label>Intensity: {intensity} umol/m2/s</label>
        <Slider
          value={[intensity]}
          onValueChange={([v]) => setIntensity(v)}
          min={0}
          max={2000}
          step={10}
        />
      </div>

      <LineChart width={600} height={300} data={curveData}>
        <XAxis dataKey="I" label="Light Intensity" />
        <YAxis label="Growth Factor" />
        <Line type="monotone" dataKey="mu" stroke="#3b82f6" />
      </LineChart>

      <div className="p-4 bg-blue-50 rounded">
        <p>At {intensity} umol/m2/s:</p>
        <p className="text-2xl font-bold">mu = {currentMu.toFixed(3)}</p>
      </div>
    </div>
  )
}
```

#### 5. Add to Page
```typescript
// app/core-concepts/page.tsx
import { LightResponseExplorer } from './components/LightResponseExplorer'

export default function CoreConceptsPage() {
  return (
    <div className="container mx-auto py-8 space-y-12">
      <h1 className="text-4xl font-bold">Core Concepts</h1>

      <section id="light-response">
        <LightResponseExplorer />
      </section>

      {/* Add other sections as you build them */}
    </div>
  )
}
```

#### 6. Test
```bash
npm run dev
# Navigate to http://localhost:3000/core-concepts
# Move slider, verify chart updates
```

---

## Common Commands

```bash
# Development server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build

# Preview production build
npm run start
```

---

## Troubleshooting

### "Module not found"
```bash
# Clear cache
rm -rf .next
npm run dev
```

### TypeScript errors
```bash
# Check for errors
npm run type-check

# Generate types
npm run build
```

### Tailwind not working
Check `tailwind.config.ts` includes:
```typescript
content: [
  './app/**/*.{js,ts,jsx,tsx,mdx}',
  './components/**/*.{js,ts,jsx,tsx,mdx}',
]
```

---

## Git Workflow

### Create Feature Branch
```bash
git checkout -b feature/light-response-explorer
```

### Commit Regularly
```bash
git add .
git commit -m "feat: add light response explorer component"
```

### Push When Complete
```bash
git push origin feature/light-response-explorer
```

### Merge to Main
```bash
git checkout main
git merge feature/light-response-explorer
git push origin main
```

---

## Environment Variables

Create `.env.local`:
```
WEATHERBIT_API_KEY=your_key_here
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_key_here
```

Never commit `.env.local` to git!

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel dashboard
3. Add environment variables
4. Deploy!

Vercel automatically:
- Deploys on every push to main
- Generates preview URLs for PRs
- Handles serverless functions
- Provides global CDN

---

## Next Steps

After first component works:

1. **Add more models** to registry (Steele, Monod, etc.)
2. **Add model selector** dropdown
3. **Build remaining concept explorers**
4. **Move to Equations page**
5. **Continue page by page**

---

## Getting Help

- Check `PAGE_REQUIREMENTS.md` for specs
- Check `COMPONENT_LIBRARY.md` for patterns
- Check `MODEL_REGISTRY.md` for model structure
- Ask in Claude chat for architecture questions
- Use Copilot in VSCode for implementation
