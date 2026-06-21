# Design Specification: WikiOS Kapwa Sandbox Integration

This specification details the design for introducing a scoped trial run of the **Kapwa** design system inside the **WikiOS** application of the IxStates platform. It outlines how we will load the Kapwa package, scope its Tailwind CSS v4 variables, and map them to our signature **Facet** glass physics visual language.

---

## 1. Goal & Context
The goal is to test the feasibility and aesthetic fit of Kapwa's layout and component hierarchies (timeline lists, tables, grids) inside WikiOS. 
To ensure zero regression risk to live wiki pages, this integration will live entirely within a newly created developer sandbox page at `/wiki/sandbox`. 
The sandbox will feature an interactive tabbed layout letting reviewers toggle between a standard component playground and simulated live-data views of the **Recent Changes** page and **Stash Manager** dashboard.

---

## 2. Visual Architecture & Token Mapping
The primary design challenge is to prevent visual clash between Kapwa's flat, Philippine-government-focused light/dark styles and our custom, dark-mode-first, volumetric satin glass styling (Facet).

### 2.1 CSS Scoping & Isolation
We will scope Kapwa's CSS imports using a parent container class `.kapwa-sandbox`. This isolates Kapwa's styles and prevents overrides from leaking globally.
We will create a new scoped stylesheet at `src/styles/wiki-os/kapwa-scoped.css` which includes:
1. Scoped import of `@bettergov/kapwa/kapwa.css`.
2. Variable overrides mapping Kapwa's semantic properties to WikiOS variables.

### 2.2 Token Overrides
Inside the `.kapwa-sandbox` class scope, we will re-define Kapwa's custom properties:

```css
.kapwa-sandbox {
  /* Scope the import of Kapwa stylesheets */
  @import "@bettergov/kapwa/kapwa.css";

  /* Map core canvases and surfaces to WikiOS */
  --color-kapwa-bg-canvas: var(--wikios-bg);
  --color-kapwa-bg-surface: var(--wikios-surface);
  --color-kapwa-border-default: var(--wikios-border);
  --color-kapwa-text-default: var(--wikios-text);
  --color-kapwa-text-muted: var(--wikios-text-muted);
  --color-kapwa-text-dim: var(--wikios-text-dim);
  
  /* Map brand colors to WikiOS blue/gold accents */
  --color-kapwa-brand-600: var(--wikios-accent);
  --color-kapwa-brand-500: var(--wikios-accent-hover);
  --color-kapwa-link-default: var(--wikios-link);
  
  /* Volumetric translucent satin glass mapping for Kapwa cards */
  --color-kapwa-bg-card: rgba(30, 32, 40, 0.45);
  --color-kapwa-shadow-card: 0 4px 30px rgba(0, 0, 0, 0.2);
}
```

### 2.3 Physical Chamfers & Glare Overrides
To inject the volumetric satin glass look into Kapwa cards, we will override Kapwa's `.kp-card` class when rendered inside the sandbox:
- Apply `backdrop-filter: blur(16px) saturate(150%)`.
- Inject a `::before` pseudo-element with `mask-composite: xor` and a subtle white/translucent gradient border to simulate a 1px chamfered edge catch glare.
- Minimize glare opacity to `0.08` in dark mode to align with Facet dark mode rules.

---

## 3. Sandbox Component Structure

### 3.1 Route Configuration
- **Path:** `/wiki/sandbox`
- **Page File:** `src/app/(wiki-os)/wiki/sandbox/page.tsx`
- **Security:** Renders inside `WikiOSLayout` (accessible to signed-in users). Includes a warning banner that this is an experimental sandbox.

### 3.2 View Toggles
We will implement an tabbed view managed via React state:

#### View 1: Component Playground (`"playground"`)
- Renders side-by-side or stacked comparisons of raw Kapwa components versus our glass-themed Kapwa wrappers.
- Includes buttons (primary, secondary, danger), alert blocks (info, warning, error), form fields (inputs, select widgets), and badges.
- Displays responsive behaviors in both light and dark modes.

#### View 2: Recent Changes Simulator (`"recent-changes"`)
- Fetches live wiki activity using the `api.wikios.getRecentChanges.useQuery({ limit: 15 })` tRPC hook.
- Formats the activity using Kapwa's feed/list component layout.
- Integrates WikiOS styling features: byte delta values colored with glowing green/red classes, link formatting using traditional wiki blue/purple colors, and collapsible details for pages with multiple edits.

#### View 3: Stash Manager Simulator (`"stashes"`)
- Fetches live user stashes using the `api.wikios.getStashes.useQuery()` tRPC hook.
- Formats stashed collections as folder cards using Kapwa's grid/card structure.
- Integrates Facet's dynamic hover lift animations (`useFacetDepth`) on individual stash folder cards.
- Simulates an empty-state warning page using Kapwa's warning block templates when a user has no stashes created.

---

## 4. Verification Plan

### 4.1 Automated Build Check
Verify that loading `@bettergov/kapwa` as a dependency compiles correctly and doesn't break production builds or Turbopack compilation:
- Run `bun run build`.

### 4.2 Manual Design Verification
1. Navigate to `/wiki/sandbox` and toggle through all three views.
2. Verify that changing the global theme (dark/light) updates Kapwa components correctly.
3. Inspect sandbox pages to confirm Kapwa styles do not leak into the parent `WikiOSLayout` sidebar, search modals, or main headers.
4. Verify that live data is loaded and displayed correctly in the simulator tabs.
