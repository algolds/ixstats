# Finalize the IxStates Versioning & Release Architecture

## Context

`revision.md` is a strong-but-unfinished **Draft v1** of an OS-inspired versioning model (permanent epoch release names like *Ogma*; channels orthogonal to numbers; a Platform / App / System / Engine / Schema / API / Build split). The concept is sound. But the draft is **internally inconsistent**, its "single source of truth" has **already drifted**, and the user has since **restructured the taxonomy**. This plan finalizes the document and operationalizes it so drift can't recur.

**Drift / inconsistency found in the repo today:**
- Three conflicting platform numbers: `package.json` **1.42**, `branding.md APP_VERSION` **2.1**, `buildVersion.ts APP_VERSION` **"1.0 Ogma"**.
- `branding.md` hardcodes per-app versions (`IxWorld 2.3.0`, `WikiOS 1.3`, `Builder 3.1-preview`, …) that **all** mismatch the actual `buildVersion.ts` values (reset to `1.0`).
- `THINKPAGES_VERSION` is referenced by a status widget + branding but **not exported**.
- No release **channel** concept exists in code.
- The doc is **truncated** at the registry teaser and has an orphaned "Focus:" fragment.

## Locked decisions (this session)

**Versioning rules**
- **Platform** = `Major.Minor.Patch` + permanent epoch **release name** + **channel**. Reset to **`1.0 Ogma`**, channel **Alpha**. `1.42`/`2.1` retired as legacy.
- **Apps / Engines / Systems** = a **single monotonic capability integer** each (e.g. `WikiOS 2`, `MyCountry 4`) — *not* SemVer. (The SemVer values in the pasted `VERSIONS` example get simplified to integers.)
- **Channels** (Developer / Alpha / Beta / RC / Stable) are a registry field, orthogonal to numbers.

**Final taxonomy**
- **Apps** (own brand, ship/break independently): **IxWorld**, **WikiOS**, **IxVault**.
  - **Canvas** → nested **WikiOS sub-system** (keeps its own sub-version under WikiOS).
- **Core Systems — Engines** (internal-only, independent) — **three engines**, derived from a full inventory of the calculation/simulation code:
  - **MyCountry Engine** — Nation-scoped, deterministic per-country sim: Economy (`calculations.ts` tier/growth, `economic-modeling-engine`), Fiscal (tax/budget/`passive-income`), Atomic Government (`synergy-calculator`, `government-synergy`), Vitality & Stability (`vitality-calculator`, `stability-formulas`, `power-classification`), National Issues (`national-issues-engine` + consequences), Security/Defense calc, per-nation Intelligence analysis.
  - **Concord** *(was "World Engine")* — World-scoped, time-driven living simulation: Time/Tick (`ixtime.ts` + cron orchestration), Diplomacy & NPCs (`diplomatic-markov-engine`, `diplomatic-npc-personality`, cultural), Crises & World Events, Intelligence broadcast, global rankings & cross-nation effects.
  - **Atlas** — Spatial foundation that powers the IxWorld app: World generation (`worldgen/`, `procedural-archive/`), Geography analytics (`geo-math`, `geo-analytics`, climate), Map pipeline (`svg-parser`, `map-pipeline`), Transport (`transport-generator`), Province import.
  - *Not engines* (stay in their UI System / Infra): Cards/Achievements/Activity/Lore/Social logic → ThinkPages / Achievements / IxVault; Flags/images/wiki-parsing/caching/formatting → Infra.
- **Core Systems — UI/Feature** (independent): **MyCountry** (public-facing UI), **Builder**, **ThinkPages** (feed/groups/messages), **Achievements** (incl. LoreWards), **Stash** (was LoreStash), **Repository** (WikiOS Commons explorer), **Halo** (was *Dynamic Island*).
- **Design system:** **Facet** (was *Glass Physics*) — versioned.
- **Inherit the platform version (NOT independently versioned):** **IxForum** (not promoted yet), Platform Utilities (IxTime, IxnayID), Experimental/Labs (preview-label only), Navigation Hubs (Dashboard/Feed).
- **Discarded:** **IxWiki** (it was just our name for the wiki; WikiOS is the product).

