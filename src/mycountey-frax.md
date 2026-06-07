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



Refactor the MyCountry **Politics** section onto the new shared section template in /ixwiki/public/projects/ixstats. Mirror the already-completed **Diplomacy pilot** exactly — same structure, same primitives, theme-compliant.

## Reference (READ THESE FIRST — copy the pattern precisely)
- `src/components/mycountry/EnhancedDiplomacyContent.tsx` — the canonical container pattern.
- `src/components/mycountry/sidebar-widgets/DiplomacySidebarWidget.tsx` — the canonical "context widget adapter" pattern.
- `src/components/mycountry/primitives/CompactSectionHero.tsx`, `SectionShell.tsx`, `SectionContextWidget.tsx`, `InlineWiki.tsx` — the primitives. Barrel `src/components/mycountry/primitives/index.ts` re-exports `SectionShell, CompactSectionHero, InlineWiki, SectionContextWidget, type ContextStat, type ContextActivityEntry, type StatusBadgeConfig`.
- `useFlag` from `~/hooks/useUnifiedFlags`; `useSectionDensity` from `~/hooks/useSectionDensity`.

## Target files to rewrite
1. `src/components/mycountry/sidebar-widgets/PoliticsSidebarWidget.tsx`
2. `src/components/mycountry/EnhancedPoliticsContent.tsx`

## Step 1 — PoliticsSidebarWidget → SectionContextWidget adapter
Read the current file (it queries parties/legislature/elections and builds an activity log). Convert it to render `<SectionContextWidget accent="indigo" title="Political Log" stats={stats} activity={activity} emptyMessage="No political activity yet" />`:
- `stats` (useMemo, ContextStat[]): `{ label: "Parties", value: <party count>, accentText: true }`, `{ label: "Seats", value: <legislature totalSeats>, accentText: true }`, `{ label: "Elections", value: <elections count>, accentText: true }`. Use the existing queries (`api.elections.getParties`, `api.elections.getLegislature`, `api.elections.getElections`).
- `activity` (useMemo, ContextActivityEntry[]): keep the SAME log-building logic the current widget already has (legislature configured, parties created, elections scheduled/completed), shaped as `{ id, icon, iconColor, text, time }`, newest-first, sliced to 5.

