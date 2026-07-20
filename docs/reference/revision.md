# IxStates Versioning & Release Architecture

**Status:** Draft v2
**Last Updated:** July 2026

---

# Philosophy

IxStates is not a traditional web application.

It is a persistent worldbuilding and nation-simulation platform composed of multiple integrated apps, simulation engines, feature systems, and infrastructure layers.

Versioning exists to communicate:

1. Platform evolution
2. App & system maturity
3. Simulation capability
4. Data compatibility
5. Build reproducibility

The platform follows an **operating-system-inspired version model** rather than a conventional SaaS release model.

---

# Core Principles

## 1. Significant Components Have Independent Versions

The platform is one product, but several of its components evolve on their own timelines and therefore carry their own version histories.

A component earns an independent version only if it can **ship and break independently** — its own surface area, its own capability story a user would notice. Components that don't meet that bar **inherit the platform version**.

The components with independent versions are:

- **Apps** — IxWorld, WikiOS, IxVault
- **Engines** (internal simulation cores) — MyCountry, Concord, Atlas
- **UI / Feature Systems** — MyCountry, Builder, ThinkPages, Achievements, Stash, Repository, Halo, Onoma
- **Design system** — Facet

Each evolves independently. A major **Concord** release does not require a major **WikiOS** release.

### What does NOT version independently

These inherit the platform version (they do not carry their own number):

- **IxForum** — folded into the platform version until it is promoted to an App
- **Platform Utilities** — IxTime, IxnayID
- **Experimental / Labs** — Vexel, Strata, Dynas, Nomora (carry a `preview` label only)
- **Navigation Hubs** — Dashboard, Explore/Countries, Feed

> **Note:** "IxWiki" is retired as a component name — it was only our name for the wiki, which is the **WikiOS** app. "Canvas" is not a top-level component; it is a **WikiOS sub-system** that carries a sub-version under WikiOS.

---

## 2. Platform Versions Represent OS Levels

Platform versions are treated as platform epochs.

Example:

```text
IxStates 1.2 Ogma
IxStates 2.0 Seshat
IxStates 3.0 Thoth
```

Platform versions represent major architectural and ecosystem milestones:

- New application architecture
- Core platform rewrites
- Fundamental data-model changes
- Major ecosystem expansion

Platform versions should be rare.

Expected cadence:

- 12–36 months

---

## 3. Release Names Are Permanent

Release names are not temporary codenames. They are part of the public identity of the platform.

```text
IxStates 1.1 Ogma
IxStates 2.0 Seshat
IxStates 3.0 Thoth
```

Release names remain attached to the version forever.

---

## 4. Channels Describe Stability

Channels indicate deployment maturity. Channels are **independent from version numbers**.

Available channels:

```text
Developer
Alpha
Beta
Release Candidate
Stable
```

Examples:

```text
IxStates 1.1 Ogma Alpha
IxStates 1.1 Ogma Beta
IxStates 1.1 Ogma RC1
IxStates 1.1 Ogma Stable
```

---

# Platform Versioning

The **platform** is the only component that uses a full SemVer triple plus a permanent release name and a channel.

## Format

```text
Major.Minor.Patch  +  Release Name  +  Channel
```

Example:

```text
1.1.0  Ogma  Alpha
```

> **Legacy note:** Earlier internal numbering (`1.42`, `2.1`) is retired. The platform resets to **`1.0 Ogma`** as the public baseline.

## Major Versions

Platform-wide architectural shifts:

- New rendering architecture
- New API architecture
- New persistence layer
- Major platform redesign
- Cross-system infrastructure rewrite

```text
1.0 → 2.0
```

## Minor Versions

Significant platform improvements:

- New integrated app
- Major subsystem overhaul
- Significant feature expansion
- Large refactor

```text
1.2 → 1.3
```

## Patch Versions

- Bug fixes
- Performance improvements
- Small enhancements
- Stability updates

```text
1.3.1 → 1.3.2
```

---

# Component Versioning (Single Integer)

Apps, Engines, Systems, and the Design system each carry a **single monotonic capability integer** — not a SemVer triple.

```text
WikiOS 2
MyCountry 4
Concord 3
Facet 1
```

**Rule:** a component's integer increments only on a **user-noticeable capability leap**. Bug fixes, perf, and small enhancements ride the **platform patch** and the **build identifier** — they do not bump component integers. This keeps the per-component numbers stable and resistant to drift.

---

## App Versioning

Apps are integrated products with their own brand identity that ship and break independently.

Apps:

- **IxWorld** (maps)
- **WikiOS** (wiki software — also powers the IxWiki content)
- **IxVault** (wallet / economy / trading cards)

```text
IxStates 1.0 Ogma

IxWorld 1
WikiOS 1
IxVault 1
```

> **Canvas** (visual wiki editor) is a WikiOS sub-system and carries a sub-version under WikiOS, not a top-level App version.

---

## Engine Versioning

Engines are **internal-only** simulation cores. They are surfaced in the Developer panel, not in public-facing footers. There are three, derived from the platform's calculation/simulation code.

| Engine        | Scope                                     | What it simulates                                                                                                                                                                                                                                             |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MyCountry** | Nation (per-country, deterministic)       | Economy (tier/growth, projections), Fiscal (tax/budget/passive income), Atomic Government (synergy/conflict), Vitality & Stability (scoring, power tier), National Issues (decisions/consequences), Security & Defense calc, per-nation Intelligence analysis |
| **Concord**   | World (cross-nation, time-driven, living) | Time/Tick (IxTime + cron orchestration), Diplomacy & NPCs (Markov relationship evolution, personality archetypes, cultural exchange), Crises & World Events, Intelligence broadcast, global rankings & cross-nation effects                                   |
| **Atlas**     | Foundation (spatial)                      | World generation (procedural/Voronoi pipeline), Geography analytics (geo-math, climate, terrain modifiers), Map pipeline (SVG/PNG → GeoJSON), Transport networks, Province import — **powers the IxWorld app**                                                |

