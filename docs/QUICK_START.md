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

The project already includes all dependencies: Next.js 16, React 19, Tailwind CSS 4, Three.js, KaTeX, Lucide icons, Shadcn/ui components, Vercel Analytics, and more.

### 2. Run the Development Server
```bash
npm run dev
```

The project already includes Shadcn/ui components (button, slider, select, card, accordion, tabs) in `components/ui/` and all required directory structure. See `docs/FILE_STRUCTURE.md` for the complete layout.

---

## Development Workflow

### Page-by-Page Process

1. **Plan** — Discuss component structure, design data flow
2. **Build in VSCode** — Create page and components
3. **Test Locally** — `npm run dev`, verify functionality
4. **Commit When Complete** — Git workflow (feature branches)
5. **Move to Next Page**

---

## Current Project State

The following pages are already built and functional:

- **Landing page** (`/`) — overview with 6 section cards (3 active, 3 "coming soon")
- **Core Concepts** (`/core-concepts`) — 7 interactive visualizers in accordion layout
- **Equations** (`/equations`) — 5 sections with LaTeX equations and interactive curves
- **Simple Simulators** (`/simple-simulators`) — index page with 3 simulator cards
- **Open Pond Simulator** (`/simple-simulators/open-pond`) — full simulation with 3D renderer, 29-city weather data, growth model panels, charts, data export (CSV + table overlay), and inline controls

The model registry pattern, equation metadata, simulation engine, weather data pipeline, and component patterns are all established. New pages should follow the existing patterns visible in these implementations.

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

## Weather Data

Weather data for 29 cities is pre-cached as JSON files in `public/weather/`. To regenerate or add cities:

```bash
node scripts/generate-weather-data.mjs
```

This fetches historical weather from the Open-Meteo API (free, no API key needed) and writes JSON files. Each file contains 4 seasons × 14 days of hourly data.

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

# Full build check
npm run build
```

---

## Git Workflow

### Create Feature Branch
```bash
git checkout -b feature/[feature-name]
```

### Commit Regularly
```bash
git add [files]
git commit -m "feat: [description]"
```

### Push and Create PR
```bash
git push origin feature/[feature-name]
gh pr create --title "..." --body "..."
```

---

## Environment Variables

No API keys are required. Weather data uses the free Open-Meteo API (no key needed) and is pre-cached as static JSON in `public/weather/`.

Vercel Analytics is configured via `@vercel/analytics/next` and works automatically on Vercel deployments.

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel dashboard
3. Deploy!

Vercel automatically:
- Deploys on every push to main
- Generates preview URLs for PRs
- Handles serverless functions
- Provides global CDN
- Includes Vercel Analytics

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
- Check `SIMULATION_DESIGN.md` for engineering equations
- Check `API_DESIGN.md` for backend design
