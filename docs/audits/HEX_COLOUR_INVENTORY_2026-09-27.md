# Hex inventory — 2026-09-27 (baseline = HEAD a9fa3bbc, before first-area apply)

Scanned: src/**/*.{ts,tsx,css} — 2866 hex sites. Mappable by the codemod: 28.

Classes: a = Tailwind arbitrary class (class / class-complex); b = inline style + CSS declarations (style / style-complex / css / css-effect); b? = JS literal outside style={{}} (manual triage); c = DATA (must stay literal); n/a = comments, var() fallbacks, token definitions.

## By class

| class | sites |
|---|---|
| a | 5 |
| b | 84 |
| b? | 652 |
| c | 1742 |
| n/a | 383 |

## By kind

| kind | sites |
|---|---|
| data | 1742 |
| js-literal | 652 |
| token-def | 309 |
| fallback | 58 |
| css | 33 |
| css-effect | 27 |
| style-complex | 22 |
| comment | 16 |
| class | 3 |
| style | 2 |
| class-complex | 2 |

## By area (src/<dir>/<subdir>; styles as one)

| area | total | a | b | b? | c | n/a | mappable |
|---|---|---|---|---|---|---|---|
| lib/themes | 611 | 0 | 0 | 78 | 533 | 0 | 0 |
| styles | 416 | 0 | 60 | 0 | 57 | 299 | 25 |
| components/maps | 249 | 0 | 0 | 0 | 249 | 0 | 0 |
| lib/maps | 199 | 0 | 0 | 0 | 191 | 8 | 0 |
| components/mycountry | 158 | 0 | 2 | 84 | 72 | 0 | 0 |
| app/labs | 109 | 0 | 11 | 79 | 15 | 4 | 0 |
| app/admin | 104 | 0 | 3 | 66 | 34 | 1 | 0 |
| lib/cards | 90 | 0 | 0 | 0 | 90 | 0 | 0 |
| app/countries | 85 | 0 | 0 | 34 | 48 | 3 | 0 |
| components/wiki-os | 75 | 0 | 6 | 57 | 6 | 6 | 0 |
| components/cards | 68 | 0 | 0 | 0 | 68 | 0 | 0 |
| components/shared | 52 | 0 | 0 | 0 | 52 | 0 | 0 |
| lib/economy | 49 | 0 | 0 | 46 | 3 | 0 | 0 |
| context | 46 | 0 | 0 | 2 | 0 | 44 | 0 |
| lib/worldgen | 45 | 0 | 0 | 0 | 45 | 0 | 0 |
| app/(wiki-os) | 44 | 0 | 0 | 44 | 0 | 0 | 0 |
| components/halo | 41 | 0 | 0 | 39 | 1 | 1 | 0 |
| tests/lib | 40 | 0 | 0 | 0 | 40 | 0 | 0 |
| server/api | 39 | 0 | 0 | 0 | 39 | 0 | 0 |
| components/ui | 35 | 2 | 0 | 11 | 16 | 6 | 0 |
| lib/flags | 35 | 0 | 0 | 0 | 33 | 2 | 0 |
| components/sports | 29 | 0 | 0 | 0 | 29 | 0 | 0 |
| app/builder | 27 | 0 | 0 | 27 | 0 | 0 | 0 |
| components/analytics | 25 | 0 | 0 | 0 | 25 | 0 | 0 |
| components/vault | 25 | 0 | 2 | 2 | 21 | 0 | 0 |
| components/admin | 24 | 0 | 0 | 14 | 10 | 0 | 0 |
| hooks | 19 | 0 | 0 | 17 | 2 | 0 | 0 |
| lib/demo-seed | 17 | 0 | 0 | 0 | 17 | 0 | 0 |
| lib/heraldry | 16 | 0 | 0 | 0 | 16 | 0 | 0 |
| app/(widget) | 13 | 0 | 0 | 0 | 13 | 0 | 0 |
| types | 11 | 0 | 0 | 11 | 0 | 0 | 0 |
| components/executive | 10 | 0 | 0 | 10 | 0 | 0 | 0 |
| lib/media | 9 | 0 | 0 | 9 | 0 | 0 | 0 |
| components/dashboard | 7 | 3 | 0 | 4 | 0 | 0 | 3 |
| app/api | 6 | 0 | 0 | 0 | 6 | 0 | 0 |
| lib/clerk | 6 | 0 | 0 | 0 | 0 | 6 | 0 |
| lib/forum | 6 | 0 | 0 | 6 | 0 | 0 | 0 |
| lib/wiki-os | 6 | 0 | 0 | 4 | 0 | 2 | 0 |
| tests/hooks | 4 | 0 | 0 | 0 | 4 | 0 | 0 |
| tests/sports | 3 | 0 | 0 | 0 | 3 | 0 | 0 |
| components/thinkpages | 2 | 0 | 0 | 2 | 0 | 0 | 0 |
| hooks/map-editor | 2 | 0 | 0 | 2 | 0 | 0 | 0 |
| tests/validators | 2 | 0 | 0 | 0 | 2 | 0 | 0 |
| app/myleague | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| components/media | 1 | 0 | 0 | 0 | 0 | 1 | 0 |
| lib | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| lib/country-geo | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| lib/government | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| server/shared | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| tests/app | 1 | 0 | 0 | 0 | 1 | 0 | 0 |

