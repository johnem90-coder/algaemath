# AlgaeMath — Claude Code Project Notes

## Project Overview
AlgaeMath is a Next.js (App Router) site with interactive tools for algae cultivation engineering. Built with TypeScript, Tailwind CSS v4, Recharts, Three.js, and KaTeX.

## Key Architecture
- **Framework**: Next.js 15 with App Router, "use client" for interactive components
- **Styling**: Tailwind CSS v4 with `@import "tailwindcss"` in globals.css
- **Fonts**: Geist (sans) + Geist Mono loaded via `next/font/google`
- **UI Components**: shadcn/ui (Slider, Accordion, etc.) in `components/ui/`
- **Logo**: Inline SVG in SiteHeader.tsx and app/page.tsx using Geist font

## Mobile Responsive Design (established patterns)
- **Horizontal sliders on mobile**: Vertical sliders are hidden on mobile (`hidden sm:flex` or `hidden md:flex` or `hidden lg:flex`) and replaced with horizontal `<Slider>` components (`sm:hidden` / `md:hidden` / `lg:hidden`). The horizontal sliders show parameter label + value on a row above the slider.
- **Show/hide layout divergence**: When mobile and desktop layouts differ significantly, render both and use responsive visibility classes. Use `sm:contents` or `lg:contents` to dissolve wrapper divs on larger screens.
- **Touch handling**: Add `touch-pan-y` to chart containers to prevent horizontal page scrolling when interacting with charts. Add `overflow-x-hidden` on body.
- **SVG viewBox cropping**: For complex SVG visualizations, use separate SVGs with different viewBox crops for mobile vs desktop. Extract render functions to avoid content duplication.
- **Breakpoints used**: `sm:` (640px) for header nav, `md:` (768px) for explorations/simulators, `lg:` (1024px) for equations grid and growth model panels.

## Pages & Key Components
- `/` — Home page with logo + page cards
- `/core-concepts` — 7 interactive visualizers (growth rate, light, temp, nutrient, combined, attenuation, absorption)
- `/equations` — 5 equation sections with model cards (light, temp, nutrient, pH, attenuation)
- `/simple-simulators/open-pond` — Open pond simulator with 3D canvas, world map, growth model panels
- `/explorations` — Design explorer with variable depth + layered light sections
- `/technoeconomics` — TEA page (not yet public, `soon: true` in nav)

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint

## Important Files
- `components/layout/SiteHeader.tsx` — Header with inline SVG logo + mobile hamburger menu
- `app/layout.tsx` — Root layout with `overflow-x-hidden` on body
- `app/globals.css` — Tailwind v4 config with custom CSS variables
- `lib/simulation/cell-animation.ts` — Shared cell animation constants (MX=260, MY=195, MR=70)
