---
name: project_versioning_architecture
description: "IxStates Versioning & Release Architecture — OS-inspired model, Version Registry, Apps/Engines/Systems taxonomy, component renames"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5f677839-8852-409e-9c70-c54e79d85af5
---

Canonical doc: **`revision.md`** (project root). Single source of truth: the **Version Registry** `VERSIONS` in `src/lib/buildVersion.ts` — no version strings hardcoded elsewhere; docs reference the registry, never quote numbers.

**Scheme (locked June 2026):**
- **Platform:** `Major.Minor.Patch` + permanent epoch **release name** + **channel** → **IxStates 1.0 "Ogma"**, channel Alpha. Legacy `1.42`/`2.1` retired; `package.json` = `1.0.0` (tooling-only). Epochs: 1.0 Ogma → 2.0 Seshat → 3.0 Thoth.
- **Single capability integer (NOT SemVer)** for each component:
  - **Apps:** IxWorld, WikiOS (Canvas = nested sub-version), IxVault
  - **Engines** (internal sim cores, Dev-panel only): **MyCountry** (nation sim), **Concord** (living-world: time/diplomacy/crises/NPCs), **Atlas** (geo/worldgen — powers IxWorld)
  - **UI/Feature Systems:** MyCountry, Builder, ThinkPages, Achievements, Stash, Repository, Halo
  - **Design system:** Facet
- **Inherit platform version (not independent):** IxForum (pinned, not promoted), IxTime/IxnayID, Labs, Nav Hubs. **IxWiki** retired as a component name (WikiOS renders the wiki content).
- **Channels:** Developer / Alpha / Beta / Release Candidate / Stable (orthogonal to numbers).

**Renames (brand only; code/CSS/Prisma identifiers kept pending separate mechanical renames):**
- Glass Physics → **Facet** (CSS still `glass-*` / `--glass-*`)
- Dynamic Island → **Halo** (dir `src/components/DynamicIsland/`, `DIPlugin`/`useDIPlugin`/`DIAction` kept)
- LoreStash → **Stash** (Prisma `LoreStash`/`LoreStashItem`/`LoreStashAnnotation` kept)
- IxMaps → **IxWorld** (IxMaps = the standalone maps.ixwiki.com deployment name only)

**Registry exports** (`src/lib/buildVersion.ts`): `APP_VERSION` ("1.0 Ogma"), `PLATFORM_VERSION`, `RELEASE_NAME`, `CHANNEL`, `IXWORLD_VERSION`, `WIKIOS_VERSION`, `IXVAULT_VERSION`, `IXFORUM_VERSION` (pinned to platform), `CANVAS_VERSION`, `MYCOUNTRY_ENGINE_VERSION`/`CONCORD_ENGINE_VERSION`/`ATLAS_ENGINE_VERSION`, `MYCOUNTRY_VERSION`/`BUILDER_VERSION`/`THINKPAGES_VERSION`/`ACHIEVEMENTS_VERSION`/`STASH_VERSION`/`REPOSITORY_VERSION`/`HALO_VERSION`, `FACET_VERSION`, `BUILD_VERSION` (git SHA, generated). Welcome-modal `*_WELCOME_VERSION` constants are feature-gates, kept separate. Docs that reference this: README.md, AGENTS.md, CLAUDE.md, docs/README.md, docs/DOCUMENTATION_INDEX.md, docs/overview/platform.md, docs/reference/branding.md, CHANGELOG.md. See [[feedback_versioning_check]].