## First area (components/ui, components/shared, app/_components, styles)

Total 503; by kind: {"data":125,"fallback":41,"js-literal":11,"class-complex":2,"css+mapped":25,"token-def":263,"css-effect":27,"css":8,"comment":1}

### Mapped by codemod

- src/styles/clerk.css:249 #ffffff → --color-white
- src/styles/components.css:4 #ffffff → --color-white
- src/styles/forum.css:949 #ef4444 → --color-error
- src/styles/integrations.css:59 #fff → --color-white
- src/styles/integrations.css:72 #fff → --color-white
- src/styles/integrations.css:78 #6b7280 → palette --color-gray-500
- src/styles/integrations.css:80 #f3f4f6 → palette --color-gray-100
- src/styles/integrations.css:86 #1f2937 → palette --color-gray-800
- src/styles/integrations.css:87 #f3f4f6 → palette --color-gray-100
- src/styles/integrations.css:93 #1f2937 → palette --color-gray-800
- src/styles/integrations.css:96 #9ca3af → palette --color-gray-400
- src/styles/integrations.css:97 #374151 → palette --color-gray-700
- src/styles/wiki-os/components.css:2771 #ffffff → --color-white
- src/styles/wiki-os/content.css:380 #ffffff → --color-white
- src/styles/wiki-os/content.css:381 #ffffff → --color-white
- src/styles/wiki-os/content.css:390 #000000 → --color-black
- src/styles/wiki-os/content.css:391 #000000 → --color-black
- src/styles/wiki-os/content.css:1323 #ffffff → --color-white
- src/styles/wiki-os/editors.css:670 #ffffff → --color-white
- src/styles/wiki-os/editors.css:829 #3b82f6 → --color-info
- src/styles/wiki-os/editors.css:1177 #f59e0b → --color-warning
- src/styles/wiki-os/editors.css:1188 #3b82f6 → --color-info
- src/styles/wiki-os/editors.css:1210 #10b981 → --color-success
- src/styles/wiki-os/editors.css:1221 #6366f1 → --color-brand-primary
- src/styles/wiki-os/foundations.css:472 #09090b → palette --color-zinc-950

### Left (non-n/a), by file and kind

- 52 × src/components/shared/charts/RechartsIntegration.tsx [data]
- 49 × src/styles/facet/physics.css [data]
- 14 × src/styles/domains.css [css-effect]
- 11 × src/components/ui/color-picker/index.tsx [data]
- 9 × src/styles/utilities.css [css-effect]
- 8 × src/styles/facet.css [data]
- 5 × src/components/ui/apple-switch.tsx [js-literal]
- 5 × src/components/ui/chart.tsx [data]
- 4 × src/styles/wiki-os/foundations.css [css-effect]
- 3 × src/components/ui/facet/swipeable/SwipeableRow.tsx [js-literal]
- 3 × src/styles/wiki-os/foundations.css [css]
- 2 × src/components/ui/facet/swipeable/SwipeableRow.tsx [class-complex]
- 2 × src/components/ui/health-ring.tsx [js-literal]
- 1 × src/components/ui/facet/tabs/FacetTabs.tsx [js-literal]
- 1 × src/styles/forum.css [css]
- 1 × src/styles/integrations.css [css]
- 1 × src/styles/wiki-os/components.css [css]
- 1 × src/styles/wiki-os/content.css [css]
- 1 × src/styles/wiki-os/editors.css [css]