> MyCountry intentionally lives on **both** Core-System axes: `engines.mycountry` (internal sim) and `systems.mycountry` (public UI) — this is the hybrid model.

---

## Part 1 — Finalize the architecture doc (`revision.md`) — *core deliverable*

Rewrite the draft to match the locked taxonomy. Key edits:

- **Replace the three conflicting component lists** (§1 "Core Principles", "Product Versioning", "System Versioning") with **one canonical taxonomy**: Apps / Engines / UI-Feature Systems / Design system, plus an explicit **"What does NOT version independently"** subsection (IxForum, Utilities, Labs, Nav Hubs inherit platform; IxWiki removed). This subsection is the direct answer to the original "which components maintain independent histories" question.
- **Rename throughout:** `IxMaps → IxWorld`, `Glass Physics → Facet`, `Dynamic Island → Halo`, `LoreStash → Stash`; remove IxWiki and demote IxForum.
- **Section restructure:** "Product Versioning" → **"App Versioning"** (IxWorld, WikiOS, IxVault); "System Versioning" → split into **"Engine Versioning"** (MyCountry, Concord, Atlas — with the engine→cluster mapping from the inventory) and **"UI / Feature System Versioning"**.
- **Apply single-integer granularity** to every example: `Economy 5.2 → MyCountry 4`, `WikiOS 2.1 → WikiOS 2`, etc. State the rule: a component's integer increments on a user-noticeable capability leap; fixes ride the platform `patch` + build id.
- **Reset platform to `1.0 Ogma`** everywhere; delete `1.42`/`2.1`; one-line "legacy numbering retired" note.
- **Fix truncation:** finish the **Version Registry** section (shape in Part 2) and replace the orphaned "Focus:" fragment with a short **Roadmap** section (epoch placeholders Seshat / Thoth).
- **Update the pasted `VERSIONS` example** (doc lines ~388–410) to the new shape (`apps` / `engines` / `systems` / `design`) with single integers.
- **Update Public Display Standards** (Footer / About / Developer Panel mockups) to the new taxonomy — Apps (IxWorld/WikiOS/IxVault), Engines (internal-only, Dev panel), Systems, Facet; no IxForum/IxWiki as products; single integers.
- **Changelog + API notes:** one aggregated `CHANGELOG.md` with per-component sections; reconcile per-domain API versions with the existing router-based [API_VERSIONING_STRATEGY.md](docs/archive/v1/API_VERSIONING_STRATEGY.md) rather than a parallel scheme.
- Bump doc header to **Draft v2 / June 2026**.

## Part 2 — Operationalize: Version Registry in `buildVersion.ts`

Replace the flat constants in [src/lib/buildVersion.ts](src/lib/buildVersion.ts) with one structured `VERSIONS` registry, **preserving every existing named export** (derived from the registry) so the 25+ consumers keep working:

- Registry shape:
  ```
  platform: { major:1, minor:0, patch:0, release:"Ogma", channel:"Alpha" }
  apps:     { ixworld:1, wikios:1, ixvault:1 }        // canvas sub-version under wikios
  engines:  { mycountry:1, concord:1, atlas:1 }       // internal-only (Concord = living-world sim, Atlas = geo/worldgen)
  systems:  { mycountry:1, builder:1, thinkpages:1, achievements:1, stash:1, repository:1, halo:1 }
  design:   { facet:1 }
  schemas:  { ... }   // optional, manual/aspirational
  build:    <from buildVersion.generated.ts>
  ```
