# IxStates Versioning & Release Architecture

**Status:** Canonical Standard v2  
**Platform Release:** IxStates 1.0.0 "Lobster Crosby" (Stable) to players; internal 1.5.0, on production since 2026-10-27 (see [§5](#5-public-and-internal-versions))  
**Last Updated:** 2026-10-27  

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
                            IXSTATES "LOBSTER CROSBY" (INTERNAL 1.5.0) — OPERATING TAXONOMY
====================================================================================================

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 1. 🏛️ MYCOUNTRY — Executive Simulation & Sovereign Governance (v6)                             │
 │    Action: GOVERN | Domain Accent: Amber Gold (#F59E0B) | Route: /mycountry                    │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • Command Surface (v6)     │ Single-page executive console across 4 active domains: Identity,  │
 │                            │ Economy, Politics, Diplomacy. (Defense & Intel in preview).       │
 │ • Directives System        │ Declare national mandates, balance civil capacity (executive bandwidth), and   │
 │                            │ resolve factional resistance.                                     │
 │ • Statecraft Engine (v4)   │ Deterministic sim: 42-tax bracket calculus, parliamentary D'Hondt │
 │                            │ representation, and composite vitality scoring.                   │
 │ • Country Builder (v4)     │ Guided wizard stepper, MediaWiki infobox import, archetype        │
 │                            │ defaults, and atomic policy matrix.                               │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 2. 🗺️ IXWORLD — Spatial Geography & Cartographic Studio (v2)                                   │
 │    Action: MAP | Domain Accent: Chart shallows (#05667a) | Route: /maps                        │
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
 │ • Native Lore Engine (v1)  │ High-speed lore platform with PostgreSQL storage, indexed link    │
 │                            │ graph (`wiki_links`), and MediaWiki background sync.              │
 │ • Margin                   │ Split-canvas inspector, text markup, gutter pins, and threaded    │
 │                            │ discussions directly on article text.                             │
 │ • Canvas Editor (v1)       │ Visual rich-text authoring with modular content blocks.           │
 │ • Wiki Awards (LoreWards)  │ Daily, weekly and monthly contests with tiered payouts and trophy │
 │                            │ cards; one view shared with the Vault (/util/lorewards).          │
 │ • Stash System (v1)        │ Save articles, quotes, media, and forum threads for later.        │
 │ • Image Repository (v2)    │ Shared image and media library with instant card generators.      │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 4. 💎 VAULT — Collectathon Hub: Wallet, Achievements, Cards & Store (v3)                       │
 │    Action: COLLECT | Domain Accent: Raspberry (`APP_TINTS.vault`) | Route: /vault              │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • Wallet                   │ Bank-statement page: balance card, showcase, statement with       │
 │                            │ running balance and a Your Vault list; in the sidebar for all.    │
 │ • Atomic Credit Ledger (v2)│ Safe virtual currency ledger, daily streak bonuses, and the       │
 │                            │ nightly Vault dividend (collection interest plus activity).       │
 │ • Cards System (v2)        │ 3D holographic cards across 5 editions: Nation, Lore, Import,     │
 │                            │ Special, and Community with physics pack opening.                 │
 │ • Store, Auctions & Trading│ Packs and cosmetics, live auction bidding, and peer trading.      │
 │ • Achievements System (v3) │ Nation, platform and Loreward achievements, Legacy unlocks,       │
 │                            │ showcase and leaderboard (/vault/achievements).                   │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 5. 💬 THINKPAGES — Real-Time Knowledge Feed & Communications (v3)                              │
 │    Action: DELIBERATE | Domain Accent: Commons leather (#115536) | Route: /thinkpages          │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • Forum                    │ Sitewide and realm boards, threads and replies, posting as        │
 │                            │ yourself or a persona, and each realm's live board.               │
 │ • Sovereign Feed (v2)      │ Sovereign micro-posts, `[blurb:slug]` tags, polls, and live wiki  │
 │                            │ card embeds.                                                      │
 │ • Account Manager          │ Multi-account switching, automated Discord webhook syndication,   │
 │                            │ and dispatch feeds.                                               │
 │ • ThinkTanks               │ Collaborative research groups, treaty drafting rooms, and shared  │
 │                            │ working papers.                                                   │
 │ • ThinkShare Messaging     │ Real-time direct messaging, group channels, and secure chats.     │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 6. 🗨️ IXFORUM — Archival Community Discourse (Inherited v1.5)                                  │
 │    Action: DEBATE | Domain Accent: Commons leather (#115536) | Route: /thinkpages              │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • XenForo bridge (retired) │ Retired in forum phase 4b; there is no /forum route. The old      │
 │                            │ forum's threads were imported into the native forum.              │
 │ • Native forum             │ The community forum lives in ThinkPages at /thinkpages (box 5).   │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 7. ⚙️ CONCORD ENGINE — Living-World Simulation Backend (v2)                                    │
 │    Role: Platform Simulation Backend | Powers living-world state across all apps               │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • IxTime Master Clock      │ Continuous world time synchronization, game epochs, and ticks.    │
 │ • World Events (admin)     │ Admin-authored events that write Storyteller effects; crisis feed │
 │                            │ is read-only, with no generator (see crisis-events.md).           │
 │ • Autonomous NPC AI        │ 8 personality traits and 6 behavioral archetypes with dampening.  │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 8. 🎨 FACET UI DESIGN SYSTEM & AMBIENT RUNTIME                                                 │
 │    Visual, Motion & Tactile Foundation                                                         │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • Facet (v4)               │ Layers, content types, tinted canvas, Radix slots.                │
 │ • Halo Contextual Overlay  │ Floating header capsule, live telemetry, and `Cmd+K` palette (v6).│
 │ • Cuelume Audio Engine (v1)│ 17 Web Audio synthesized haptic sound cues (`data-cuelume-*`).    │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 🧪 LABS — Experimental & Incubation Studio                                                     │
 │    Incubating Systems & Specialized Simulation Engines                                         │
 ├────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ • Onoma Studio (v4)        │ Linguistic engine, phonetic Markov chains, Kokoro TTS (/labs/onoma)
 │ • MyLeague & MyClub (v1)   │ 7-sport season simulation engine and franchise ownership (/myleague, /myclub)
 │ • Exchange (Sovereigns)    │ Companies, contracts, shares and sector funds (/labs/exchange)
 │ • Vexel (v1)               │ Procedural heraldic coat-of-arms and vector flag studio (/labs/vexel)
 └────────────────────────────────────────────────────────────────────────────────────────────────┘
```

> **Numbers in the chart** are the internal registry's (`INTERNAL_VERSIONS`); players see v1 for every app and system ([§5](#5-public-and-internal-versions)).
>
> **Registry mapping:** `VERSIONS.engines` in `src/lib/buildVersion.ts` has exactly three entries: `mycountry` (the "Statecraft Engine" above; Statecraft has no separate integer), `concord` and `atlas`. Other systems named under Concord (IxTime, crisis events, NPC AI) are a documentation grouping and are not versioned separately. The `MYCOUNTRY_ENGINE_VERSION` and `CONCORD_ENGINE_VERSION` constants are not read anywhere else in `src/`.

---

# 3. Versioning Standards & Granularity Rules

The platform maintains strict separation between the **Platform SemVer Level** and the **Component Capability Integers**:

1. **Platform**: `Major.Minor.Patch` + Permanent Epoch **Release Name** + **Channel**  
   *Current:* **`IxStates 1.0.0 "Lobster Crosby"`** (Channel: *Stable*) publicly; internally **1.5.0** (channel *Release Candidate* in `INTERNAL_VERSIONS`).
2. **First-Party Apps**: A single monotonic capability integer (`IXWORLD_VERSION`, `WIKIOS_VERSION`, `IXVAULT_VERSION`; public 1 each, internal 3, 1 and 3).
3. **Simulation Engines**: Internal capability integers surfaced only in the Developer Panel (`MYCOUNTRY_ENGINE_VERSION = 4`, `CONCORD_ENGINE_VERSION = 2`, `ATLAS_ENGINE_VERSION = 5`), identical in both registries.
4. **UI / Feature Systems & Design**: Independent capability integers (`MYCOUNTRY_VERSION`, `BUILDER_VERSION`, `THINKPAGES_VERSION`, `ACHIEVEMENTS_VERSION` (incl. LoreWards / Wiki Awards), `STASH_VERSION`, `REPOSITORY_VERSION`, `HALO_VERSION`, `ONOMA_VERSION`), the design system (`FACET_VERSION`) and the WikiOS sub-system `CANVAS_VERSION`: public 1 each; internal 6, 4, 3, 3, 1, 2, 6, 4, Facet 4 and Canvas 1.
5. **Inherited Components**: Components that do not version independently inherit the platform version: **IxForum** (`IXFORUM_VERSION`, the public `major.minor`: `1.0`), **IxTime / IxnayID**, **Labs**, and **Navigation Hubs**.

---

# 4. Source of Truth

The single source of truth for all runtime version constants is [`src/lib/buildVersion.ts`](../../src/lib/buildVersion.ts). No version strings or numbers may be hardcoded in UI components or routers.

---

# 5. Public and Internal Versions

Since the 1.0 reveal (October 2026), `src/lib/buildVersion.ts` holds two registries with the same shape:

| Registry | Holds | Read by |
|----------|-------|---------|
| `VERSIONS` (public) | Platform **1.0.0 "Lobster Crosby"**, channel **Stable**; every app, system, design and sub-system number restarted at **1** | Every exported display constant (`APP_VERSION`, `PLATFORM_VERSION`, `RELEASE_NAME`, `CHANNEL`, `CHANNEL_SHORT`, `IXWORLD_VERSION` … `CANVAS_VERSION`, `IXFORUM_VERSION`), so every user-facing surface: the UI and the `/changelog` page |
| `INTERNAL_VERSIONS` (internal) | The numbers the platform actually reached: platform **1.5.0** (channel Release Candidate), IxWorld 3, IxVault 3, MyCountry UI 6 and so on | `INTERNAL_PLATFORM_VERSION` (diagnostics, never shown to players), `scripts/docs/sync-reference-docs.ts`, which writes the generated version matrix in the docs (for example [platform.md](../overview/platform.md)), and `start-production.sh`'s start banner, which takes the first `major`/`minor`/`patch` in the file (the internal registry's, `v1.5.0 "Lobster Crosby"`) |

**The engines are identical** in both (`VERSIONS.engines` *is* `INTERNAL_VERSIONS.engines`) because they are
functional, not cosmetic: stored data carries them. `ATLAS_ENGINE_VERSION` is stamped into world recipes and imports, and
a stored recipe is validated against it, so restarting it at 1 would invalidate every stored recipe.

**Bumping.** A user-facing change bumps the public number in `VERSIONS` (from 1 onwards) and the internal number in
`INTERNAL_VERSIONS` alike; never bump an engine for display. `CHANGELOG.md` names a release by its internal number and
notes the public one (1.5.0 shipped as public 1.0).
