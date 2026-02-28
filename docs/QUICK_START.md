# Quick Start Guide

How to get started building AlgaeMath.com

---

## Initial Setup

### 1. Clone and Install
```bash
git clone https://github.com/johnem90-coder/algaemathdotcom.git
cd algaemathdotcom
npm install
```

The project already includes all dependencies: Next.js 16, React 19, Tailwind CSS 4, Three.js, Recharts, KaTeX, Framer Motion, Lucide icons, Shadcn/ui components, and more.

### 3. Run the Development Server
```bash
npm run dev
```

The project already includes Shadcn/ui components (button, slider, select, card, accordion, tabs) in `components/ui/` and all required directory structure. See `docs/FILE_STRUCTURE.md` for the complete layout.

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

## Current Project State

The following pages are already built and functional:

- **Landing page** (`/`) — overview with page previews
- **Core Concepts** (`/core-concepts`) — 7 interactive visualizers
- **Equations** (`/equations`) — 5 sections with LaTeX equations and interactive curves
- **Open Pond Simulator** (`/simple-simulators/open-pond`) — full simulation with 3D renderer, weather data, growth model panels, charts, and inline controls

The model registry pattern, equation metadata, simulation engine, and component patterns are all established. New pages should follow the existing patterns visible in these implementations.

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

No API keys are required for v1. Weather data uses the free Open-Meteo API (no key needed) and is pre-cached as static TypeScript in `lib/simulation/weather-data.ts`.

If environment variables are needed in the future, create `.env.local` and never commit it to git.

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

Upcoming work:

1. **Heat / Energy Balance panel** for the open pond simulator
2. **Flat Panel PBR simulator** — new reactor geometry and heat balance equations
3. **Tubular PBR simulator** — tube geometry and flow modeling
4. **Models pages** — detailed reactor descriptions and design analysis
5. **Technoeconomics pages** — cost calculators
6. **Dynamic PBR Simulator** — controlled environment with PID control
7. **Experiments & Model Fitting** — data visualization and curve fitting

---

## Getting Help

- Check `PAGE_REQUIREMENTS.md` for specs
- Check `COMPONENT_LIBRARY.md` for patterns
- Check `MODEL_REGISTRY.md` for model structure
- Ask in Claude chat for architecture questions
- Use Copilot in VSCode for implementation
