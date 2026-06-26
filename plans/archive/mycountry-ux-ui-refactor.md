# MyCountry — Complete UX/UI Refactor

## Context

MyCountry is the most important pre-launch surface. Its shell (left icon-rail nav + single-page router) is sound, but the **6 sections diverge badly**: three hero patterns, War Rooms in some sections and bespoke tab layouts in others, sidebar context widgets only on 3 of 6, inconsistent wiki placement, and uneven new-player handling. This refactor unifies everything onto one template, adopts a polished theme-compliant card system, weaves wiki/lore inline everywhere, makes the system adapt to new players via progressive disclosure, and converts premium gating to a real read-only preview. Direction below is locked from a 4-round Q&A.

## Locked decisions
- **Template:** Hero + **War Room canvas** per section; horizontal tabs only where depth is needed (Intel/Defense).
- **Left sidebar:** nav rail **+ one consistent context widget per section** (quick-stats snapshot + recent-activity log). Fixes Intel/Defense (currently none).
- **Visual:** theme-compliant **blend** — CutoutCard + regular Card + TextureOverlay + the **Builder glass library**. Strict light/dark token compliance.
- **Scope:** IA rethink allowed.
- **Hero:** **compact hero bar** for sections; big flag `HeroSection` reserved for **Overview/home**.
- **Wiki/lore:** woven **inline everywhere** (no bottom block, no separate tab).
- **Intel/Defense:** keep horizontal-tab analytics, **restyled** to the new shell + context widget + cards.
- **Motion:** tasteful middle — smooth transitions, animated counters, subtle glass/hover. No auto-cycle/heavy 3D.
- **Density:** **progressive disclosure** — guided/simple for new countries, denser as data accrues.
- **P0 work:** fold in & extend (reuse empty-state CTAs + premium visuals; add onboarding).
- **Premium (Intel/Defense):** **read-only preview** — render real content, disable mutations, upgrade banner. (Verified: render-time queries are public/protected, not premium; only mutations are `premiumProcedure`, server-enforced.)
- **Maps:** keep where they add value (**Overview, Diplomacy**); drop decorative ones (Executive/Politics/Intelligence/Defense). Plus a **design-only** overlay-plugin framework doc.
- **Rollout:** **shared primitives first**, then pilot one section, then roll out.

## Shared primitives (build FIRST — Phase 1)
All under `src/components/mycountry/` unless noted. Reuse `src/lib/mycountry-theme.ts` (SECTION_THEME_CLASSES) as the single source of section accent/gradient/glow.

1. **Glass/card foundation** — promote the Builder glass library from `src/app/builder/components/glass/` (`GlassCard`, `DynamicIslandEffects`, `GlassInputs`, `RefractiveGridBezel`, `ProgressiveViews`, texture overlay) into a shared `src/components/ui/glass/` so Builder + MyCountry share it. Define a small MyCountry **card vocabulary**: `PanelCard` (regular Card + TextureOverlay — workhorse), `GlassPanel` (GlassCard — hero/feature surfaces), `CutoutPanel` (CutoutCard — nav/widget framing). Document when to use each.
2. **`SectionShell`** — one opinionated wrapper over the existing `MyCountrySidebarLayout.tsx` that enforces: compact hero + context-widget slot + canvas/tabs content + alerts slot. Every section renders through it. Keeps the existing router/URL-sync untouched.
3. **`CompactSectionHero`** — unifies the Exec/Diplo/Politics `SectionHero` and **replaces the bespoke Intelligence/Defense headers**: icon chip + breadcrumb + title + status badges + optional action (e.g. settings). Big `primitives/hero/HeroSection.tsx` stays for Overview only.
4. **`SectionContextWidget`** — generalize the 3 existing `sidebar-widgets/*` into ONE component: quick-stats snapshot (2–4 numbers + optional mini ring) atop a recent-activity log; fed by per-section data adapters (add adapters for Intel & Defense).
5. **`useSectionDensity`** — returns `"guided" | "standard" | "full"` from data presence (section query counts). Drives progressive disclosure; sections render guided CTAs vs full War Room accordingly. Reuse Builder `ProgressiveViews` for any explicit Basic/Advanced toggles.
6. **Inline wiki weaving** — evolve `primitives/WikiLoreBlock.tsx` into `InlineWiki` that interleaves relevant wiki sections as inline cards among gameplay content. Per-section curated mapping of relevant wiki sections; reuse existing wiki data from `useMyCountryMetrics`.
7. **Read-only premium preview** — `MyCountryEditModeContext` (`canEdit`) + `PremiumPreviewFrame`. Frame renders real content; when locked, shows a sticky upgrade banner (repurpose P0-2 teaser visuals) and sets `canEdit=false`. Creator sheets/CTAs consume `useCanEdit()` → show upgrade prompt instead of firing the mutation. **One context, not per-call-site gating.** Replaces the router's hard `PremiumGate` swap (`MyCountryRouter.tsx:266-286`).