### Left CSS declarations (no exact token)

- src/styles/forum.css:955 #a855f7
- src/styles/integrations.css:60 #1a1a1a
- src/styles/wiki-os/components.css:1749 #a78bfa
- src/styles/wiki-os/content.css:1313 #1a1c22
- src/styles/wiki-os/editors.css:1199 #14b8a6
- src/styles/wiki-os/foundations.css:471 #fef036
- src/styles/wiki-os/foundations.css:552 #a78bfa
- src/styles/wiki-os/foundations.css:568 #7c3aed

## Repo-wide top JS-literal (b?) files

- 76 × src/lib/themes/mycountry-theme.ts
- 41 × src/lib/economy/factory.ts
- 36 × src/app/labs/onoma/glyphs/page.tsx
- 26 × src/app/labs/onoma/components/nav/onoma-tabs.tsx
- 22 × src/components/mycountry/domains/government/atoms/department/department-constants.ts
- 18 × src/components/halo/views/NavTray.tsx
- 16 × src/app/admin/_components/AutosaveMonitoringDashboard.tsx
- 14 × src/app/builder/lib/wiki-builder-assembler.ts
- 14 × src/components/admin/equipment/AnalyticsTab.tsx
- 13 × src/app/(wiki-os)/util/categories/_components/constants.ts
- 12 × src/app/(wiki-os)/util/categories/[...slug]/page.tsx
- 12 × src/app/(wiki-os)/wiki/categories/[...slug]/page.tsx
- 12 × src/components/wiki-os/reader/WikiOSMainPage.tsx
- 11 × src/types/government.ts
- 10 × src/app/admin/myleague/SportsLabsPanel.tsx
- 10 × src/app/countries/_components/CountryComparisonModal.tsx
- 10 × src/components/executive/politics/PartyManager.tsx
- 10 × src/components/wiki-os/reader/StashManagerModal.tsx
- 10 × src/hooks/useCountryComparison.ts
- 9 × src/components/mycountry/shared/modals/metric-details/GovernmentSpendingModal.tsx

## Theme tokens (src/styles/themes.css; `:root` = dark default, `.light` overrides; globals.css @theme exposes utilities)

| token (utility) | dark | light |
|---|---|---|
| background | #0f1114 | #f8fafc |
| card / popover | #16181d | #ffffff / rgba(255,255,255,.95) |
| muted = secondary = accent | #1e2028 | #f1f5f9 |
| --color-bg-accent / --color-bg-hover (CSS only) | #282a33 / #32343e | #e2e8f0 |
| foreground (= primary) | #e4e4e7 | #09090b |
| text-secondary | #d4d4d8 | #52525b |
| muted-foreground | #a1a1aa | #71717a |
| border / input | rgba(255,255,255,.08/.12) | rgba(0,0,0,.08/.10) |
| destructive (--color-error) / success / info / warning | #ef4444 / #10b981 / #3b82f6 / #f59e0b | same |
| brand-primary (= ring) / brand-secondary | #6366f1 / #818cf8 | same |
| discord / wiki / map-ocean | #5865F2 / #1d4e89 / #0a1628 | same |
| gold-50…950 (@theme, = v3 amber hexes) | #fffbeb … #451a03 | same |
| poll, forum-accent, theme-*, rarity-*, onoma-*, chart-1…6 | switch or data-only | — (not auto-mapped: context-specific) |

