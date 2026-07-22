# Meridian Freight

An Awwwards-style marketing site for **Meridian Freight**, a global freight-forwarding
and logistics company. Built with Next.js App Router, TypeScript, Tailwind CSS, and
Framer Motion.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** with a small design-token layer (`tailwind.config.ts`)
- **Framer Motion** for scroll reveals, staggered entrances, and hover micro-interactions
- **Lenis** for smooth scrolling
- **Poppins** (400/500/600/700) via `next/font/google`
- **lucide-react** for icons
- No CMS — all copy lives in typed files under `/content`

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production build

```bash
npm run build
npm run start
```

### Lint

```bash
npm run lint
```

## Project structure

```
app/
  layout.tsx          Root layout: fonts, smooth scroll, header/footer
  page.tsx             Home page (all sections assembled)
  globals.css          Tailwind base + design-token CSS variables
  about/page.tsx        /about stub route
  services/page.tsx     /services stub route (detailed service breakdown)
  contact/page.tsx      /contact route with working form
  api/contact/route.ts  POST endpoint that validates + logs enquiries

components/            Reusable, typed UI components
  Header, Footer, Hero, LogoStrip, ServiceCard, StatCounter,
  NetworkMap, ProcessStep, FeatureRow, TestimonialCarousel,
  CTABand, Button, Section, Reveal, SmoothScrollProvider, ContactForm

content/                Hard-coded, typed content (edit here, no CMS needed)
  company.ts, nav.ts, services.ts, stats.ts, testimonials.ts,
  process.ts, features.ts, logos.ts, network.ts

lib/
  utils.ts              Small class-name helper
  service-icons.tsx      Maps service content to lucide-react icons
```

## Editing content

Everything user-facing text/data driven lives in `/content/*.ts` — update copy,
stats, testimonials, services, or network hubs there without touching component code.

## Design tokens

Brand colors are defined as CSS variables in `app/globals.css` and mirrored in
`tailwind.config.ts` as `brand-blue`, `graphite`, `graphite-deep`, and `off-white`.

## Accessibility & motion

- Semantic landmarks, skip-to-content link, visible focus states (`focus-ring`)
- Keyboard-navigable nav, mobile menu, and testimonial carousel
- All scroll/entrance animation respects `prefers-reduced-motion`
- Images use `next/image` with explicit `sizes` for responsive, layout-shift-free loading

## Deploying to Vercel

Push this repo to GitHub and import it in Vercel — no configuration required.
The only external dependency is `images.unsplash.com`, already allow-listed in
`next.config.mjs`.

## Notes & assumptions

- Brand name **"Meridian Freight"** was invented per the brief; update
  `content/company.ts` to rebrand.
- The contact form posts to `/api/contact`, which validates input and logs the
  submission server-side (`console.log`) as a placeholder — wire in email/CRM
  delivery when ready.
- Client logos and testimonials are placeholder names; imagery uses royalty-free
  Unsplash photos referenced by URL (no binary assets committed).