```text
MyCountry Engine 1
Concord 1
Atlas 1
```

> **MyCountry appears on two axes by design:** the internal **MyCountry Engine** (nation simulation) and the public **MyCountry** UI system below. They version independently.

---

## UI / Feature System Versioning

User-facing systems within the platform, independent from the engines that power them.

Systems:

- **MyCountry** (public-facing executive command UI)
- **Builder** (nation creation wizard)
- **ThinkPages** (social — feed, groups, messages)
- **Achievements** (incl. LoreWards)
- **Stash** (save-for-later wiki articles; formerly LoreStash)
- **Repository** (WikiOS Commons image explorer)
- **Halo** (global contextual overlay; formerly "Dynamic Island")
- **Onoma** (name generation and linguistic dictionary studio)

```text
MyCountry 1
Builder 1
ThinkPages 1
Halo 1
Onoma 1
```

System versions represent capability evolution.

---

## Design System Versioning

- **Facet** — the glass / refraction / depth design language used across every surface (formerly "Glass Physics").

```text
Facet 1
```

Facet's integer increments on a visual-language break (new depth model, new token system, major motion overhaul).

---

# Schema Versioning

Database schemas maintain independent version tracking. Schema versions increase whenever a **breaking** data-structure change occurs.

```text
Economy Schema v12
Diplomacy Schema v8
Military Schema v6
Vault Schema v4
```

---

# API Versioning

API versions represent compatibility guarantees and should only increase on **breaking** changes.

```text
Platform API v1
Maps API v2
```

This extends the existing router-based strategy (implicit `v1`; future `v2` under `src/server/api/routers/v2/`) — it does not replace it. Per-domain API numbers are namespaced views of that same strategy, not a parallel scheme.

---

# Build Versioning

Every deployment has a unique, immutable build identifier.

```text
Build: 8f4e3b1
```

Sources (in order of preference):

- Git SHA
- CI build number
- Deployment timestamp

The build identifier is the authoritative source of truth for "exactly what is deployed." It is generated at build time into `src/lib/buildVersion.generated.ts` by `scripts/write-build-version.js` (the `prebuild` hook).

---

# Public Display Standards

## Footer

```text
IxStates 1.2 Ogma
Beta
Build 8f4e3b1
```

## About Page

```text
IxStates 1.2 Ogma
Channel: Beta

IxWorld 1.2
WikiOS 1
IxVault 1

Build 8f4e3b1
```

## Developer Panel

```text
Platform
Version: 1.1.0
Release: Ogma
Channel: Alpha

Apps
IxWorld: 1.2
WikiOS: 1   (Canvas: 1)
IxVault: 1

Engines
MyCountry: 2
Concord: 2
Atlas: 2

Systems
MyCountry: 2
Builder: 1
ThinkPages: 1
Achievements: 1
Stash: 1
Repository: 2
Halo: 1

Design
Facet: 1

Build
8f4e3b1
```

---

# Source of Truth

All version information originates from a single **Version Registry**:

```text
src/lib/buildVersion.ts
```

No version strings are hardcoded anywhere else. All UI, API, changelog, release feeds, diagnostics, and documentation consume version information from the registry. Documentation (including `docs/reference/branding.md`) must point at the registry rather than quote numbers, so values cannot drift.

The registry is a structured object rather than flat constants:

```ts
export const VERSIONS = {
  platform: {
    major: 1,
    minor: 2,
    patch: 6,
    release: "Ogma",
    channel: "Beta",
  },

  apps: {
    ixworld: 1.2,
    wikios: 1, // Canvas nests under WikiOS (see subSystems.canvas)
    ixvault: 1,
  },

  engines: {
    mycountry: 2, // nation-scoped deterministic sim
    concord: 2, // living-world sim (time, diplomacy, crises, NPCs)
    atlas: 2, // spatial foundation (worldgen, geo, maps) — powers IxWorld
  },

  systems: {
    mycountry: 2, // public-facing executive UI
    builder: 1,
    thinkpages: 1,
    achievements: 1, // incl. LoreWards
    stash: 1,
    repository: 2,
    halo: 1, // global contextual overlay (was "Dynamic Island")
  },

  design: {
    facet: 1, // glass/refraction/depth design language (was "Glass Physics")
  },

  subSystems: {
    canvas: 1, // visual wiki editor, under WikiOS
  },

  schemas: {
    economy: 12,
    diplomacy: 8,
  },
};
```

Derived display strings (`APP_VERSION`, `WIKIOS_VERSION`, `CHANNEL`, …) are computed from this object and are the only thing UI components import.

---

# Changelog Strategy

There is **one aggregated** `CHANGELOG.md` (Keep a Changelog format), organized with per-component sections under each platform release — not one changelog per component. A release entry records the platform version + channel and lists which Apps / Engines / Systems advanced their integers and why.

---

# Roadmap

Release names are permanent epochs; future epochs are reserved but unscheduled.

| Epoch          | Status         | Theme focus                                                                                                  |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| **1.2 Ogma**   | Current (Beta) | Executive/diplomacy canon track, map overlays, Defense/Politics panels, adjacency graph, waitlist onboarding |
| **2.0 Seshat** | Reserved       | TBD — likely real-time simulation depth, advanced economies                                                  |
| **3.0 Thoth**  | Reserved       | TBD — large-scale diplomacy, AI-assisted systems                                                             |

Future releases TBD.