Tailwind palette: v4 OKLCH defaults (amber/blue/emerald/orange/rose/indigo accents per Facet §11). v4 neutrals render within ≤4/255 of the v3 hexes; v4 chromatic colours moved 11–36/255 (e.g. red-500 #fb2c36 vs v3 #ef4444), so v3 chromatic hexes are not mapped to palette names.

## Manual first-area edits (JS literals verified to flow straight into a static backgroundColor)

- src/components/ui/apple-switch.tsx: 3 × thumb "#ffffff" → "var(--color-white)"
- src/components/ui/facet/swipeable/SwipeableRow.tsx: 2 × commit-flood default "#ef4444" → "var(--color-error)"

## Flags for the owner

- wiki-os/editors.css custom chips are category colours (MyCountry amber, CountryData blue, Coords emerald, MapEmbed indigo) that now read --color-warning / --color-info / --color-success / --color-brand-primary: value-exact, but status names.
- wiki-os/editors.css:829 is a legacy fallback line followed by `var(--wikios-accent, #3b82f6)`; it now reads var(--color-info).
- SwipeableRow.tsx:779 hand-rolled `color-mix(…,#0f172a)` + `dark:…#f8fafc` pair: an exact swap is var(--color-slate-900/50); the Facet fix is a single mix with var(--foreground) (small value change).

## Repo-wide pass (2026-09-27, second batch) — changed vs left per class (excluding the two new test files)

| class | baseline | changed | left |
|---|---|---|---|
| a | 5 | 3 (ServerDiscordBadge → discord) | 2 (SwipeableRow:779 color-mix + dark: pair; design call) |
| b | 84 | 26 (25 CSS first area + InteractiveCardTemplates:107 → --color-error) | 58 |
| b? | 652 | 13 (apple-switch 3, SwipeableRow 2, NotificationRow 2, NotificationBrowser 2, BuilderHalo 2, WikiNarratorPlayer 1, CountryHeader 1) | 639 |
| c | 1742 | 0 | 1742 |
| n/a | 383 | 0 | 383 |

### (b) left — 58
- 27 css-effect: gradients, shadows, @media print (domains.css vault foil, utilities.css skeletons/print, wiki-os glows).
- 21 style-complex: onoma 11 (off-limits); hex-alpha concatenation 2 (InteractiveCardTemplates `#ef44444D`/`#ef444433`); `=== "#fef036"` comparisons 6 (wiki-os margin); boxShadow #666 1 (VaultImportSection); department-colour data fallback 1 (BudgetDepartmentList).
- 8 CSS declarations with no exact token (#a855f7, #1a1a1a, #14b8a6 = chart-6 data token, #1a1c22, #a78bfa ×2, #7c3aed, #fef036 highlighter).
- 2 style props with no token (VaultImportSection #EAEAE2, StateSeal #3a2a12).

### Supporting change
- SwipeActionButton now treats `var(...)` as a CSS colour (`/^(#|rgb|hsl|var\()/`), matching its documented "CSS color value or Tailwind color name" contract; needed so destructive swipe actions can use var(--color-error). Covered by src/tests/components/ui/swipe-action-button.test.tsx.

## Post-pass JS literals (b?) — 639 left, one reason per file group

- **198** — Theme/palette definitions (off-limits): lib/themes, mycountry-theme, economy/factory, onoma (12 files: lib/themes/mycountry-theme.ts, lib/themes/holographic-effects.ts, lib/economy/factory.ts, app/labs/onoma/glyphs/page.tsx, app/labs/onoma/components/nav/OnomaFooter.tsx, app/labs/onoma/components/nav/onoma-tabs.tsx, app/labs/onoma/components/sections/studio/StudioPhonology.tsx, app/labs/onoma/components/sections/studio/AcousticFormantVisualizer.tsx, …)
- **163** — Categorical identity palettes (department/revenue/budget, ideology, sport, category, section, cosmetic): hue = category, a status token would assert a false meaning (19 files: hooks/useActiveCosmetics.ts, lib/forum/forum-utils.ts, lib/media/cosmetics.ts, types/government.ts, app/admin/wiki/components/types.ts, app/admin/myleague/SportsLabsPanel.tsx, app/admin/vault/VaultStoreControl.tsx, app/myleague/page.tsx, …)
- **108** — Chart/series colours (recharts configs, serialized infobox/chart data) (14 files: hooks/useCountryComparison.ts, lib/economy/data-mapper.ts, app/builder/lib/wiki-builder-assembler.ts, app/admin/diplomatic-scenarios/_components/DiplomaticScenariosAnalyticsTab.tsx, app/admin/_components/AutosaveMonitoringDashboard.tsx, app/countries/_components/CountryComparisonModal.tsx, components/admin/equipment/AnalyticsTab.tsx, components/mycountry/shared/modals/metric-details/PopulationDetailsModal.tsx, …)
- **49** — Parsed or blended in JS (hexToRgb, `${c}20` alpha suffix, colour interpolation, === comparisons) (13 files: hooks/useBuilderTheming.ts, lib/media/image-color-extractor.ts, lib/color.ts, app/admin/facet-materials-lab/_components/templates/InteractiveActionTemplates.tsx, components/ui/health-ring.tsx, components/ui/facet/tabs/FacetTabs.tsx, components/wiki-os/margin/MarginGutterPins.tsx, components/wiki-os/margin/SelectionCapsule.tsx, …)
- **37** — Dimension/stat colours on country & wiki profiles (categorical per metric) (7 files: app/admin/rings-audit/RingsAuditPanel.tsx, app/countries/[slug]/_components/concepts/AtlasProfileView.tsx, app/countries/[slug]/_components/shared/RadialCountryDNA.tsx, app/countries/[slug]/_components/shared/GlobalPositionRankings.tsx, app/countries/[slug]/_components/shared/NationalConditionMatrix.tsx, app/(wiki-os)/wiki/user/[username]/page.tsx, components/mycountry/domains/diplomacy/EmbassyDetailSheet.tsx)
- **25** — User-chosen colours and data fallbacks (colour pickers, stash/alliance colours, map fills) (6 files: app/admin/facet-materials-lab/FacetLabPanel.tsx, components/wiki-os/editor/template-modals/MapCoordsModal.tsx, components/wiki-os/reader/StashButton.tsx, components/wiki-os/reader/StashManagerModal.tsx, components/wiki-os/stashes/types.ts, components/mycountry/domains/diplomacy/AllianceCreatorSheet.tsx)
- **20** — No exact token (v3 chromatic / off-token hex) in UI literals (16 files: hooks/map-editor/editor-types.ts, hooks/map-editor/map-editor-defaults.ts, lib/government/builder-validation.ts, lib/wiki-os/core/blurhash-service.ts, lib/country-geo/upsert.ts, app/admin/wiki/components/AwardsManagerSection.tsx, app/admin/_components/platform/BotControlCard.tsx, app/admin/_components/CountryFormulaFlow.tsx, …)
- **16** — Accent defaults, not status (amber section/'Open' actions, blue narrator/theme accent fallbacks) (9 files: components/halo/views/tray/NotificationRow.tsx, components/halo/views/tray/MessageTrayItem.tsx, components/halo/views/CompactView.tsx, components/halo/plugins/builder/BuilderHalo.tsx, components/halo/plugins/wiki/WikiHalo.tsx, components/halo/plugins/wiki/views/WikiNarratorView.tsx, components/halo/plugins/wiki/types.ts, components/halo/plugins/forum/ForumHalo.tsx, …)
- **15** — Builder/persisted data (written to builder state or DB) (5 files: hooks/useTaxBuilderState.ts, app/builder/hooks/useBuilderState.ts, app/builder/hooks/useBuilderSync.ts, app/builder/components/enhanced/steps/FoundationStep.tsx, app/builder/components/enhanced/steps/GovernmentStep.tsx)
- **8** — Sinks without CSS vars (MediaWiki-injected embed CSS, <meta theme-color>, canvas) (4 files: lib/wiki-os/editor/wiki-embed-shared.ts, context/theme-context.tsx, components/thinkpages/composer/useGlassCanvasComposer.ts, components/vault/CosmeticParticlesCanvas.tsx)