- Keep deriving `APP_VERSION` (= "1.0 Ogma"), `WIKIOS_VERSION`, `IXWORLD_VERSION`, `MYCOUNTRY_VERSION`, `BUILDER_VERSION`, `CANVAS_VERSION` from the registry as integer strings (footers already render `v{X}`). **Add the missing `THINKPAGES_VERSION` export.** Add `CHANNEL = "Alpha"`.
- **IxForum folding:** pin `IXFORUM_VERSION` to the platform version (it inherits, not independent) so `ForumLayout`'s "Powered by IxForum v…" still resolves without claiming an independent number.
- Optionally add `HALO_VERSION` / `FACET_VERSION` exports for future use.
- Keep welcome-modal gating constants (`STASHES_WELCOME_VERSION`, etc.) but clearly separated — they are feature-gates, not product identity.
- Generator (`scripts/write-build-version.js`, `prebuild` hook) unchanged.

## Part 3 — De-hardcode + re-taxonomize `branding.md`

In [docs/reference/branding.md](docs/reference/branding.md): remove the quoted version numbers (point at the registry instead — *"version defined in `src/lib/buildVersion.ts`; see About / Dev panel for live values"*), and update the brand-architecture tree to the new taxonomy (Apps vs Engines vs UI Systems; `Glass Physics → Facet`; `Dynamic Island → Halo`; `LoreStash → Stash`; drop IxWiki as a product; demote IxForum; IxMaps → IxWorld).

## Part 4 — `package.json` reconciliation

Set [package.json](package.json) `version` to `1.0.0` (npm/build-tooling only, not user-facing) so the registry is the sole public version. *(At execution: if tooling keys off `1.42`, instead leave it and document package.json as "tooling-only".)*

---

## Deferred follow-ups (flagged, NOT in this scope)

These are high-churn/mechanical and should be separate tasks:
- **CSS token rename** `glass-*` / `--glass-*` → `facet-*` across hundreds of files. Renaming the *design-system brand* to **Facet** (docs + registry) does **not** require renaming every CSS class now.
- **Component/dir rename** `src/components/DynamicIsland/` → `Halo/` (and `BuilderDIView` etc.). Brand rename to **Halo** in docs/registry is independent of the code move.
- **About page + Developer panel** UI that renders the full registry (today only footer-style displays exist: `DashboardQuickLinks`, `ThinkPagesStatusWidget`, `ForumLayout`, `NewVersionNotice`).

## Critical files

- [revision.md](revision.md) — the architecture doc (Part 1).
- [src/lib/buildVersion.ts](src/lib/buildVersion.ts) — the Version Registry (Part 2); keep all current exports, add `THINKPAGES_VERSION` + `CHANNEL`, pin `IXFORUM_VERSION`.
- [src/lib/buildVersion.generated.ts](src/lib/buildVersion.generated.ts) + [scripts/write-build-version.js](scripts/write-build-version.js) — build hash, unchanged.
- [docs/reference/branding.md](docs/reference/branding.md) — de-hardcode + re-taxonomize (Part 3).
- [package.json](package.json) — version reconciliation (Part 4).
- Consumers to keep green: [DashboardQuickLinks.tsx](src/components/dashboard/sidebar/DashboardQuickLinks.tsx), [ThinkPagesStatusWidget.tsx](src/components/thinkpages/ThinkPagesStatusWidget.tsx), [ForumLayout.tsx](src/components/forum/shared/ForumLayout.tsx), [NewVersionNotice.tsx](src/components/dashboard/NewVersionNotice.tsx), and the Builder/Map/Repository welcome modals.

## Verification

- **Do not run global typecheck** (repo constraint). Validate with `bun run lint`.
- Start `bun run dev` and confirm version-bearing UI still renders: dashboard Quick Links footer (`v… · Build …`), ThinkPages status widget (`Platform v…`), Forum layout (`Powered by IxForum v…`), and `NewVersionNotice`.
- `grep` to confirm no consumer imports a now-removed name (all prior exports still resolve) and that `THINKPAGES_VERSION` resolves where used.
- Confirm `branding.md` contains no literal version numbers, and `revision.md` has zero remaining `IxMaps` / `IxWiki` / `Glass Physics` / `Dynamic Island` / `1.42` / `2.1` / SemVer-system references.