## Step 2 — EnhancedPoliticsContent → SectionShell template
Read the current file (it uses `SectionHero` + `VitalityRings` + `PoliticsSidebarWidget` + `CrossPillarBanner` + `PoliticsWarRoom` + `WikiLoreBlock`). Rewrite to mirror EnhancedDiplomacyContent:
- Keep props `{ activeSection, onNavigate, notifications }` and `useCountryData()`.
- Query data for hero/density: parties (`api.elections.getParties`), legislature (`api.elections.getLegislature`), elections (`api.elections.getElections`).
- `const { flagUrl } = useFlag(country?.name ?? "");` (BEFORE early return).
- `const { isGuided } = useSectionDensity({ items: <parties.length + (totalSeats > 0 ? 1 : 0) + elections.length> });` (before early return).
- Early return null if `isLoading || !country`.
- `statusBadges`: if pending elections > 0, one badge `{ icon: BarChart3, count: pending, colorClass: "border-indigo-500/40 text-indigo-600 dark:text-indigo-400" }` (import BarChart3 from lucide-react). Else `[]`.
- `heroStats`: `[{ label: "Parties", value: parties.length, accentText: true }, { label: "Seats", value: totalSeats, accentText: true }, { label: "Elections", value: elections.length, accentText: true }]`.
- Render:
```
<SectionShell section="politics" hero={<CompactSectionHero section="politics" title="Politics" subtitle="Legislature, parties & elections" icon={VoteIcon} countryName={country.name} flagUrl={flagUrl} stats={heroStats} statusBadges={statusBadges} />} contextWidget={<PoliticsSidebarWidget countryId={country.id} />} activeSection={activeSection} onNavigate={onNavigate} notifications={notifications}>
  {/* keep the existing VitalityRings element exactly as the current file renders it (same props/data) */}
  <VitalityRings ... />
  {!isGuided && <CrossPillarBanner section="politics" countryId={country.id} onNavigate={onNavigate} />}
  <PoliticsWarRoom countryId={country.id} />
  <InlineWiki context="politics" accent="indigo" maxSections={1} />
</SectionShell>
```
- Preserve the current `VitalityRings` usage (it computes ring data from parties/parliament/elections — keep that logic intact; just render it inside the SectionShell children above the WarRoom).
- Use `VoteIcon` from `~/components/ui/icons` (reuse the current file's existing icon import). Import `PoliticsWarRoom` from `~/components/executive/politics/PoliticsWarRoom`, `CrossPillarBanner` from `./primitives/CrossPillarBanner`, `VitalityRings` from `./primitives` (or wherever the current file imports it).
- REMOVE the old `SectionHero`, `WikiLoreBlock`, and `MyCountrySidebarLayout` usages.

## Constraints
- Theme-compliant (no hardcoded white/black).
- Run `npx eslint <the two files>` and fix until **0 errors**.
- Do NOT run `tsc`, `bun run typecheck`, `bun run build`, or the dev server. Lint only.
- Do NOT git commit.
- Only touch the 2 target files (don't change PoliticsWarRoom).

Report: a concise summary of what you changed in each file and the final eslint result.


Refactor the MyCountry **Executive** section onto the new shared section template in /ixwiki/public/projects/ixstats. Mirror the already-completed **Diplomacy pilot** exactly — same structure, same primitives, theme-compliant.

## Reference (READ THESE FIRST — copy the pattern precisely)
- `src/components/mycountry/EnhancedDiplomacyContent.tsx` — the canonical container pattern.
- `src/components/mycountry/sidebar-widgets/DiplomacySidebarWidget.tsx` — the canonical "context widget adapter" pattern.
- `src/components/mycountry/primitives/CompactSectionHero.tsx`, `SectionShell.tsx`, `SectionContextWidget.tsx`, `InlineWiki.tsx` — the primitives (note their prop shapes). The barrel `src/components/mycountry/primitives/index.ts` re-exports `SectionShell, CompactSectionHero, InlineWiki, SectionContextWidget, type ContextStat, type ContextActivityEntry, type StatusBadgeConfig`.
- `useFlag` from `~/hooks/useUnifiedFlags`; `useSectionDensity` from `~/hooks/useSectionDensity`.

## Target files to rewrite
1. `src/components/mycountry/sidebar-widgets/ExecutiveSidebarWidget.tsx`
2. `src/components/mycountry/EnhancedExecutiveContent.tsx`

## Step 1 — ExecutiveSidebarWidget → SectionContextWidget adapter
Read the current file. It already queries meetings/policies and builds an activity log. Convert it to render `<SectionContextWidget accent="amber" title="Command Log" stats={stats} activity={activity} emptyMessage="No executive actions yet" />`:
- `stats` (useMemo, ContextStat[]): three quick stats — `{ label: "Issues", value: <pending issue count>, accentText: true }`, `{ label: "Policies", value: <active policy count>, accentText: true }`, `{ label: "Meetings", value: <meetings count>, accentText: true }`. Use the existing queries (`api.policies.getPolicies`, `api.meetings.getMeetings`); for issue count use `useIssueCount(countryId)` from `~/hooks/useNationalIssues` (returns `{ total }`).
- `activity` (useMemo, ContextActivityEntry[]): keep the SAME log-building logic the current widget already has (completed meetings, enacted/draft policies, completed action items), shaped as `{ id, icon, iconColor, text, time }`, sorted newest-first, sliced to 5.
- Keep the same tRPC queries with `staleTime: 30_000`.

## Step 2 — EnhancedExecutiveContent → SectionShell template
Read the current file (it uses `SectionHero` + `ExecutiveSidebarWidget` + `CrossPillarBanner` + `ExecutiveWarRoom` + `WikiLoreBlock`). Rewrite to mirror EnhancedDiplomacyContent:
- Keep the props `{ activeSection, onNavigate, notifications }` and `useCountryData()`.
- Query data needed for hero/density: issues (`useIssueCount`), policies (`api.policies.getPolicies`), meetings (`api.meetings.getMeetings`).
- `const { flagUrl } = useFlag(country?.name ?? "");` (BEFORE the early return).
- `const { isGuided } = useSectionDensity({ items: <activePolicies + meetings.length + issueCount> });` (before early return).
- Early return null if `isLoading || !country`.
- `statusBadges`: if urgent issues > 0, one badge `{ icon: Bell, count: urgent, colorClass: "border-amber-500/40 text-amber-600 dark:text-amber-400" }` (import Bell from lucide-react). Else `[]`.
- `heroStats`: `[{ label: "Issues", value: issueCount, accentText: true }, { label: "Policies", value: activePolicies, accentText: true }, { label: "Meetings", value: meetings.length, accentText: true }]`.
- Render:
```
<SectionShell section="executive" hero={<CompactSectionHero section="executive" title="Executive" subtitle="Crisis management & executive command" icon={CrownIcon} countryName={country.name} flagUrl={flagUrl} stats={heroStats} statusBadges={statusBadges} />} contextWidget={<ExecutiveSidebarWidget countryId={country.id} />} activeSection={activeSection} onNavigate={onNavigate} notifications={notifications}>
  {!isGuided && <CrossPillarBanner section="executive" countryId={country.id} onNavigate={onNavigate} />}
  <ExecutiveWarRoom countryId={country.id} />
  <InlineWiki context="executive" accent="amber" maxSections={1} />
</SectionShell>
```
- Use `CrownIcon` from `~/components/ui/icons` (check the current file's existing icon import; reuse it). Import `ExecutiveWarRoom` from `~/components/executive/ExecutiveWarRoom`, `CrossPillarBanner` from `./primitives/CrossPillarBanner`.
- REMOVE the old `SectionHero` and `WikiLoreBlock` and `MyCountrySidebarLayout` usages (replaced by CompactSectionHero / InlineWiki / SectionShell).

## Constraints
- Theme-compliant (no hardcoded white/black; rely on the primitives + tokens).
- Run `npx eslint <the two files>` and fix until **0 errors** (pre-existing `@ts-nocheck` warnings elsewhere are fine, but these two files should have none unless already present).
- Do NOT run `tsc`, `bun run typecheck`, `bun run build`, or the dev server (they crash the server). Lint only.
- Do NOT git commit.
- If the current ExecutiveWarRoom needs no change, leave it. Only touch the 2 target files.

Report: a concise summary of what you changed in each file and the final eslint result.