## Canonical section template
```
SectionShell(section)
 ├─ hero: CompactSectionHero  (big HeroSection only for Overview)
 ├─ contextWidget: SectionContextWidget (quick stats + activity)
 └─ content (density-aware):
     guided → prominent empty-state CTAs + onboarding hints + minimal panels
     full   → War Room canvas (Exec/Diplo/Politics) OR tabs (Intel/Defense)
              with wiki woven inline among the cards
```
**Per-section IA:** Overview = big hero + PillarCards + 4 stat tabs + woven wiki + map (keep). Executive = WarRoom (Issues/Decisions/Policies), no map. Diplomacy = WarRoom (Embassy/Relations/ForeignPolicy) + map (keep). Politics = VitalityRings + WarRoom (Legislature/Parties/Elections), no map. Intelligence/Defense = restyled tabs inside `PremiumPreviewFrame`, no decorative map. Wiki woven inline in all.

## Theme compliance
Standardize on CSS-var tokens (`bg-card`, `bg-muted`, `border-border`, `text-foreground`/`muted-foreground`) + section accent from `mycountry-theme`. Audit and replace theme-breaking `bg-white/5`, `bg-black/20`, hardcoded `text-white` on glass with token-based equivalents (`bg-card/70 backdrop-blur`, etc.). Verify every new primitive in **both light and dark**.

## Map overlay framework (DESIGN ONLY — Phase 7 doc)
Document a declarative `OVERLAY_REGISTRY` (`src/lib/overlay-registry.ts`) plugin pattern that formalizes the 5 existing overlays (`maps/overlays/` — Choropleth/Geopolitical/RiskHeatmap/TradeRoute/Transport) into `{id,label,category:"fill"|"feature"|"analytics",dataFetcher,component,legend,icon}`, replacing hardcoded lists in `maps/core/MapContainer.tsx`/`IxWorldMap.tsx`/`MapControls.tsx`. Geo endpoints already exist (`geo/core.ts`: getRegionalChoropleth, getGeopoliticalOverlay, getCrisisRiskMap…). Output = an architecture doc + integration seam; no implementation this pass.

## Sequencing (each phase independently shippable + reviewed)
- **P1 — Primitives:** glass/card foundation, SectionShell, CompactSectionHero, SectionContextWidget, useSectionDensity, InlineWiki, PremiumPreviewFrame + EditModeContext. No section rewired yet.
- **P2 — Pilot:** convert **Diplomacy** end-to-end (war room + map + context widget + inline wiki + density). Get sign-off on the real thing.
- **P3 — War-room sections:** Executive, Politics.
- **P4 — Tab sections:** Intelligence, Defense + read-only premium preview.
- **P5 — Home:** Overview polish (big hero + woven wiki + context widget).
- **P6 — Onboarding layer:** progressive-disclosure defaults + setup checklist linking existing `/help`; fold in P0 empty-state CTAs.
- **P7 — Maps design doc.**

## Reuse (don't rebuild)
`MyCountryRouter` + URL sync; `MyCountrySidebarLayout`/`MyCountrySidebarNav`; `mycountry-theme.ts`; `executive/CommandPanel` (already has empty-state CTAs from P0); Builder glass library; `CutoutCard`; `HeroSection`, `PillarCards`, `VitalityRings`; the 3 `sidebar-widgets/*` (generalize); `ProgressiveViews`; P0-1 persistence wiring (untouched aside from `canEdit` gating).

## Risks / migration safety
Keep the single-page router, URL sync, and P0-1 mutation wiring intact. Premium gating moves from router hard-swap → `PremiumPreviewFrame` (server still enforces mutations). Convert one section at a time so the app stays shippable. Lint after each phase; **never run global typecheck** (crashes server) — rely on `bun run dev` + split typechecks the user runs.

## Verification
- New-player smoke test: fresh builder country → walk all 6 sections as **free** and **premium**; confirm guided density, working empty-state CTAs, read-only preview (no ugly errors), persistence survives refresh.
- Theme test: every refactored surface in light + dark.
- `bun run lint` per phase; visual review at P2 pilot before rollout.
