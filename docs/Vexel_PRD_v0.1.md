# 🛡️ Vexel — Heraldry & Symbol Generator

**Codename:** VEXEL
**Version:** v0.1 (Draft)
**Status:** 🟡 Draft — Pre-Scoping
**Date:** July 14, 2026
**Product Family:** IxLabs (standalone tools suite)

---

## 📋 Overview

Vexel is a coat-of-arms / heraldic symbol generator and editor for the Ixnay/IxStates ecosystem, living in **IxLabs** — a suite of standalone tools distinct from the core IxStats surfaces (`/mycountry`, `/vault`, `/builder`). It lets nation-owners and worldbuilders compose original heraldic achievements from a structured library of charges, ordinaries, and tinctures, and automatically produces a proper blazon (the formal written heraldic description) from whatever they build.

It's inspired by [heraldicon.org](https://heraldicon.org/) (structured composition + blazon generation) and [Armoria](https://github.com/Azgaar/Armoria) (lightweight SVG-based charge assembly), but sources a meaningful chunk of its charge library from curated, license-tracked imports off [Wikimedia Commons' heraldry categories](https://commons.wikimedia.org/wiki/Category:Heraldry_by_elements) rather than building every charge from scratch.

**Problem it solves:** Right now, nations and characters in Ixnay either go without a coat of arms, commission one manually (slow, inconsistent quality, no one canonical source), or free-hand an SVG with no grounding in heraldic convention. There's no in-house tool that produces a properly composed *and* properly described armorial achievement, and no reusable charge library to draw from.

---

## 🎯 Goals

1. Let a user compose a heraldically-plausible coat of arms in a guided editor without needing to know heraldic terminology going in.
2. Automatically generate a correct, readable blazon (text description) from any composition the user builds — this is the differentiator, not just another SVG editor.
3. Stand up a growing, license-clean charge library seeded from Wikimedia Commons, cached locally so the editor never depends on live Commons uptime.
4. Produce output that plugs cleanly into existing IxStats data (`Country.coatOfArms`, `NationalIdentity` symbol fields) without requiring schema gymnastics later.
5. Support both **national** arms and **individual/character** arms as first-class subjects in v1.

## 🚫 Non-Goals (v1)

- **Corporate/Mercatus arms.** Companies aren't in scope yet — revisit once Mercatus company identity needs are clearer; the data model shouldn't actively block it, but it's not being built now.
- **Blazon text → composition parsing.** Generating blazon *from* a composition is P0; parsing a hand-written blazon string back into a rendered image (what Armoria attempts) is a materially harder NLP-adjacent problem and is out of scope for v1.
- **Marshalling / combined arms** (impalement, quartering for marriages, successions, alliances). Very on-brand for Ixnay's dynastic worldbuilding, but it's a real complexity jump — flagged as a strong P2 candidate, not a v1 feature.
- **Freeform vector drawing tools.** Vexel is not a general SVG editor (no arbitrary bezier drawing). Everything is built from library primitives — that constraint is what keeps compositions heraldically valid and blazonable.
- **Full historical accuracy enforcement.** The rule of tincture and similar conventions are advisory, not enforced — see Editor Paradigm below. This isn't a heraldic-authority certification tool.

---

## 🧩 Core Heraldic Model

The editor's rule engine and the blazon generator both need to operate on the same structured representation. A composition is:

- **Field** — shield shape + division (plain, per fess, per pale, per bend, quarterly, etc.) + a tincture per division
- **Ordinaries** — chief, fess, pale, bend, chevron, cross, saltire, bordure, etc., each with a tincture and a line style (straight, engrailed, indented, wavy, nebuly, etc.)
- **Charges** — placed on the field or on an ordinary, each with position, count, tincture, size, and (for animate charges) attitude/orientation (e.g., "rampant," "passant," "displayed")
- **Tinctures** — the two metals (or, argent), five colors (gules, azure, vert, purpure, sable), and two furs (ermine, vair)
- **Rule of tincture check** — flags metal-on-metal or color-on-color placement as a warning, non-blocking

This structured model is the thing that makes blazon generation tractable: the blazon generator is a rules-based renderer over this data, not a free-text system.

---

## 🖼️ Requirements

### P0 — Must-Have

| # | Requirement | Acceptance Criteria |
|---|---|---|
| P0-1 | Hybrid composition editor: pick field shape/division/tincture, add ordinaries, add/position charges from the library | User can produce a multi-element composition entirely from library primitives; no freeform drawing required |
| P0-2 | Charge library seeded from curated Wikimedia Commons imports, license-filtered | Only CC0, Public Domain, CC-BY, and CC-BY-SA sources are imported (see Open Questions on NC/ND exclusion); each entry stores source URL, author, and license |
| P0-3 | Local cache layer for imported/library assets | Editor renders and functions with zero live dependency on Commons at runtime, following the existing `wiki-commons-flag-service` caching pattern |
| P0-4 | Automatic blazon generation from composition (composition → text) | Given any valid composition, the system emits a grammatically correct English blazon string using standard heraldic terms |
| P0-5 | Rule-of-tincture advisory check | Composition editor shows a non-blocking warning when metal-on-metal or color-on-color occurs |
| P0-6 | Save/attach arms to a Country | Produced arms (SVG + blazon) can be saved and linked to `Country.coatOfArms`; re-editable later (composition data persists, not just the rendered image) |
| P0-7 | Save/attach arms to an individual/character subject | See Open Questions — subject model needs to be defined before this is buildable |
| P0-8 | Attribution display on export | Any exported/embedded arms that include Commons-sourced charges show a visible credit line per license requirements |

### P1 — Nice-to-Have

| # | Requirement | Notes |
|---|---|---|
| P1-1 | PNG raster export (thumbnail + large), mirroring the `artworkVariants` pattern used by IxCards | Enables reuse as card artwork later without a second export pipeline |
| P1-2 | Autosave during editing (15s debounce, matching the platform-wide autosave pattern) | Protects long compositional sessions from data loss |
| P1-3 | Charge search/filter by category (beast, ordinary, celestial, plant, etc.) | Commons' own heraldry-by-elements category structure maps naturally to this |
| P1-4 | Version history for a given coat of arms (reuse `AutosaveHistory`-style pattern) | Lets a user revert to a prior composition |
| P1-5 | Public gallery / browse other users' published arms | Social/discovery layer, not required for core utility |

### P2 — Future Considerations

| # | Idea | Why it's deferred |
|---|---|---|
| P2-1 | Marshalling / combined arms (impalement, quartering) | Real complexity jump; strong differentiator for a v2 |
| P2-2 | Blazon text → composition parsing | Materially harder than generation; revisit once P0-4 is proven out |
| P2-3 | Corporate/Mercatus arms | Depends on Mercatus company-identity scope maturing |
| P2-4 | IxCredits-gated premium charges | No monetization decision made yet — see Open Questions |
| P2-5 | User-submitted custom charges (moderated) | Needs a moderation pipeline; not core to launch |

---

## 🔗 Integration Map

| System | Integration |
|---|---|
| `Country.coatOfArms` (existing field) | Vexel-produced arms populate this; likely needs a companion structured field (e.g., `coatOfArmsData` JSON) alongside the flat URL so arms stay re-editable rather than write-only |
| `NationalIdentity.nationalSymbols` / `flagMetadata` | Precedent for storing symbol-related JSON blobs on identity records; Vexel arms data can follow the same shape |
| Wiki Commons / `wiki-commons-flag-service` | Direct architectural precedent for the caching + import pattern Vexel needs for its charge library |
| `ExternalApiCache` | Generic caching layer already used for MediaWiki/image content; Vexel's Commons imports should likely ride on this rather than inventing a new cache table |
| IxCards `artwork` / `artworkVariants` | If arms ever become card artwork, matching this shape avoids a second export pipeline (see P1-1) |
| Builder (national identity step) | Not the primary home (Vexel lives in IxLabs per your answer), but the builder should be able to link out to / embed a picker for "create your coat of arms in Vexel" — exact integration TBD |
| Autosave system | P1 — reuse the existing 15s-debounce autosave pattern rather than building a bespoke one |

---

## 📊 Success Metrics

*(Draft — needs your input; placeholders below follow the platform's usual leading/lagging split)*

**Leading (weeks):**
- % of active nation-owners who create at least one coat of arms
- Median time to complete a first composition
- Charge library size at launch (target TBD) and import success rate from Commons

**Lagging (months):**
- % of `Country.coatOfArms` fields populated via Vexel vs. left blank
- Repeat-edit rate (do people come back and refine, or one-and-done)

---

## ❓ Open Questions

| # | Question | Who answers | Blocking? |
|---|---|---|---|
| OQ-1 | What's the "owner" entity for individual/character arms — a ThinkPages account, a wiki lore character page, or a standalone Vexel-only record with no other system tie? This blocks P0-7. | Jared (product) | **Yes** |
| OQ-2 | Should Commons imports exclude NC (non-commercial) licenses given IxStats has a paid premium tier, and ND (no-derivatives) licenses given the editor lets users recolor/recombine charges (which is a derivative work)? My recommendation is to exclude both and import only CC0/PD/CC-BY/CC-BY-SA. | Jared (product/legal judgment call) | Recommend deciding before P0-2 build starts |
| OQ-3 | Is "Vexel" the final name, or still open for a naming pass (matching the dual `Ix-`/`My-` convention used elsewhere, e.g. a canonical `IxHeraldry` charge catalog feeding a `Vexel` editor)? | Jared | No |
| OQ-4 | Monetization: any IxCredits-gated premium charges/features, or fully free like the rest of core gameplay? | Jared | No — can launch free and add later |
| OQ-5 | Does IxLabs already have an established shell/nav pattern (like `VaultRouter`), or does Vexel establish the first one? | Engineering | **Yes**, for accurate P0 scoping of the shell itself |
| OQ-6 | Export target resolution/format requirements for embedding in wiki articles (IxWiki uses MediaWiki infoboxes with flag/image fields) — any existing constraints Vexel needs to match? | Jared/Engineering | No |

---

## 🗓️ Phasing

**Phase 1 (P0):** Composition editor, seeded/cached charge library, blazon generation, save-to-Country, attribution display, rule-of-tincture advisory. Individual/character arms blocked on OQ-1.

**Phase 2 (P1):** Raster export, autosave, version history, charge search/filter, public gallery.

**Phase 3 (P2):** Marshalling, blazon parsing, corporate arms, monetization, user-submitted charges.

---

*This is a v0.1 scoping draft. Next step once OQ-1 and OQ-5 are resolved: lock P0 scope and move to a full house-format spec with detailed acceptance criteria per requirement.*


# 🛡️ Vexel — Heraldic Engine & Identity System

**Codename:** VEXEL
**Version:** v1.0 (Foundation PRD)
**Status:** 🟢 Product Definition
**Date:** July 14, 2026
**Product Family:** IxLabs

---

# Overview

Vexel is the official heraldic identity system for the IxStates ecosystem.

Rather than functioning as a traditional SVG editor, Vexel is a structured **Heraldic Engine** capable of composing, validating, rendering, and describing heraldic achievements from a canonical data model. Every coat of arms created within Vexel exists as structured heraldic data—not merely an image—allowing it to be edited indefinitely, validated against heraldic conventions, rendered in multiple artistic styles, automatically described through formal blazon, and reused throughout the IxStates platform.

The editor itself is only one interface to the engine. Builder, MyCountry, IxWiki, APIs, procedural generators, and future tools all interact with the same underlying heraldic model.

Vexel serves as the canonical source of truth for national, institutional, and personal heraldry across the Ix ecosystem.

---

# Product Vision

Every nation develops symbols.

Every dynasty develops traditions.

Every institution develops identity.

Vexel provides the infrastructure that allows those identities to evolve naturally throughout the lifetime of a world.

Instead of treating coats of arms as static images, Vexel treats heraldry as living structured data.

A shield created today should still be editable, versioned, procedurally expandable, and historically traceable decades later.

---

# Product Principles

## Structured First

Images are generated from data.

Never the other way around.

---

## Engine Before Editor

The editor is simply one client of the Heraldic Engine.

Builder, APIs, procedural generators, and future systems all consume the same engine.

---

## Historically Inspired, Not Historically Restricted

Vexel follows established heraldic conventions whenever practical while remaining flexible enough to support fictional cultures and worldbuilding.

Warnings are preferred over restrictions.

---

## Deterministic

The same composition always produces the same:

* SVG
* PNG
* Blazon
* Validation results

---

## Extensible

The engine should comfortably support future additions including:

* full heraldic achievements
* marshalling
* cadency
* dynastic inheritance
* institutional heraldry
* procedural generation

without redesigning the underlying model.

---

# Goals

1. Create heraldically plausible coats of arms through guided composition.
2. Generate proper English blazons automatically.
3. Establish a reusable heraldic engine used across IxStates.
4. Build a curated, license-compliant charge library.
5. Store heraldry as structured data rather than images.
6. Support procedural generation.
7. Support long-term version history.
8. Produce publication-quality SVG and raster exports.

---

# Non-Goals (v1)

* Freeform vector illustration
* Manual Bézier editing
* Blazon parsing
* Marshalling
* Cadency
* Corporate heraldry
* User-submitted charge uploads
* AI-generated artwork

---

# System Architecture

```
                Composition Model
                        │
          ┌─────────────┴─────────────┐
          │                           │
 Validation Engine            Layout Engine
          │                           │
          └─────────────┬─────────────┘
                        │
                  SVG Renderer
                        │
      ┌─────────────────┼─────────────────┐
      │                 │                 │
 Blazon Generator   PNG Export     API Output
```

Every interface interacts only with the Heraldic Engine.

The editor never manipulates SVG directly.

---

# Core Components

## 1. Composition Engine

The canonical representation of every heraldic achievement.

Responsible for:

* field definitions
* ordinaries
* charges
* tinctures
* positioning
* hierarchy
* layering

This data model is the permanent source of truth.

---

## 2. Validation Engine

Evaluates a composition against heraldic conventions.

Validation never blocks editing.

Instead, it produces advisory warnings.

Examples include:

* Rule of Tincture
* excessive overlap
* conflicting charge placement
* unsupported combinations
* unconventional arrangements
* scaling warnings
* empty divisions

The philosophy is guidance rather than enforcement.

---

## 3. Layout Engine

Responsible for automatic spatial arrangement.

Tasks include:

* scaling
* alignment
* collision avoidance
* spacing
* charge grouping
* symmetry
* division-aware positioning

Rendering never determines placement.

Placement is determined before rendering begins.

---

## 4. SVG Renderer

Transforms the normalized composition into deterministic SVG.

Supports:

* scalable rendering
* multiple shield shapes
* multiple artistic styles
* future renderer implementations

---

## 5. Blazon Generator

Produces formal English blazons directly from the composition model.

Because the composition is structured, blazon generation is entirely deterministic.

No AI or language model is required.

Future localization may support additional heraldic traditions.

---

## 6. Export Pipeline

Outputs:

* SVG
* PNG
* Thumbnail
* Print Resolution
* Wiki-ready artwork
* API payloads

All exports originate from the same canonical composition.

---

# Heraldic Composition Model

A heraldic achievement consists of:

```
Achievement

├── Shield
│   ├── Shape
│   ├── Field
│   ├── Divisions
│   ├── Tinctures
│   ├── Ordinaries
│   └── Charges
│
├── Metadata
├── Attribution
├── Version History
└── Rendering Preferences
```

---

# Charge Library

Charges are reusable heraldic concepts.

They are not SVG files.

A charge may have multiple visual assets.

Example:

```
Lion Rampant

↓

Medieval Style
Modern Style
Outline Style
Engraved Style
```

This allows artistic styles to evolve without changing compositions.

---

# Charge Metadata

Every charge stores:

* ID
* Name
* Category
* Subcategory
* Keywords
* Description
* Historical Origin
* Heraldic Family
* SVG Assets
* License
* Attribution
* Source URL
* Author
* Supports Recoloring
* Supports Mirroring
* Supports Rotation
* Supports Attitudes
* Default Scale
* Default Orientation
* Recommended Placement

---

# Charge Categories

Initial taxonomy:

* Animals
* Mythical Creatures
* Birds
* Fish
* Insects
* Plants
* Trees
* Flowers
* Celestial
* Weapons
* Buildings
* Crowns
* Religious
* Maritime
* Agricultural
* Geometric
* Human Figures
* Objects
* Letters
* Numbers
* Miscellaneous

Categories remain data-driven and expandable.

---

# Asset Library

Artwork is stored independently of heraldic concepts.

```
Charge

↓

Asset A

Asset B

Asset C
```

Future artists may contribute additional rendering styles without replacing existing assets.

---

# Supported Heraldic Elements

## Fields

* Plain
* Per Pale
* Per Fess
* Per Bend
* Per Bend Sinister
* Quarterly
* Gyronny
* Tierced
* Chevronny
* Lozengy
* Checky
* Barry
* Paly
* Bendy

---

## Ordinaries

* Chief
* Fess
* Pale
* Bend
* Chevron
* Saltire
* Cross
* Bordure
* Canton
* Pile
* Orle
* Tressure

---

## Tinctures

Metals

* Or
* Argent

Colours

* Gules
* Azure
* Vert
* Purpure
* Sable

Furs

* Ermine
* Vair

Support for stains and additional traditions may be added later.

---

# Procedural Generation

Procedural heraldry is a core capability.

Users may generate arms from:

* government
* culture
* religion
* geography
* climate
* founding era
* dynasty
* national values
* military tradition
* economy

The engine produces several candidate achievements rather than one fixed design.

Procedural output remains fully editable.

---

# Templates

Users may begin from templates including:

* Kingdom
* Empire
* Republic
* Duchy
* Noble House
* Merchant Guild
* Military Order
* University
* Religious Institution
* Province
* City

Templates establish starting layouts while remaining completely editable.

---

# Rendering Styles

Future rendering packs may include:

* Medieval
* Renaissance
* Victorian
* Modern
* Engraved
* Illuminated Manuscript
* Flat
* Government Publication

Changing style never alters heraldic data.

Only presentation.

---

# Data Model

Each achievement stores:

* UUID
* Owner
* Subject Type
* Composition JSON
* Generated Blazon
* SVG
* Thumbnail
* Attribution
* Validation Results
* Created
* Updated
* Published Version
* Revision History

---

# Integrations

## MyCountry

National coats of arms.

---

## Builder

Identity creation during nation setup.

---

## IxWiki

Infobox artwork and blazon embedding.

---

## National Identity

National symbols.

---

## ThinkPages

Personal heraldry.

---

## Future

Institutions

Military units

Guilds

Religious organizations

Universities

Dynasties

---

# Requirements

## P0

* Structured heraldic editor
* Canonical composition model
* Validation engine
* Layout engine
* SVG renderer
* Blazon generator
* Local charge library
* Commons importer
* License tracking
* Attribution
* Country integration
* Re-editable compositions
* SVG export
* PNG export

---

## P1

* Version history
* Public gallery
* Autosave
* Search
* Filters
* Random generation
* Template library
* Multiple rendering styles
* Character integration

---

## P2

* Full heraldic achievements
* Crests
* Helmets
* Mantling
* Mottoes
* Supporters
* Compartments
* Cadency
* Marshalling
* Institutional heraldry
* Corporate heraldry
* Community charge submissions
* Blazon parsing

---

# Success Metrics

## Adoption

* Percentage of countries using Vexel
* Percentage of identity records containing heraldry
* Number of achievements created

## Quality

* Median time to first completed shield
* Percentage of users publishing generated arms
* Average revisions per achievement

## Ecosystem

* Number of Builder launches into Vexel
* Number of IxWiki articles embedding Vexel output
* Procedural generation usage
* Charge library growth

---

# Long-Term Vision

Vexel is intended to become the definitive heraldic infrastructure for IxStates.

As the world evolves, heraldry should evolve with it.

Future generations of nations, dynasties, institutions, universities, military orders, guilds, religious organizations, and characters should all derive their visual identities from the same structured engine.

The ultimate goal is not merely to create coats of arms, but to establish a persistent system of symbolic identity that can grow alongside the history of the world itself.

By treating heraldry as structured data rather than static artwork, Vexel becomes a foundational service that supports procedural worldbuilding, historical continuity, and visual identity across the entire Ix ecosystem.

This is intentionally a **v1.0 foundation PRD**. The next step I'd take would be a **v1.1 engineering specification** that drills into implementation details: the JSON composition schema, Prisma models, renderer pipeline, Commons ingestion service, layout algorithms, blazon grammar rules, validation rule sets, API endpoints, and UI/UX flows. That document would be substantially more technical and serve as the implementation blueprint.
I think this is the point where we should split the documentation, just as you've done with **MyCountry**, **Onoma**, and the **Intent Engine**.

The foundation PRD answers **what** Vexel is and **why** it exists. The engineering specification answers **exactly how it will be built**.

I would make this engineering spec roughly **30–50 pages**. It would be closer to a software architecture document than a PRD and would include:

* Complete system architecture diagrams
* Component boundaries and responsibilities
* Full Prisma database schema
* Canonical heraldic composition JSON schema
* Charge library schema and taxonomy
* Commons ingestion pipeline
* SVG asset pipeline
* Layout engine algorithms
* Validation engine rules
* Blazon grammar engine
* Rendering engine
* Export pipeline
* API endpoints
* tRPC procedures
* Permission model
* Autosave/versioning
* Caching strategy
* Search indexing
* UI state architecture
* Performance targets
* Testing strategy
* Future extension points

That document would easily exceed ChatGPT's maximum response size in a single message. Rather than compressing it into an incomplete artifact, the best approach is to build it as a series of sections that together form one canonical engineering spec.

A logical breakdown would be:

1. **Architecture & System Design**
2. **Data Models (Prisma + JSON Schemas)**
3. **Rendering, Layout & Blazon Engines**
4. **Backend Services, APIs & Asset Pipeline**
5. **Frontend Architecture & Editor UX**
6. **Performance, Security, Testing & Deployment**

That results in a complete implementation document comparable to an internal engineering design doc at a software company, without having to omit major technical details due to message length.
