# 🛡️ Vexel — Heraldry Generator & Editor

**Codename:** VEXEL
**Version:** v1.0 (Foundation PRD)
**Status:** 🟢 Product Definition
**Date:** July 15, 2026
**Product Family:** IxLabs (`/labs/vexel`)
**Supersedes:** [Vexel_PRD_v0.1.md](file:///ixwiki/public/projects/ixstats/docs/Vexel_PRD_v0.1.md) (Draft)

---

## Overview

Vexel is a structured heraldic achievement generator and editor for the Ixnay/IxStates ecosystem. It lives in **IxLabs** — the suite of standalone creative tools at `/labs/` — alongside Onoma and the Design Bible.

Rather than a freeform SVG editor, Vexel treats heraldry as **structured data**. Every coat of arms is a composition model — a JSON tree of field, divisions, ordinaries, charges, tinctures, and external ornaments — from which SVG renderings, PNG exports, and formal blazon text are all deterministically derived. The composition is the permanent source of truth; images are generated outputs.

Vexel is inspired by [Heraldicon](https://heraldicon.org/) (structured composition + blazon generation from data) and [Armoria](https://azgaar.github.io/Armoria/) (procedural generation gallery, lightweight SVG charge assembly, Svelte UI), but differentiates itself through:

1. **Wikimedia Commons integration** — A meaningful portion of the charge library is seeded from curated, license-tracked imports off [Commons heraldry categories](https://commons.wikimedia.org/wiki/Category:Heraldry_by_elements), browseable and importable directly from within the editor.
2. **Ixnay-awareness** — Country-aware composition suggestions, a public Heraldic Authority registry, and diplomatic/relational heraldry tied to IxStates' diplomacy system.
3. **Full heraldic achievements** — Not just escutcheons, but complete achievements: shield, helm, crest, mantling, supporters, motto, and compartment.
4. **Lore-aware procedural generation** — Like Armoria's gallery mode, but compositions are influenced by a nation's culture, religion, government type, and geography.

### Problem It Solves

Right now, nations and characters in Ixnay either go without a coat of arms, commission one manually (slow, inconsistent quality, no canonical source), or free-hand an SVG with no grounding in heraldic convention. There's no in-house tool that produces a properly composed *and* properly described armorial achievement, no reusable charge library, and no structured registry of who bears what arms.

---

## Product Principles

### Structured First
Images are generated from data. Never the other way around. A composition is a JSON document; SVG and PNG are derived outputs. This is what makes blazon generation, version history, and procedural generation all tractable.

### Engine Before Editor
The composition model, validation engine, and blazon generator are backend primitives that multiple surfaces consume. The editor is one client. Builder, MyCountry, IxWiki, the Heraldic Authority, and future APIs all interact with the same underlying model.

### Historically Inspired, Not Historically Restricted
Vexel follows established heraldic conventions (rule of tincture, standard blazon grammar, proper charge attitudes) but serves a **fictional worldbuilding** context. Warnings are preferred over restrictions. A nation's heraldic tradition may intentionally deviate from European norms.

### Deterministic
The same composition always produces the same SVG, the same PNG, the same blazon, and the same validation results. No randomness in rendering.

### Commons-Powered
The charge library is not built from scratch. Wikimedia Commons' extensive heraldry asset tree (53+ division subcategories, 14 tincture subcategories, 13 coat-of-arms-element subcategories, 14 shield subcategories, 50+ badge files, etc.) is the seed. Custom charges extend this foundation; they don't replace it.

---

## Goals

1. **Compose heraldically-plausible full achievements** through a structured, panel-based editor — without requiring users to know heraldic terminology going in.
2. **Generate correct, readable English blazons** automatically from any composition.
3. **Provide lore-aware procedural generation** — users can generate culturally-appropriate arms suggestions based on their nation's attributes (culture, religion, government type, geography).
4. **Build a curated, license-clean charge library** seeded from Wikimedia Commons, cached locally, with an integrated browser/importer in the editor.
5. **Store heraldry as structured data** — compositions persist as JSON, not just rendered images. Arms are re-editable indefinitely.
6. **Establish a public Heraldic Authority** — a browseable registry of all arms in the Ixnay world, searchable by nation, dynasty, institution.
7. **Integrate cleanly with existing IxStates data** — arms populate `Country.coatOfArms`, `NationalIdentity` symbol fields, and ThinkPages personal heraldry.
8. **Produce publication-quality exports** — SVG (vector), PNG (raster at configurable resolution), and wiki-ready thumbnail formats.

---

## Non-Goals (v1)

- **Freeform vector drawing** — No arbitrary Bézier editing. Everything is built from library primitives. This constraint keeps compositions blazonable.
- **Blazon text → composition parsing** — Generating blazon *from* a composition is P0; parsing a hand-written blazon string back into a rendered composition is a materially harder NLP problem (P2).
- **Marshalling / combined arms** — Impalement, quartering for marriages/successions/alliances are deferred to P2 despite being on-brand for Ixnay's dynastic worldbuilding.
- **Corporate/Mercatus heraldry** — Depends on Mercatus company-identity scope maturing.
- **User-submitted custom charge uploads** — Needs a moderation pipeline; admin-seeded library only for v1.
- **AI-generated artwork** — Charges are curated SVGs, not AI-generated images.
- **Multiple rendering styles** — V1 ships with one clean, modern rendering style. Medieval/Victorian/Engraved style packs are P2.

---

## System Architecture

```
                    ┌─────────────────────┐
                    │  Composition Model   │  ← JSON source of truth
                    │  (structured data)   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐  ┌─────▼──────┐  ┌──────▼──────────┐
    │  Validation     │  │  Layout     │  │  Blazon         │
    │  Engine         │  │  Engine     │  │  Generator      │
    │  (advisory)     │  │  (spatial)  │  │  (text output)  │
    └─────────┬──────┘  └─────┬──────┘  └─────────────────┘
              │                │
              └────────┬───────┘
                       │
               ┌───────▼────────┐
               │  SVG Renderer  │
               └───────┬────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼────┐  ┌─────▼─────┐  ┌───▼───────┐
    │ SVG     │  │ PNG       │  │ API       │
    │ Export  │  │ Export    │  │ Payload   │
    └─────────┘  └───────────┘  └───────────┘
```

**Key architectural constraint:** The editor never manipulates SVG directly. It manipulates the composition model. The SVG renderer is a pure function of the model.

---

## Core Components

### 1. Composition Model

The canonical JSON representation of every heraldic achievement. This is the source of truth that all other components consume.

An achievement consists of:

```
Achievement
├── Shield
│   ├── shape (heater, kite, lozenge, round, etc.)
│   ├── Field
│   │   ├── division (plain, per pale, per fess, per bend, quarterly, gyronny, etc.)
│   │   ├── tinctures[] (one per division section)
│   │   └── lineStyle (straight, engrailed, indented, wavy, nebuly, etc.)
│   ├── Ordinaries[]
│   │   ├── type (chief, fess, pale, bend, chevron, saltire, cross, bordure, etc.)
│   │   ├── tincture
│   │   └── lineStyle
│   └── Charges[]
│       ├── chargeId (reference to charge library)
│       ├── position (on field, on ordinary, specific point)
│       ├── count (1-N)
│       ├── tincture
│       ├── size (relative scale)
│       ├── attitude (rampant, passant, displayed, etc. — for animate charges)
│       └── orientation
├── ExternalOrnaments
│   ├── Helm
│   │   ├── type (great helm, tilting helm, barrel helm, etc.)
│   │   └── facing (affronté, dexter, sinister)
│   ├── Crest
│   │   ├── chargeId
│   │   └── wreath tinctures
│   ├── Mantling
│   │   ├── exterior tincture
│   │   └── interior tincture
│   ├── Supporters
│   │   ├── dexter (chargeId + attitude)
│   │   └── sinister (chargeId + attitude)
│   ├── Compartment (optional base)
│   └── Motto
│       ├── text
│       ├── position (above/below)
│       └── scroll style
├── Metadata
│   ├── id (UUID)
│   ├── ownerId
│   ├── subjectType (country | character | institution | dynasty)
│   ├── subjectId
│   ├── title (e.g. "Royal Arms of Burgundie")
│   ├── generatedBlazon
│   ├── createdAt / updatedAt
│   └── publishedVersion
├── Attribution[] (per-charge license/source tracking)
└── ValidationResults[] (advisory warnings)
```

### 2. Validation Engine

Evaluates a composition against heraldic conventions. **Validation never blocks editing.** It produces advisory warnings.

Rules include:
- **Rule of Tincture** — Metal-on-metal or colour-on-colour flagged
- **Charge overlap** — Multiple charges in conflicting positions
- **Empty divisions** — Division defined but no tincture assigned
- **Unsupported combinations** — e.g. an ordinary with a division-only line style
- **Scale warnings** — Charge scaled too small to be visible

Each warning includes a severity level (info, advisory, caution) and a human-readable explanation of the heraldic convention being broken.

### 3. Layout Engine

Responsible for automatic spatial arrangement of elements within the shield and the full achievement.

Tasks include:
- Shield-relative positioning (chief point, fess point, honour point, etc.)
- Charge group arrangement (3 charges in 2-1 pattern, 5 in saltire, etc.)
- Ordinary masking (charges placed "on" an ordinary are clipped to it)
- External ornament layout (helm above shield, supporters flanking, motto below)
- Symmetry enforcement for supporter pairs
- Collision avoidance within charge groups

### 4. SVG Renderer

Transforms the positioned composition into deterministic SVG output. The renderer:
- Accepts the composition model + layout output
- Produces a clean SVG tree
- Supports configurable shield shapes
- Applies tincture fills and charge SVG insertions
- Renders external ornaments in proper layering order
- Never introduces randomness — same input, same output

### 5. Blazon Generator

Produces formal English blazon text directly from the composition model.

Because the composition is structured and typed, blazon generation is **rules-based and deterministic** — no AI or language model required.

Grammar follows standard English heraldic blazon conventions:
- Field first, then ordinaries, then charges
- Tinctures named using heraldic terms (Or, Argent, Gules, Azure, Vert, Purpure, Sable)
- Charge attitudes in proper heraldic terminology
- Motto and external ornaments described after the shield

Example output:
> *Azure, a cross Or between four eagles displayed Argent. For a crest, upon a helm affronté with a wreath Or and Azure, a demi-eagle displayed Or. Mantled Azure doubled Or. Supporters: Dexter, a lion rampant Or; Sinister, a griffin segreant Argent. Motto: "In Hoc Signo Vinces" upon a scroll below.*

### 6. Charge Library

Charges are **heraldic concepts**, not SVG files. A charge has metadata, and one or more SVG asset variants.

#### Charge Metadata Schema

| Field | Type | Description |
|---|---|---|
| id | UUID | Unique identifier |
| name | string | e.g. "Lion Rampant" |
| category | enum | Animals, Birds, Mythical, Plants, Celestial, Weapons, Buildings, Crowns, Religious, Maritime, Geometric, Human Figures, Objects, Letters, Ixnay-specific |
| subcategory | string | e.g. "Big Cats" within Animals |
| keywords | string[] | Search tags |
| heraldic family | string | Grouping (e.g. "Lions" includes rampant, passant, sejant) |
| supports recoloring | boolean | Can tincture be applied? |
| supports mirroring | boolean | Can be flipped dexter/sinister? |
| supports attitudes | boolean | Has multiple pose variants? |
| attitudes | string[] | e.g. ["rampant", "passant", "sejant", "guardant"] |
| default scale | number | Recommended size relative to shield |
| recommended placement | string | e.g. "fess point" |
| assets | Asset[] | SVG variants (see below) |
| source | "commons" \| "custom" \| "bundled" | Origin |
| sourceUrl | string? | Wikimedia Commons page URL |
| author | string? | Original artist |
| license | string | CC0, PD, CC-BY, CC-BY-SA (see License Policy) |

#### SVG Asset Structure (Armoria-compatible)

Each charge SVG follows Armoria's proven class convention for multi-color rendering:
- Root `<g>` element wraps the entire charge
- Default fill applies the primary tincture
- Elements with `class="secondary"` receive the secondary tincture
- Elements with `class="tertiary"` receive the tertiary tincture
- Elements with `class="pseudostroke"` render as outlines
- Elements with `class="background"` render behind for intertwined designs

This allows charges to be recolored at runtime by the renderer without regenerating SVGs.

### 7. Export Pipeline

All exports derive from the same canonical composition:

| Format | Use Case | Details |
|---|---|---|
| SVG | Primary vector output | Scalable, embeddable, archival |
| PNG (thumbnail) | Lists, cards, infoboxes | 256×256 or 512×512 |
| PNG (large) | Wiki articles, print | 1024×1024 or 2048×2048 |
| Blazon text | Formal description | Plain text or formatted |
| JSON | API payload | Full composition for re-editing |

---

## Editor UX

### Layout: Panel-Based Structured Editor

The editor follows a **Figma-style layer paradigm** applied to heraldry:

```
┌──────────────────────────────────────────────────────────────────┐
│  Toolbar: Save, Export, Generate, Undo/Redo, Validate, Share    │
├──────────────┬───────────────────────────┬───────────────────────┤
│              │                           │                       │
│  LAYER PANEL │    LIVE PREVIEW           │  PROPERTIES PANEL     │
│              │                           │                       │
│  ▼ Shield    │   ┌─────────────────┐     │  Selected: Charge #1  │
│    Field     │   │                 │     │                       │
│    Ordinary  │   │   Full          │     │  Type: Lion Rampant   │
│    ▼ Charges │   │   Achievement   │     │  Tincture: Or         │
│      Lion    │   │   SVG           │     │  Position: Fess Point │
│      Cross   │   │   Rendering     │     │  Scale: 0.8           │
│  ▼ Externals │   │                 │     │  Attitude: Rampant    │
│    Helm      │   │                 │     │  Mirrored: No         │
│    Crest     │   │                 │     │                       │
│    Mantling  │   └─────────────────┘     │  [Recolor] [Remove]   │
│    Support-L │                           │                       │
│    Support-R │   ┌─────────────────┐     ├───────────────────────┤
│    Motto     │   │  Blazon Output  │     │  CHARGE LIBRARY       │
│              │   │  (live)         │     │                       │
│              │   └─────────────────┘     │  [Search...        ]  │
│              │                           │  [Category filter ▼]  │
│              │   ┌─────────────────┐     │  [Commons browser ↗]  │
│              │   │  Validation     │     │                       │
│              │   │  Warnings       │     │  🦁 Lion Rampant      │
│              │   └─────────────────┘     │  ✝️ Cross Fleury       │
│              │                           │  🦅 Eagle Displayed   │
├──────────────┴───────────────────────────┴───────────────────────┤
│  Status: Draft │ Last saved: 12s ago │ 2 warnings               │
└──────────────────────────────────────────────────────────────────┘
```

#### Interaction Model

- **Layer panel (left):** Tree view of all composition elements. Click to select, drag to reorder layers. Expand/collapse groups. Add/remove via context menu or toolbar buttons.
- **Live preview (center):** Real-time SVG rendering of the full achievement. Clicking elements on the preview selects the corresponding layer. Non-interactive otherwise (no drag-and-drop on the canvas).
- **Properties panel (right-top):** Edits for the selected layer — type, tincture, position, scale, attitude, line style, etc. All via structured controls (dropdowns, sliders, radio groups), not freeform input.
- **Charge library (right-bottom):** Searchable, filterable charge browser. Click a charge to add it to the composition. Includes a "Browse Commons" button that opens the integrated Wikimedia Commons panel.
- **Blazon output (center-bottom):** Live-updating formal blazon text generated from the current composition. Read-only. Copyable.
- **Validation panel (center-bottom):** Advisory warnings with explanations.

#### Commons Browser Integration

An in-editor panel (slide-over or modal) powered by the existing [`commons.ts`](file:///ixwiki/public/projects/ixstats/src/server/api/routers/commons.ts) tRPC router:

- Browse by category (maps to Commons' `Category:Heraldry_by_elements` tree: charges, divisions, tinctures, shields, badges, etc.)
- Search by keyword
- Filter by license (CC0/PD/CC-BY/CC-BY-SA only — see License Policy)
- Preview SVG at full resolution
- One-click "Import to Library" action that:
  1. Downloads the SVG
  2. Caches it locally (following the existing `ExternalApiCache` pattern)
  3. Creates a charge metadata record with license/attribution auto-populated
  4. Makes the charge immediately available in the editor's charge library

---

## Procedural Generation

### Gallery Mode

Users can generate multiple random compositions at once, Armoria-style:

- Click **"Generate"** to produce 6-12 candidate achievements
- Gallery displays them in a grid
- Click any candidate to load it into the full editor for refinement
- Click **"Re-roll"** on individual candidates to replace just that one

### Lore-Aware Generation

When generating arms for a nation, Vexel reads country attributes from IxStates and biases the generator:

| Country Attribute | Influence on Generation |
|---|---|
| Culture group | Charge preferences (e.g. Levantine → crescent, scimitar; Burgundian → fleur-de-lis, lion) |
| Religion | Religious charge inclusion, cross variants, relevant symbols |
| Government type | Helm type (crown for monarchies, wreath for republics), supporter conventions |
| Geography/climate | Nature-themed charges (mountains, waves, trees, fauna native to region) |
| Existing national colors | Tincture probability weighting toward nation's palette |
| Founding era | Stylistic complexity (older nations → simpler compositions) |

The generator produces structured compositions (not images), so all output is immediately editable and blazonable.

### Standalone Mode

Users without a nation can still generate arms freely — the generator falls back to generic heraldic conventions without lore biasing.

---

## Heraldic Authority Registry

A public directory of all arms in the Ixnay world, accessible at `/labs/vexel/registry` (or embedded as a tab in the Vexel tool).

Features:
- **Browse by nation** — See all arms associated with a country
- **Browse by type** — National arms, dynastic arms, institutional arms, personal arms
- **Search** — By blazon text, by charge, by tincture
- **Conflict detection** — Flag arms that are too similar to existing registered arms (advisory)
- **Public profiles** — Each registered achievement gets a permalink with its SVG rendering, blazon, attribution, and version history

This serves as both a worldbuilding resource and a game mechanic (nations have a canonical heraldic identity).

---

## Wikimedia Commons Integration

### License Policy

Only the following licenses are imported:
- **CC0** (Public Domain Dedication)
- **Public Domain** (PD-old, PD-self, PD-ineligible)
- **CC-BY** (Attribution)
- **CC-BY-SA** (Attribution-ShareAlike)

**Excluded:**
- **CC-BY-NC** (Non-Commercial) — IxStates has premium tier considerations
- **CC-BY-ND** (No Derivatives) — The editor recolors/recombines charges, which constitutes a derivative work
- Any non-free or fair-use content

### Attribution Chain

Every charge imported from Commons stores:
- `sourceUrl` — Link to the original Wikimedia Commons file page
- `author` — Original artist/uploader
- `license` — SPDX-style license identifier
- `importedAt` — Timestamp of import

When a composition uses Commons-sourced charges, the exported SVG/PNG includes a metadata attribution block listing all sources. The Heraldic Authority registry page also displays attribution.

### Caching Strategy

Following the existing pattern established by the [`commons.ts`](file:///ixwiki/public/projects/ixstats/src/server/api/routers/commons.ts) router:
- SVG assets are downloaded and cached server-side
- The editor renders from cached assets, never hitting Commons at runtime
- Cache invalidation is manual (admin-triggered re-import)
- This ensures the editor functions even if Commons is down

---

## Data Model Integration

### New Prisma Models

```
HeraldryAchievement
├── id                  String    @id @default(uuid())
├── ownerId             String    (FK → User)
├── subjectType         SubjectType  (COUNTRY | CHARACTER | INSTITUTION | DYNASTY)
├── subjectId           String?   (FK → Country, ThinkPagesAccount, etc.)
├── title               String
├── compositionData     Json      (full composition model)
├── generatedBlazon     String
├── svgUrl              String?   (cached rendered SVG)
├── thumbnailUrl        String?   (256px PNG)
├── largeUrl            String?   (1024px PNG)
├── validationWarnings  Json?     (array of warning objects)
├── isPublished         Boolean   @default(false)
├── publishedAt         DateTime?
├── createdAt           DateTime  @default(now())
├── updatedAt           DateTime  @updatedAt

HeraldryCharge
├── id                  String    @id @default(uuid())
├── name                String
├── category            ChargeCategory
├── subcategory         String?
├── keywords            String[]
├── svgData             String    (raw SVG markup)
├── supportsRecoloring  Boolean   @default(true)
├── supportsMirroring   Boolean   @default(true)
├── supportsAttitudes   Boolean   @default(false)
├── attitudes           String[]
├── defaultScale        Float     @default(1.0)
├── source              ChargeSource  (COMMONS | CUSTOM | BUNDLED)
├── sourceUrl           String?
├── author              String?
├── license             String
├── importedAt          DateTime  @default(now())

HeraldryRevision
├── id                  String    @id @default(uuid())
├── achievementId       String    (FK → HeraldryAchievement)
├── compositionData     Json
├── generatedBlazon     String
├── revisionNote        String?
├── createdAt           DateTime  @default(now())
```

### Existing Schema Integration

| Existing Field | Integration |
|---|---|
| `Country.coatOfArms` | Populate from `HeraldryAchievement.svgUrl` where `subjectType = COUNTRY` |
| `NationalIdentity.nationalSymbols` | Can reference the achievement ID for structured access |
| `Country` attributes (culture, religion, government) | Read by procedural generator for lore-aware generation |

---

## tRPC Router

New router: `src/server/api/routers/heraldry.ts` (or `heraldry/` subdirectory if it exceeds 700 lines per arch-guard rules).

### Procedures (estimated)

**Queries:**
- `heraldry.getAchievement` — Get a single achievement by ID
- `heraldry.getAchievementsBySubject` — Get all achievements for a country/character/institution
- `heraldry.getChargeLibrary` — Paginated charge library with search/filter
- `heraldry.getChargeById` — Single charge with full metadata
- `heraldry.getChargeCategories` — Available categories for filtering
- `heraldry.getRegistry` — Public registry browsing with pagination
- `heraldry.searchRegistry` — Search by blazon text, charge, tincture
- `heraldry.generateBlazon` — Generate blazon from composition (stateless)
- `heraldry.validateComposition` — Run validation on composition (stateless)
- `heraldry.getRevisionHistory` — Version history for an achievement
- `heraldry.detectConflicts` — Check similarity against registered arms

**Mutations:**
- `heraldry.saveAchievement` — Create or update an achievement
- `heraldry.publishAchievement` — Mark as published (adds to registry)
- `heraldry.unpublishAchievement` — Remove from public registry
- `heraldry.deleteAchievement` — Soft delete
- `heraldry.importCommonsCharge` — Import a charge from Wikimedia Commons
- `heraldry.generateRandom` — Procedural generation (optionally lore-aware)
- `heraldry.attachToCountry` — Link an achievement to a country record
- `heraldry.createRevision` — Save a revision snapshot

Register in [`src/server/api/root.ts`](file:///ixwiki/public/projects/ixstats/src/server/api/root.ts).

---

## Supported Heraldic Elements (v1)

### Shield Shapes
Heater (default), Kite, Round (roundel), Lozenge, Oval, Renaissance, Pointed

### Field Divisions
Plain, Per Pale, Per Fess, Per Bend, Per Bend Sinister, Quarterly, Gyronny, Per Saltire, Per Chevron, Tierced in Pale, Tierced in Fess, Barry, Paly, Bendy, Checky, Lozengy, Chevronny

### Division Line Styles
Straight, Engrailed, Invected, Wavy, Nebuly, Indented, Dancetty, Embattled, Dovetailed, Potenty, Raguly, Urdy

### Ordinaries
Chief, Fess, Pale, Bend, Bend Sinister, Chevron, Saltire, Cross, Bordure, Canton, Pile, Orle, Tressure, Pall, Gyron, Lozenge (ordinary)

### Tinctures

**Metals:** Or (gold), Argent (silver)

**Colours:** Gules (red), Azure (blue), Vert (green), Purpure (purple), Sable (black)

**Furs:** Ermine, Vair, Counter-Ermine, Counter-Vair, Erminois, Pean

**Stains (optional):** Tenné (orange-tawny), Sanguine (blood red), Murrey (mulberry)

### Charge Attitudes (for animate charges)
Rampant, Passant, Sejant, Couchant, Dormant, Salient, Statant, Guardant, Reguardant, Displayed (birds), Rising (birds), Volant (birds), Naiant (fish), Hauriant (fish)

### External Ornament Types

**Helms:** Great Helm, Tilting Helm, Barrel Helm, Open-faced Helm
**Crest:** Any charge from library, placed on wreath/torse
**Mantling:** Configurable exterior/interior tinctures
**Supporters:** Pair of charges flanking the shield
**Motto:** Text on scroll, configurable position (above/below)
**Compartment:** Ground/base element (optional)

---

## Requirements

### P0 — Must-Have (v1 Launch)

| # | Requirement | Acceptance Criteria |
|---|---|---|
| P0-1 | Panel-based structured editor with layer tree, live SVG preview, and properties panel | User can compose a multi-element achievement entirely from structured controls; clicking preview elements selects the corresponding layer |
| P0-2 | Full achievement composition (shield + helm + crest + mantling + supporters + motto + compartment) | All external ornament types can be added and configured through the properties panel |
| P0-3 | Charge library seeded from curated Wikimedia Commons imports | Only CC0/PD/CC-BY/CC-BY-SA sources; each entry stores source URL, author, license |
| P0-4 | Integrated Commons browser panel | Users can search/browse Commons heraldry categories, preview SVGs, and import charges with one click |
| P0-5 | Local cache for imported/library assets | Editor renders with zero live dependency on Commons at runtime |
| P0-6 | Automatic blazon generation (composition → text) | Live-updating blazon output in the editor; grammatically correct English heraldic blazon |
| P0-7 | Rule-of-tincture advisory check | Non-blocking warning when metal-on-metal or colour-on-colour occurs |
| P0-8 | Lore-aware procedural generation (gallery mode) | User can generate 6-12 random achievements; optionally influenced by their nation's attributes |
| P0-9 | Save/attach arms to a Country | SVG + blazon saved and linked to `Country.coatOfArms`; composition data persists for re-editing |
| P0-10 | Attribution display on export | Exported SVG/PNG includes credit line for Commons-sourced charges |
| P0-11 | SVG and PNG export | Both vector (SVG) and raster (PNG at configurable resolution) export |
| P0-12 | Heraldic Authority registry (basic) | Public listing of published arms, browseable by nation/type |
| P0-13 | Revision history | Saving creates a revision snapshot; users can view and revert to prior compositions |
| P0-14 | Autosave (15s debounce) | Matches platform-wide autosave pattern; protects long editing sessions |

### P1 — Nice-to-Have

| # | Requirement | Notes |
|---|---|---|
| P1-1 | Charge search/filter by category, keyword, attitude | Faceted search in the charge library panel |
| P1-2 | Achievement templates (Kingdom, Republic, Noble House, Military Order, etc.) | Pre-built starting compositions, fully editable |
| P1-3 | Public gallery / browse other users' published arms | Social/discovery layer beyond the registry |
| P1-4 | PNG raster export matching `artworkVariants` pattern | Enables reuse as IxCards artwork |
| P1-5 | Keyboard shortcuts for common editor actions | Power-user productivity |
| P1-6 | Arms conflict detection in registry | Advisory similarity check against registered arms |
| P1-7 | Character/ThinkPages personal heraldry | Save/attach arms to individual characters |

### P2 — Future Considerations

| # | Idea | Why Deferred |
|---|---|---|
| P2-1 | Marshalling / combined arms (impalement, quartering) | Complexity jump; strong v2 differentiator |
| P2-2 | Blazon text → composition parsing | Materially harder than generation |
| P2-3 | Diplomatic/relational heraldry (arms referencing other nations) | Depends on marshalling |
| P2-4 | Multiple rendering styles (Medieval, Victorian, Engraved, etc.) | Art asset investment; v1 ships one style |
| P2-5 | Corporate/Mercatus heraldry | Depends on Mercatus scope |
| P2-6 | IxCredits-gated premium charges | No monetization decision yet |
| P2-7 | User-submitted custom charge uploads (moderated) | Needs moderation pipeline |
| P2-8 | Institutional heraldry (universities, guilds, orders) | Depends on institutional subject model |
| P2-9 | Admin curation tool for bulk Commons importing | Separate from editor; for library seeding |
| P2-10 | Cadency marks (birth order differentiation) | Niche heraldic feature |

---

## Integration Map

| System | Integration |
|---|---|
| **Country.coatOfArms** | Vexel-produced arms populate this field (SVG URL) |
| **NationalIdentity** | Achievement ID stored for structured access to composition data |
| **Commons.ts router** | Extended or composed with for the integrated Commons browser |
| **ExternalApiCache** | Commons SVG assets cached through existing infrastructure |
| **IxCards artwork** | P1 — matching `artworkVariants` shape for card artwork reuse |
| **Builder** | Link out to "Create your coat of arms in Vexel" during identity setup |
| **MyCountry** | Display coat of arms on the executive dashboard |
| **IxWiki** | Render arms in wiki article infoboxes; blazon text in article body |
| **ThinkPages** | P1 — Personal heraldry on user profiles |
| **Autosave system** | Reuse platform-wide 15s-debounce pattern |
| **Labs layout** | Use existing headless-nav pattern from `/labs/layout.tsx` |

---

## Route Structure

```
/labs/vexel                    — Editor landing / new achievement
/labs/vexel/[id]               — Edit existing achievement
/labs/vexel/[id]/preview       — Public preview / share link
/labs/vexel/registry           — Heraldic Authority registry
/labs/vexel/registry/[id]      — Single achievement public page
/labs/vexel/generate           — Standalone procedural generation gallery
```

---

## Success Metrics

### Leading (weeks)
- % of active nation-owners who create at least one achievement
- Median time to complete a first composition
- Charge library size at launch and import success rate from Commons
- Gallery-to-editor conversion rate (how often generated arms get refined)

### Lagging (months)
- % of `Country.coatOfArms` fields populated via Vexel vs. left blank
- Repeat-edit rate (do people come back and refine)
- Registry growth (total published arms over time)
- Blazon accuracy — spot-check generated blazons against manual review

---

## Open Questions

| # | Question | Who Answers | Blocking? |
|---|---|---|---|
| OQ-1 | What's the owner entity for character/personal arms — ThinkPages account, wiki lore character page, or standalone Vexel record? | Jared (product) | No (P1 feature) |
| OQ-2 | Is "Vexel" the final name? Should it follow the `Ix-` convention (e.g. IxHeraldry) or stay as a distinct Labs brand? | Jared | No |
| OQ-3 | Should the charge library ship with a minimum seed count target? (e.g. 100+ charges at launch) | Jared/Engineering | Yes — for launch quality |
| OQ-4 | Does the blazon generator need to support non-English heraldic traditions (French, German)? Or English-only for v1? | Jared | No — English-only assumed |
| OQ-5 | Should procedural generation be available to anonymous/non-authenticated users as a discovery tool? | Jared | No |
| OQ-6 | What level of similarity constitutes a "conflict" in the registry? Exact match only, or fuzzy similarity? | Engineering | No (P1 feature) |

---

## Phasing

**Phase 1 (P0):** Panel-based editor, full achievement composition, charge library + Commons browser, blazon generator, validation engine, procedural generation (lore-aware), save-to-country, SVG/PNG export, basic registry, revision history, autosave, attribution.

**Phase 2 (P1):** Faceted charge search, achievement templates, public gallery, IxCards artwork integration, keyboard shortcuts, conflict detection, character/personal heraldry.

**Phase 3 (P2):** Marshalling, blazon parsing, diplomatic heraldry, rendering style packs, corporate heraldry, monetization, user-submitted charges, institutional heraldry, admin curation tool, cadency.

---

## Versioning

Per the [Versioning & Release Architecture](file:///ixwiki/public/projects/ixstats/docs/reference/revision.md), Vexel will receive a **capability integer** in the Version Registry at [`src/lib/buildVersion.ts`](file:///ixwiki/public/projects/ixstats/src/lib/buildVersion.ts) (e.g. `VEXEL_VERSION = 1`) once implementation begins. The platform minor version bumps when Vexel ships.

---

## Appendix A: Future Vision — The Heraldic Engine

> *This section describes the long-term vision for Vexel beyond v1. It is not in scope for initial implementation but informs architectural decisions that should not foreclose these possibilities.*

### Dynastic Inheritance
Arms should be able to evolve through dynastic succession — a new monarch inherits the family's base arms but may add cadency marks, quarter in new territories, or adopt a modified crest. The composition model's JSON structure should support this kind of derivation (base composition + delta).

### Marshalling
Impalement (side-by-side arms for marriages/alliances), quartering (four-way split for combined claims), and dimidiation (halving charges) are core heraldic operations that Ixnay's diplomatic worldbuilding naturally calls for. The composition model should not preclude a `quarters[]` array at the shield level.

### Institutional Heraldry
Universities, religious orders, military orders, guilds, and other institutions all develop heraldic identities. The `subjectType` enum should be designed to extend without migration.

### Rendering Style Packs
The same composition rendered in Medieval, Renaissance, Victorian, Modern, Engraved, Illuminated Manuscript, Flat, or Government Publication styles. The renderer should accept a style parameter without changing the composition data.

### Procedural Worldbuilding Integration
Arms could be procedurally generated for NPC nations, historical dynasties, and lore characters as part of the broader worldbuilding simulation. The generation engine should be callable server-side without an editor UI.

### Full Heraldic Achievement Components
Beyond v1's set: Pavilion/mantling (royal canopy), Order collars and chains, Ecclesiastical hats and tassels, Coronets of rank, Augmentations of honour. Each requires both a composition model extension and a renderer capability.

---

## Appendix B: Wikimedia Commons Category Map

Key Commons categories for charge library seeding:

| Commons Category | Vexel Charge Category | Approx. Assets |
|---|---|---|
| `Category:Coat_of_arms_elements` (13 subcats) | Various | 37 files + subcats |
| `Category:Heraldic_divisions` (53 subcats) | Field divisions reference | 22 files + subcats |
| `Category:Heraldic_tinctures` (14 subcats) | Tincture reference | 38 files |
| `Category:Heraldic_shields` (14 subcats) | Shield shapes | 23 files |
| `Category:Heraldic_badges` (17 subcats) | Badges / charges | 50 files |
| `Category:Heraldic_external_ornaments` (23 subcats) | Helms, crests, mantling, supporters | 16 files + subcats |
| `Category:Heraldic_quarters` (1 subcat) | Quartering reference | 32 files |
| `Category:Heraldic_templates` (4 subcats) | Templates / blanks | 15 files |
| `Category:Animals_in_heraldry` (deep tree) | Animals, Birds, Fish | Thousands |
| `Category:Plants_in_heraldry` (deep tree) | Plants, Trees, Flowers | Hundreds |
| `Category:Objects_in_heraldry` (deep tree) | Weapons, Buildings, Objects | Hundreds |

The integrated Commons browser can traverse these categories for users to discover and import charges.

---

*This PRD defines what Vexel v1 is and why it exists. The next document is the engineering specification: composition JSON schema, Prisma models, renderer pipeline, layout algorithms, blazon grammar rules, tRPC procedures, and UI component architecture.*
