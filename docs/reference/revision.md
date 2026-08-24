# IxStates Versioning & Release Architecture

**Status:** Canonical Standard v2  
**Platform Release:** IxStates 1.4.0 "Ogma" (Release Candidate)  
**Last Updated:** August 2026  

---

# 1. Platform Philosophy & Operating Model

IxStates is an integrated worldbuilding and nation-simulation operating system. It uses an **operating-system-style release model** structured into primary **First-Party Apps**, backend **Simulation Engines**, the **Facet UI Design System**, and an incubation **Labs Layer**.

Versioning communicates:
1. **Platform Evolution** — Operating system epochs, core framework upgrades, and ecosystem scale.
2. **App Maturity** — Standalone product capability and user-facing boundaries.
3. **Simulation Capability** — Deterministic engine calculus and living-world fidelity.
4. **Data Compatibility** — Multi-schema stability across 82+ sovereign nations.
5. **Build Reproducibility** — Sub-second atomic builds and git short SHA verification.

---

# 2. The IxStates Platform Org Chart

```text
====================================================================================================
                            IXSTATES 1.4.0 "OGMA" — OPERATING TAXONOMY
====================================================================================================

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 1. 🏛️ MYCOUNTRY — Executive Simulation & Sovereign Governance (v5)                             │
 │    Action: GOVERN | Domain Accent: Amber Gold (#F59E0B) | Route: /mycountry                    │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • Command Surface (v5)     │ Single-page executive console across 4 active domains: Identity,  │
 │                            │ Economy, Politics, Diplomacy. (Defense & Intel in preview).       │
 │ • Directives System        │ Declare national mandates, balance civil capacity (CivCap), and   │
 │                            │ resolve factional resistance.                                     │
 │ • Statecraft Engine (v4)   │ Deterministic sim: 42-tax bracket calculus, parliamentary D'Hondt │
 │                            │ representation, and composite vitality scoring.                   │
 │ • Country Builder (v3)     │ 6-step guided sovereign setup, MediaWiki infobox import, and      │
 │                            │ atomic policy matrix.                                             │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 2. 🗺️ ATLAS — Spatial Geography & Cartographic Studio (v2)                                     │
 │    Action: MAP | Domain Accent: Sky Blue (#0EA5E9) | Route: /maps                              │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • Interactive Map (v2)     │ WebGL vector globe rendering rivers, lakes, national borders,     │
 │                            │ topography, and climate biomes.                                   │
 │ • Map Editor               │ Draw and edit national borders, sub-national regions, provinces,  │
 │                            │ cities, points of interest (POIs), and snap Voronoi vertices.     │
 │ • Atlas Engine (v5)        │ "Geography is King" pipeline: grounded manual IxEarth cartography │
 │                            │ (climate, topography, PostGIS topology) + procedural UPG v2 mesh. │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 3. 📖 WIKIOS — Lore & Knowledge Operating System (v1)                                          │
 │    Action: PUBLISH | Domain Accent: Slate Cyan (#06B6D4) | Route: /wiki                        │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • Native Lore Engine (v1)  │ High-speed lore platform with PostgreSQL storage, sub-2ms link    │
 │                            │ graph (`wiki_links`), and MediaWiki background sync.              │
 │ • Margin                   │ Split-canvas inspector, text markup, gutter pins, and threaded    │
 │                            │ discussions directly on article text.                             │
 │ • Canvas Editor (v1)       │ Visual rich-text authoring with modular content blocks.           │
 │ • Wiki Awards (v1)         │ Editor milestone trophies, peer citations, and author medals.     │
 │ • Stash System (v1)        │ Save articles, quotes, media, and forum threads for later.        │
 │ • Image Repository (v2)    │ Shared image and media library with instant card generators.      │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 4. 💎 VAULT — Metagame Incentives, Social Economy & Collectibles (v2)                          │
 │    Action: COLLECT | Domain Accent: Burnished Copper (#D97706) | Route: /vault                 │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • Metagame Incentive Hub   │ Engagement and reward engine driving player progression across    │
 │                            │ governance, lore writing, and community activity.                 │
 │ • Atomic Credit Ledger (v2)│ Safe virtual currency ledger, daily streak bonuses, and passive   │
 │                            │ nation dividend yields.                                           │
 │ • Cards System (v2)        │ 3D holographic cards across 5 editions: Nation, Lore, Import,     │
 │                            │ Special, and Community with physics pack opening.                 │
 │ • Marketplace Trading Desk │ Live auction bidding, instant buyout escrow, and peer trading.    │
 │ • Achievements System (v2) │ Platform milestone showcase, category trophy racks, and unlocks.  │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 5. 💬 THINKPAGES — Real-Time Knowledge Feed & Communications (v2)                              │
 │    Action: DELIBERATE | Domain Accent: Emerald Jade (#10B981) | Route: /thinkpages             │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • Sovereign Feed (v2)      │ Sovereign micro-posts, `[blurb:slug]` tags, polls, and live wiki  │
 │                            │ card embeds.                                                      │
 │ • Account Manager          │ Multi-account switching, automated Discord webhook syndication,   │
 │                            │ and dispatch feeds.                                               │
 │ • ThinkTanks               │ Collaborative research groups, treaty drafting rooms, and shared  │
 │                            │ working papers.                                                   │
 │ • ThinkShare Messaging     │ Real-time direct messaging, group channels, and secure chats.     │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 6. 🗨️ IXFORUM — Archival Community Discourse (Inherited v1.4)                                  │
 │    Action: DEBATE | Domain Accent: Warm Orange (#F97316) | Route: /forum                       │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • XenForo Native Bridge    │ Thread synchronization, category boards, and sovereign dispatches.│
 │ • Single Sign-On (SSO)     │ Unified auth via IxnayID session sharing.                         │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 7. ⚙️ CONCORD ENGINE — Living-World Simulation Backend (v2)                                    │
 │    Role: Platform Simulation Backend | Powers living-world state across all apps               │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • IxTime Master Clock      │ Continuous world time synchronization, game epochs, and ticks.    │
 │ • Dynamic World Events     │ Algorithmic natural disaster, economic shock, and crisis queues.  │
 │ • Autonomous NPC AI        │ 8 personality traits and 6 behavioral archetypes with dampening.  │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 8. 🎨 FACET UI DESIGN SYSTEM & AMBIENT RUNTIME                                                 │
 │    Visual, Motion & Tactile Foundation                                                         │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • Facet Primitives (v2)    │ Volumetric Z-depth, physical materials, glare, 100% Radix slots.  │
 │ • Halo Contextual Overlay  │ Floating header capsule, live telemetry, and `Cmd+K` palette (v5).│
 │ • Cuelume Audio Engine (v1)│ 17 Web Audio synthesized haptic sound cues (`data-cuelume-*`).    │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 🧪 LABS — Experimental & Incubation Studio                                                     │
 │    Incubating Systems & Specialized Simulation Engines                                         │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • Onoma Studio (v4)        │ Linguistic engine, phonetic Markov chains, Kokoro TTS (/labs/onoma)
 │ • MyLeague & MyClub (v1)   │ 7-sport season simulation engine and franchise ownership (/labs/myleague)
 │ • Vexel (v1)               │ Procedural heraldic coat-of-arms and vector flag studio (/labs/vexel)
 └────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

# 3. Versioning Standards & Granularity Rules

The platform maintains strict separation between the **Platform SemVer Level** and the **Component Capability Integers**:

1. **Platform**: `Major.Minor.Patch` + Permanent Epoch **Release Name** + **Channel**  
   *Current:* **`IxStates 1.4.0 "Ogma"`** (Channel: *Release Candidate*).
2. **First-Party Apps**: A single monotonic capability integer (`ATLAS_VERSION = 2`, `WIKIOS_VERSION = 1`, `VAULT_VERSION = 2`, `MYCOUNTRY_VERSION = 5`, `THINKPAGES_VERSION = 2`).
3. **Simulation Engines**: Internal capability integers surfaced only in the Developer Panel (`MYCOUNTRY_ENGINE_VERSION = 4`, `CONCORD_ENGINE_VERSION = 2`, `ATLAS_ENGINE_VERSION = 5`).
4. **Subsystems & Components**: Independent capability integers (`BUILDER_VERSION = 3`, `ACHIEVEMENTS_VERSION = 2`, `STASH_VERSION = 1`, `REPOSITORY_VERSION = 2`, `WIKIAWARDS_VERSION = 1`, `HALO_VERSION = 5`, `ONOMA_VERSION = 4`, `FACET_VERSION = 2`, `CANVAS_VERSION = 1`).
5. **Inherited Components**: Components that do not version independently inherit the platform version: **IxForum** (`1.4`), **IxTime / IxnayID**, **Labs**, and **Navigation Hubs**.

---

# 4. Source of Truth

The single source of truth for all runtime version constants is [`src/lib/buildVersion.ts`](file:///home/jxsig/projects/ixstats/src/lib/buildVersion.ts). No version strings or numbers may be hardcoded in UI components or routers.
