# IxStates Branding Reference

**Last updated:** June 2026 — complete brand catalog covering all systems, icons, colors, symbols, and visual identity tokens across the platform.

> **Naming note:** IxStates is the platform/ecosystem (future product). IxStats is the current dev codename used in the repository (`package.json` name: `ixstates`) and database. The two names coexist — code is `ixstats`, brand is IxStates.

> **Versioning note:** All version numbers come from the **Version Registry** at `src/lib/buildVersion.ts` (the single source of truth) — see [`revision.md`](./revision.md). This doc intentionally does **not** quote version numbers; consult the registry, the About page, or the Developer panel for live values. The platform is **IxStates 1.1.1 "Ogma"** (channel: Alpha); Apps/Engines/Systems each carry a single capability integer.

---

## Brand Architecture

```
IxStates (platform/ecosystem)         ← versioned: 1.1.1 "Ogma" (Major.Minor.Patch + epoch + channel)
├── dev codename: IxStats

├── Apps (own brand, ship/break independently — single integer)
│   ├── IxWorld (maps)
│   ├── WikiOS (wiki software — powers the IxWiki content)
│   │   └── Canvas (visual editor — WikiOS sub-system)
│   └── IxVault (wallet/economy/trading cards)

├── Engines (internal-only simulation cores — single integer)
│   ├── MyCountry  (nation-scoped deterministic sim)
│   ├── Statecraft (executive intent parsing, power brokers, CivCap throughput, recon research)
│   ├── Concord    (living-world sim — time, diplomacy, crises, NPCs)
│   └── Atlas      (spatial foundation — worldgen, geo, maps; powers IxWorld)

├── UI / Feature Systems (single integer)
│   ├── Directives ★ (universal user-facing executive command & resolution brand)
│   ├── MyCountry ★ (flagship executive command UI)
│   ├── MyCountry Builder (nation creation wizard)
│   ├── ThinkPages (social knowledge sharing)
│   ├── Achievements & Awards (incl. LoreWards)
│   ├── Stash (save-for-later wiki articles)
│   ├── Repository (WikiOS Commons explorer)
│   ├── Halo (global contextual overlay)
│   ├── Blurbs
│   └── Admin CMS

├── Design System (single integer)
│   └── Facet (glass / refraction / depth design language)

├── Inherits platform version (NOT independently versioned)
│   ├── IxForum (community — not promoted to an App yet)
│   ├── Platform Utilities: IxTime (game clock), IxnayID (cross-platform identity)
│   ├── Experimental / Labs: Vexel, Onoma, Strata, Dynas, Nomora (preview label only)
│   └── Navigation Hubs: Dashboard, Explore / Countries, Feed

└── Infrastructure
    ├── Notifications
    ├── Help System
    ├── Consent Manager (c15t)
    ├── Flag Service
    ├── WebSocket / Real-Time
    ├── Cron Jobs
    └── Caching / Rate Limiting / Auth
```

---

## 1. Platform Identity

| Token                | Value                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| **Name**             | IxStates™ (platform/ecosystem)                                           |
| **Dev codename**     | IxStats (repo, package, database)                                        |
| **Project name**     | `ixstates` (`package.json`, Prisma schema headers)                       |
| **Version**          | `APP_VERSION` (from registry) — platform **1.1.1 "Ogma"**, channel Alpha |
| **Homepage**         | `https://ixwiki.com/projects/ixstats`                                    |
| **Meta title**       | `IxStats — Nations, economy, lore`                                       |
| **Meta description** | `Build your country from the ground up...`                               |

### Platform Logo

| Asset         | Location                                       | Description                                                            |
| ------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| **SVG logo**  | `src/app/_components/ix-logo-v2.svg`           | Custom flame/letter-path SVG                                           |
| **Component** | `src/components/ui/ixstats-logo.tsx`           | TrendingUp + Crown + Globe (Lucide) in circular border with pulse ring |
| **Gradient**  | `from-yellow-500 via-orange-500 to-yellow-600` | Logo text gradient                                                     |
| **Text**      | `IxStats™`                                     | Rendered in Playfair Display                                           |

### Platform Brand Colors

| Variable                  | Hex       | Tailwind   |
| ------------------------- | --------- | ---------- |
| `--color-brand-primary`   | `#6366f1` | indigo-500 |
| `--color-brand-secondary` | `#818cf8` | indigo-400 |
| `--color-brand-dark`      | `#4f46e5` | indigo-600 |
| `--color-brand-darker`    | `#4338ca` | indigo-700 |

**Default nav** (`DEFAULT_NAV`): shine `["#3b82f6", "#8b5cf6", "#06b6d4"]`, glow `text-blue-400`.

### Favicon & PWA

| Asset               | Value                         |
| ------------------- | ----------------------------- |
| **Favicon**         | `/favicon.ico`                |
| **PWA name**        | `IxCards - Trading Card Game` |
| **PWA short name**  | `IxCards`                     |
| **PWA theme color** | `#3b82f6` (blue-500)          |
| **PWA background**  | `#0a0a0a`                     |

---

## 2. Apps

Integrated apps with their own distinct brand identity that ship and break independently (each carries a single capability integer). **IxForum** is documented here for reference but is **not** an independently-versioned App yet — it inherits the platform version until promoted.

### 2.1 IxWorld (Maps)

| Token            | Value                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Version**      | `IXWORLD_VERSION` (from registry — single capability integer)                                                                                  |
| **Nav icon**     | Compass (Lucide)                                                                                                                               |
| **Accent hex**   | `#06b6d4` (cyan-500)                                                                                                                           |
| **Standalone**   | IxWorld — `maps.ixwiki.com` (port 3002/3003, `NEXT_PUBLIC_IXWORLD_STANDALONE`)                                                                 |
| **Prisma**       | `maps.prisma` (ProceduralWorld, Realm, CountrySovereignty, TransportRoute, TransportHub, StoryPin, ElevationZone, City, PointOfInterest, etc.) |
| **Key files**    | `src/app/maps/`, `src/components/maps/{core,editor,overlays,widgets}/`, `src/lib/map-*.ts`                                                     |
| **Map overlays** | Choropleth, Geopolitical, RiskHeatmap, TradeRoute, Transport                                                                                   |
| **Map widgets**  | CountryMapEmbed, DashboardMapWidget, MiniWorldMap                                                                                              |

#### Sub-systems

| Sub-system            | Description                                                                      |
| --------------------- | -------------------------------------------------------------------------------- |
| **Map Editor**        | Visual territory editor with border editing (`src/components/maps/editor/`)      |
| **Forge Mode**        | Admin superpowers toggle in Map Editor (`MapEditorOverlay.tsx:2518`, admin-only) |
| **Story Pins**        | 14 category × 3 importance levels = 42 canvas-generated map markers (see §7.3)   |
| **Procedural World**  | Auto-generated territories (`src/lib/procedural-archive/`)                       |
| **Geo Analytics**     | Spatial calculations, math, validation (`src/lib/geo-*.ts`)                      |
| **Transport Network** | Routes & hubs with generator (`src/lib/transport-generator.ts`)                  |
| **SVG Upload**        | Flag/map SVG management (`src/lib/svg-parser.ts`)                                |

### 2.2 IxForum (Community)

| Token              | Value                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Version**        | `IXFORUM_VERSION` (from registry) — **inherits the platform version**; not promoted to an independently-versioned App yet |
| **Nav icon**       | MessageSquare (Lucide)                                                                                                    |
| **Accent hex**     | `#f97316` (orange-500)                                                                                                    |
| **Shine**          | `["#f97316", "#ea580c", "#fb923c"]`                                                                                       |
| **Glow**           | `text-orange-400`                                                                                                         |
| **Glass var**      | `--glass-forum: #f97316`                                                                                                  |
| **Integration**    | XenForo REST API proxy (tRPC `forum.ts`, 1185 lines)                                                                      |
| **Routes**         | `src/app/(forum)/forum/`, `src/components/forum/{composer,reader,shared}/`                                                |
| **Widgets**        | ForumMiniCard, ForumRarityBar at `/(widget)/forum/cards/[username]/`                                                      |
| **Layout tagline** | `Powered by IxForum v{IXFORUM_VERSION}`                                                                                   |

### 2.3 IxVault (Wallet / Economy / Trading Cards)

| Token          | Value                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nav icon**   | GiCardRandom (React-Icons / Game Icons)                                                                                                       |
| **Accent hex** | `#06b6d4` (cyan-500)                                                                                                                          |
| **Shine**      | `["#06b6d4", "#0891b2", "#22d3ee"]`                                                                                                           |
| **Glow**       | `text-cyan-400`                                                                                                                               |
| **PWA**        | `IxCards - Trading Card Game` manifest with 8 icon sizes, 3 shortcuts                                                                         |
| **Prisma**     | `cards.prisma` (MyVault, Card, VaultTransaction, CardValueHistory, etc.)                                                                      |
| **Key routes** | `/vault/{cards,collections,crafting,create,import,inventory,lore-gallery,lore-generator,market,marketplace,ns-deck,ns-library,packs,trading}` |

#### Sub-systems

| Sub-system           | Description                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| **IxCards**          | Trading card game — Phase 1, replaces legacy IxBank. Card types: Nation, Lore, NS Import, Special.        |
| **IxCredits**        | Virtual currency (`src/components/vault/IxCreditsSymbol.tsx`, `src/lib/budget-vault-calculator.ts`)       |
| **Card Crafting**    | Card creation/combination with recipes. Prisma: `CraftingRecipe`, `CraftingHistory`. tRPC: `crafting.ts`. |
| **Card Trading**     | Peer-to-peer trades. Prisma: `CardTrade`, `TradeOffer`. tRPC: `trading.ts`.                               |
| **Card Marketplace** | Auction & trading platform. Prisma: `CardAuction`, `AuctionBid`. tRPC: `card-market.ts`.                  |
| **Card Packs**       | Pack purchase & animated opening. tRPC: `card-packs.ts`. 🎁 emoji.                                        |
| **Lore Cards**       | Wiki-generated narrative cards. Prisma: `LoreCardRequest`. tRPC: `lore-cards.ts`.                         |
| **NS Import / Sync** | NationStates data import and synchronization. Prisma: `NSImport`, `SyncLog`, `SyncCheckpoint`.            |

#### Vault Sidebar Sections

| Section     | Gradient                       |
| ----------- | ------------------------------ |
| Dashboard   | `from-purple-500 to-pink-500`  |
| Cards       | `from-amber-500 to-yellow-500` |
| Marketplace | `from-blue-500 to-cyan-500`    |
| Import      | `from-rose-500 to-orange-500`  |

### 2.4 WikiOS (Wiki software — renders the "IxWiki" content)

| Token           | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| **Nav icon**    | FaWikipediaW (React-Icons / Font Awesome)                            |
| **Accent hex**  | `#3b82f6` (blue-500)                                                 |
| **Brand SVG**   | `https://ixwiki.com/data/IxWiki_4.svg`                               |
| **Wordmark**    | WikiOSWordmark — IxLogoV2 + "WIKI" in Playfair Display               |
| **Tagline**     | `Worldbuilding Encyclopedia`                                         |
| **Integration** | MediaWiki API + direct MySQL bridge (`wiki-bridge.ts`, 1244 lines)   |
| **User agent**  | `IxStats-Builder`                                                    |
| **CSS vars**    | `--wikios-border`, `--wikios-bg`, `--wikios-accent`, `--wikios-text` |

#### Sub-systems

| Sub-system           | Version                     | Description                                                                                                                                                                          |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **WikiOS**           | `WIKIOS_VERSION` (registry) | The **App** — next-gen wiki software that powers the IxWiki content, deprecating legacy MediaWiki to "Classic Mode."                                                                 |
| **Canvas Editor**    | `CANVAS_VERSION` (registry) | WikiOS **sub-system** (nested sub-version): visual/contenteditable wiki editor (`src/components/wikios/editor/WikiVisualEditor.tsx`). Also used in ThinkPages Glass Canvas Composer. |
| **Image Repository** | —                           | WikiOS Commons Explorer at `/w/repository/`. Wikimedia Commons API proxy. tRPC: `commons.ts`.                                                                                        |

#### WikiOS Special Pages

recent-changes, random, search, watchlist, diff, user, whatlinkshere, categories, contributions, history, lorewards

#### WikiOS Sidebar Icons

Home, Clock, Shuffle, Search, ImageIcon, Trophy, FileEdit, MessageSquare, Link2, Bookmark

---

## 3. Core Systems

First-class systems within the IxStates platform.

### 3.1 MyCountry ★ (Flagship — Executive Command Suite)

| Token          | Value                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| **Nav icon**   | Crown (Lucide)                                                                                                 |
| **Nav label**  | `MyCountry®`                                                                                                   |
| **Accent hex** | `#f59e0b` (amber-500)                                                                                          |
| **Shine**      | `["#f59e0b", "#eab308", "#fbbf24"]`                                                                            |
| **Glow**       | `text-amber-400`                                                                                               |
| **Glass var**  | `--glass-mycountry: #ca8a04` (yellow-600)                                                                      |
| **Logo**       | Globe (amber bg) + Crown overlay + "MyCountry" text in amber gradient (`src/components/ui/mycountry-logo.tsx`) |
| **Route**      | `src/app/mycountry/` — single-page router pattern, 10+ sub-pages                                               |

#### Military & Security

| Sub-system                     | Gradient                  | Icon                     | Description                                                                                                                                |
| ------------------------------ | ------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Defense**                    | `from-red-500 to-red-600` | Shield / ShieldCheckIcon | Military branches, units, equipment, assets. Prisma: `military.prisma` (19 models). tRPC: `militaryEquipment.ts`, `smallArmsEquipment.ts`. |
| **Security**                   | —                         | ShieldAlert              | Threats, assessments, stability, border security. tRPC: `security.ts`.                                                                     |
| **Small Arms & Manufacturers** | —                         | —                        | Infantry weapons catalog + manufacturer management. Admin: `/admin/military-equipment/{,small-arms,manufacturers,analytics}/`.             |

**Equipment catalog icons:** Aircraft: Plane, Naval: Ship, Vehicle: Car, Missile: Rocket, Support: Wrench.

#### Governance & Politics

| Sub-system     | Gradient                        | Icon                 | Description                                                                                                                           |
| -------------- | ------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Government** | —                               | Landmark / Building2 | Departments, budget allocation, officials. Prisma: `government.prisma` (33 models). tRPC: `government.ts`, `governmentComponents.ts`. |
| **Elections**  | `from-indigo-500 to-indigo-600` | Vote / VoteIcon      | Political parties, candidates, D'Hondt/FPTP seat allocation, legislature config. tRPC: `elections.ts`.                                |
| **Policies**   | —                               | FileText             | Policy creation, effects, scheduling. Prisma: `Policy`, `PolicyEffectLog`. tRPC: `policies.ts`.                                       |

#### Economy & Resources

| Sub-system                | Gradient | Icon             | Description                                                                                                                      |
| ------------------------- | -------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Economy**               | —        | TrendingUp       | Economic modeling, indicators, archetypes. Glass var: `--glass-eci: #4f46e5` (indigo-600). Prisma: `economy.prisma` (33 models). |
| **Tax System**            | —        | —                | Brackets, deductions, exemptions. Prisma: `TaxSystem`, `TaxCategory`, `TaxBracket`. tRPC: `taxSystem.ts`, `atomicTax.ts`.        |
| **Resources & Transport** | —        | Database / Truck | Nation resource management + transport routes/hubs. tRPC: `resources.ts`, `transport.ts`.                                        |

#### Intelligence & Diplomacy

| Sub-system               | Gradient                    | Icon              | Description                                                                                                                                                                 |
| ------------------------ | --------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Intelligence**         | `from-blue-500 to-blue-600` | Brain / BrainIcon | Briefings, alerts, recommendations, forecasting. Prisma: `intelligence.prisma`. tRPC: `intelligence/`. Shine: `["#6366f1", "#4f46e5", "#818cf8"]`, glow: `text-indigo-400`. |
| **Diplomacy**            | `from-cyan-500 to-cyan-600` | Users / UsersIcon | Embassies, scenarios, cultural exchange, NPC personalities, Markov engine. Prisma: `diplomacy.prisma`. tRPC: `diplomacy/`.                                                  |
| **Diplomatic WebSocket** | —                           | —                 | Real-time diplomatic events (`src/lib/diplomatic-websocket.ts`, 600 lines).                                                                                                 |

**Embassy emojis:** 🏛️ (establishment), 🎯 (mission), ✅ (success), ❌ (failed/severed).

#### National Management

| Sub-system            | Icon          | Description                                                                                          |
| --------------------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| **National Issues**   | AlertTriangle | Configurable issue templates with consequences. Prisma: `NationalIssue`, `NationalIssueConsequence`. |
| **Crisis Events**     | Zap           | Dynamic world events affecting nations. Prisma: `CrisisEvent`, `WorldEvent`, `EventChain`.           |
| **National Identity** | Flag          | Cultural identity data (60 fields). tRPC: `nationalIdentity.ts`.                                     |
| **Meetings**          | Calendar      | Cabinet meetings, agendas, decisions, action items. tRPC: `meetings.ts`.                             |

---

### 3.2 MyCountry Builder (Nation Creation Wizard)

| Token                 | Value                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Version**           | `BUILDER_VERSION` (from registry — single capability integer)                                                           |
| **Glass var**         | `--glass-builder: #10b981` (emerald-500)                                                                                |
| **Nav (notch) icons** | Foundation: Globe, Identity: Flag, Government: Building2, Economics: TrendingUp, Preview: CheckCircle, Import: Download |
| **Route**             | `src/app/builder/`                                                                                                      |
| **Logo sub-brand**    | `BUILDER®` or `EDITOR®` badge in MyCountry logo component                                                               |

#### Sub-systems

| Sub-system            | Description                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Builder Sections**  | 7 step-through sections: CoreIndicators, Demographics, Economy, FiscalSystem, GovernmentSpending, GovernmentStructure, LaborEmployment                          |
| **Atomic Components** | Modular building system — AtomicEconomicComponents, AtomicGovernmentComponents, AtomicTaxComponents. Synergy/conflict system (`src/lib/synergy-calculator.ts`). |
| **IIWiki Importer**   | Wiki data ingestion for country creation. tRPC: `wikiImporter.ts`.                                                                                              |

---

### 3.3 ThinkPages (Social Knowledge Sharing)

| Token             | Value                                                                         |
| ----------------- | ----------------------------------------------------------------------------- |
| **Version**       | `THINKPAGES_VERSION` (from registry — single capability integer)              |
| **Nav icon**      | ThinkPagesIcon (custom SVG: cyan-to-teal gradient) + Rss (Lucide, contextual) |
| **Accent hex**    | `#3b82f6` (blue-500)                                                          |
| **Shine**         | `["#3b82f6", "#1d4ed8", "#60a5fa"]`                                           |
| **Glow**          | `text-blue-400`                                                               |
| **Logo**          | `public/thinkpages-logo.svg`                                                  |
| **Prisma**        | `social.prisma` (ThinkpagesAccount, ThinkpagesPost, etc.)                     |
| **Reactions**     | ❤️ like, 😂 funny, 😡 angry, 😢 sad, 🔥 fire, 👍 thumb up, 👎 thumb down      |
| **Custom emojis** | Discord CDN: ixnay, heky_boi, pog                                             |
| **Status widget** | `ThinkPagesStatusWidget.tsx` — displays platform v{THINKPAGES_VERSION}        |

#### Sub-systems

| Sub-system     | Description                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **ThinkShare** | Unified messaging backbone — diplomatic DMs, personal messaging. Prisma: `ThinkshareConversation`, `ThinkshareMessage`. tRPC: `thinkpages.ts`. |
| **ThinkTanks** | Collaborative group discussions. Prisma: `ThinktankGroup`, `ThinktankMember`, `ThinktankMessage`.                                              |
| **IxTwitter**  | Discord auto-poster for ThinkPages content. tRPC backfill via `discord-ixtwitter-sync.ts`.                                                     |

---

### 3.4 Achievements & Awards

| Token               | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| **Default trophy**  | 🏆                                                                 |
| **Featured**        | ⭐ / 📝                                                            |
| **Locked**          | 🔒                                                                 |
| **Definition file** | `src/lib/achievement-definitions.ts` (946 lines, 50+ achievements) |
| **Categories**      | Economic, Military, Diplomatic, Government, Social, General        |

#### Category Icons

| Category   | Lucide Icon |
| ---------- | ----------- |
| Economic   | TrendingUp  |
| Diplomatic | Globe       |
| Government | Landmark    |
| Military   | Shield      |
| Social     | BookOpen    |
| General    | Trophy      |

#### Quest Path Icons

| Path        | Lucide Icon |
| ----------- | ----------- |
| Merchant    | TrendingUp  |
| Prosperity  | Sparkles    |
| Warlord     | Shield      |
| Diplomat    | Globe       |
| Sovereign   | Landmark    |
| Thinker     | BookOpen    |
| Vidmaster   | Crown       |
| Lore & Meme | Trophy      |

#### Sub-systems

| Sub-system                    | Description                                                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Achievement Constellation** | Visual achievement display (`src/components/achievements/AchievementConstellation.tsx`)                                                                                 |
| **Quest Paths**               | Achievement progression trees (`src/components/achievements/QuestPathCard.tsx`)                                                                                         |
| **LoreWards**                 | Wiki scoring & medals system. Prisma: `LorewardEntry`, `LorewardUserStats`, `LorewardCrossValidation`. tRPC: `lorewards.ts`. Admin wiki icons: 🏆 🏅 👑 🛡️ 🎖️ 👥 ✔️ ✨. |

---

### 3.5 Stash

Save-for-later wiki articles with annotations. Integrated with WikiOS reader (`StashButton.tsx`). _(Formerly "LoreStash"; the Prisma models `LoreStash`/`LoreStashItem` keep their names.)_

| Token      | Value                                     |
| ---------- | ----------------------------------------- |
| **Icon**   | Bookmark (Lucide)                         |
| **Prisma** | `LoreStash` (30+ fields), `LoreStashItem` |
| **Routes** | `src/app/stashes/`                        |

---

### 3.6 Blurbs

Community wiki content reviews/blurbs. Mentioned in WikiOS integrations.

| Token      | Value                                           |
| ---------- | ----------------------------------------------- |
| **Icon**   | FileEdit (Lucide)                               |
| **Prisma** | `BlurbPrompt`, `BlurbResponse`                  |
| **Routes** | `src/app/blurbs/` (index, mine, submit, [slug]) |
| **tRPC**   | `blurbs.ts`                                     |

---

### 3.7 Halo

Global contextual UI overlay system with plugin architecture. _(Formerly "Dynamic Island". The code directory `src/components/DynamicIsland/` keeps its name pending a separate mechanical rename.)_

| Token        | Value                                 |
| ------------ | ------------------------------------- |
| **Location** | `src/components/DynamicIsland/`       |
| **Plugins**  | Wiki, Forum, Maps, Builder, MyCountry |
| **Views**    | CompactView, ExpandedView             |
| **Docs**     | `docs/systems/dynamic-island.md`      |

---

### 3.8 Admin CMS

50+ admin interfaces for platform management. Icon: Settings (Lucide). Accent: `#ef4444` (red-500). Shine: `["#ef4444", "#dc2626", "#f87171"]`. Glow: `text-red-400`.

| Category        | Interfaces                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| **Content**     | Wiki, Cards, Card Packs, Vault, Blurbs, Lore Cards Batch Generator                                              |
| **World**       | Maps, Map Editor                                                                                                |
| **Military**    | Equipment, Small Arms, Manufacturers, Analytics                                                                 |
| **Economy/Gov** | Economic Components, Economic Archetypes, Government Components                                                 |
| **Diplomacy**   | Diplomatic Scenarios (+ analytics), Diplomatic Options (+ analytics), NPC Personalities, Intelligence Templates |
| **Nations**     | Countries, Users, National Issues, Membership                                                                   |
| **Platform**    | Platform Config, Notifications, Polls, Reference Data, NS Sync                                                  |
| **System**      | Storyteller™, Studio, Rings Audit, Autosave Monitor, System Validation                                          |

**Storyteller™**: Narrative DM tool for world-building effects. Route: `/admin/storyteller/`. Prisma: `StorytellerEffect`, `Storyline`, `StoryPin`. Also accessible via `/dm-dashboard/`.

---

## 4. Experimental / Labs

Prototype and early-stage experimental systems. Nav icon: GiSoapExperiment (Game Icons).

| Lab        | Icon                                  | Description                                                                                                                                                                                                                                                        |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vexel**  | GiVibratingShield                     | —                                                                                                                                                                                                                                                                  |
| **Onoma**  | GiSoapExperiment / Rotating DNA Helix | Language & Naming Engine: Procedural name generator + conlang linguistics engine with interactive Markov path visualizer, Shannon entropy analytics, case declensions, and three-tier fallback speech synthesis (Kokoro TTS container + Web Speech API + meSpeak). |
| **Strata** | FaTreeCity                            | —                                                                                                                                                                                                                                                                  |
| **Dynas**  | GiFamilyTree                          | —                                                                                                                                                                                                                                                                  |
| **Nomora** | FaLanguage                            | —                                                                                                                                                                                                                                                                  |

---

## 5. Platform Utilities

Cross-cutting services without a user-facing product identity.

### 5.1 IxTime (Game Clock)

| Token                | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| **Class**            | `IxTime` in `src/lib/ixtime.ts` (642 lines)                            |
| **Multiplier**       | 4×/2× configurable                                                     |
| **Real-world epoch** | October 2020                                                           |
| **In-game epoch**    | January 2028                                                           |
| **Bot**              | External Discord-based bot on port 3001 (`NEXT_PUBLIC_IXTIME_BOT_URL`) |
| **Routes**           | `/api/ixtime/`, `/api/ixtime-status/`                                  |

### 5.2 IxnayID

Cross-platform identity linking service — unifies Forum, Wiki, and Discord identities. tRPC: `ixnayid.ts`.

---

## 6. Infrastructure

### 6.1 Facet (Design System)

The platform's design system — a glass / refraction / depth visual language used throughout all UI (independently versioned; `FACET_VERSION` in the registry). File: `src/styles/glass-refraction.css` (1379 lines). _(Formerly "Glass Physics". The CSS tokens/classes `--glass-*` / `glass-*` keep their names pending a separate mechanical rename.)_

**Glass CSS Variables:**

| Variable            | Hex       | Tailwind    | Semantic                     |
| ------------------- | --------- | ----------- | ---------------------------- |
| `--glass-mycountry` | `#ca8a04` | yellow-600  | MyCountry accent             |
| `--glass-global`    | `#2563eb` | blue-600    | Global/maps accent           |
| `--glass-eci`       | `#4f46e5` | indigo-600  | Economic indicators          |
| `--glass-sdi`       | `#dc2626` | red-600     | Strategic Defense Initiative |
| `--glass-builder`   | `#10b981` | emerald-500 | Builder wizard               |
| `--glass-forum`     | `#f97316` | orange-500  | Forum community              |

### 6.2 Notifications

Global notification center. Components: `GlobalNotificationSystem`, `LiveDataIntegration`, `NotificationBadgeProvider`, `UnifiedNotificationCenter`. tRPC: `notifications.ts`.

### 6.3 Help System

In-app help center (`/help/`). Routes for economy, defense, diplomacy, intelligence, technical, vault. Icon: BookOpen (Lucide). Shine: `["#fb923c", "#f97316", "#fdba74"]`. Glow: `text-orange-400`.

### 6.4 Consent Manager (c15t)

GDPR-style consent management. Package: `@c15t/nextjs`, `@c15t/backend`. Prisma: `c15t.prisma`. Route: `/api/c15t/`.

### 6.5 Flag Service

Multi-source flag resolution pipeline. Key files: `unified-flag-service.ts`, `flag-color-extractor.ts`, `flag-color-analysis.ts`. Component: `UnifiedCountryFlag.tsx`. NS image proxy: `/api/proxy-ns-image`.

### 6.6 WebSocket / Real-Time

| System                     | Status           | Key File                                                                   |
| -------------------------- | ---------------- | -------------------------------------------------------------------------- |
| **Intelligence WebSocket** | Production only  | `src/lib/websocket-server.ts`, `src/server/websocket-server.ts`            |
| **Market WebSocket**       | Always enabled   | `src/lib/market-websocket-server.ts`, `src/lib/market-websocket-client.ts` |
| **Diplomatic WebSocket**   | Production only  | `src/lib/diplomatic-websocket.ts`                                          |
| **ThinkPages WebSocket**   | Live social feed | `src/hooks/useThinkPagesWebSocket.ts`                                      |

### 6.7 Cron Jobs

Production-only scheduled jobs (`server.mjs` + `src/lib/*-cron.ts`).

| Cron                        | Schedule        | Lib File                              |
| --------------------------- | --------------- | ------------------------------------- |
| Auction Completion          | Every minute    | `auction-completion-cron.ts`          |
| Passive Income Distribution | Daily midnight  | `passive-income-distribution-cron.ts` |
| Card Value Update           | Every 6 hours   | `nation-card-value-update-cron.ts`    |
| Lore Card Generation        | Daily 02:00 UTC | `lore-card-generation-cron.ts`        |
| Trade Expiry                | Every 5 minutes | `trade-expiry-cron.ts`                |
| IxTwitter Discord Sync      | Hourly          | `discord-ixtwitter-sync.ts`           |
| Lorewards Full Sync         | Daily 06:00     | `lorewards-sync.ts`                   |
| Scheduled Changes           | On-tick         | `apply-scheduled-changes.ts`          |
| Equipment Image Validation  | On-schedule     | `validate-equipment-images.ts`        |

### 6.8 Caching / Rate Limiting / Auth

| Service                | Description                                                                   |
| ---------------------- | ----------------------------------------------------------------------------- |
| **Redis**              | Rate limiting + caching (ioredis). Falls back to in-memory if unavailable.    |
| **External API Cache** | Multi-tier cache for MediaWiki, Unsplash, Wikimedia, FlagCDN, REST Countries. |
| **Rate Limiter**       | Per-user and global rate limiting (`src/lib/rate-limiter.ts`).                |
| **Clerk Auth**         | User authentication (`@clerk/nextjs`, `src/proxy.ts`).                        |
| **Database**           | PostgreSQL + PostGIS via Prisma. 15 schema files, 296 models.                 |

---

## 7. Navigation Hubs

Entry-point pages that aggregate content from multiple systems. Not branded products themselves.

| Hub                     | Icon      | Accent Hex          | Shine                               | Glow               |
| ----------------------- | --------- | ------------------- | ----------------------------------- | ------------------ |
| **Dashboard**           | BarChart3 | `#10b981` (emerald) | `["#10b981", "#059669", "#34d399"]` | `text-emerald-400` |
| **Explore / Countries** | Globe     | `#8b5cf6` (purple)  | `["#8b5cf6", "#7c3aed", "#a78bfa"]` | `text-purple-400`  |
| **Feed**                | Activity  | `#8b5cf6` (purple)  | `["#8b5cf6", "#7c3aed", "#a78bfa"]` | `text-purple-400`  |

---

## 8. Visual Identity System

### 8.1 Global System → Color Mapping

| System              | Accent Hex | Shine Gradient                      | Glow Class         |
| ------------------- | ---------- | ----------------------------------- | ------------------ |
| IxStates (default)  | `#3b82f6`  | `["#3b82f6", "#8b5cf6", "#06b6d4"]` | `text-blue-400`    |
| MyCountry           | `#f59e0b`  | `["#f59e0b", "#eab308", "#fbbf24"]` | `text-amber-400`   |
| Dashboard           | `#10b981`  | `["#10b981", "#059669", "#34d399"]` | `text-emerald-400` |
| ThinkPages          | `#3b82f6`  | `["#3b82f6", "#1d4ed8", "#60a5fa"]` | `text-blue-400`    |
| Explore / Countries | `#8b5cf6`  | `["#8b5cf6", "#7c3aed", "#a78bfa"]` | `text-purple-400`  |
| Feed                | `#8b5cf6`  | `["#8b5cf6", "#7c3aed", "#a78bfa"]` | `text-purple-400`  |
| Maps / IxWorld      | `#06b6d4`  | (nav tray only)                     | —                  |
| Cards / Vault       | `#06b6d4`  | `["#06b6d4", "#0891b2", "#22d3ee"]` | `text-cyan-400`    |
| Forum / IxForum     | `#f97316`  | `["#f97316", "#ea580c", "#fb923c"]` | `text-orange-400`  |
| Wiki / WikiOS       | `#3b82f6`  | (nav tray only)                     | —                  |
| Admin               | `#ef4444`  | `["#ef4444", "#dc2626", "#f87171"]` | `text-red-400`     |
| Help                | `#fb923c`  | `["#fb923c", "#f97316", "#fdba74"]` | `text-orange-400`  |
| Intelligence        | `#6366f1`  | `["#6366f1", "#4f46e5", "#818cf8"]` | `text-indigo-400`  |

### 8.2 Halo NavTray Section Colors

| Route         | Accent Hex | Label      |
| ------------- | ---------- | ---------- |
| `/dashboard`  | `#10b981`  | Dashboard  |
| `/mycountry`  | `#f59e0b`  | MyCountry  |
| `/countries`  | `#8b5cf6`  | Explore    |
| `/maps`       | `#06b6d4`  | Maps       |
| `/w`          | `#3b82f6`  | Wiki       |
| `/forum`      | `#f97316`  | Forum      |
| `/vault`      | `#06b6d4`  | Cards      |
| `/thinkpages` | `#3b82f6`  | ThinkPages |
| `/admin`      | `#ef4444`  | Admin      |
| `/feed`       | `#8b5cf6`  | Feed       |

### 8.3 Story Pin Category Colors (IxWorld Maps)

14 categories × 3 importance levels = 42 canvas-generated markers.

| Category    | Hex       | Tailwind   | Semantic                  |
| ----------- | --------- | ---------- | ------------------------- |
| battle      | `#dc2626` | red-600    | Military conflicts        |
| founding    | `#2563eb` | blue-600   | Nation origins            |
| treaty      | `#16a34a` | green-600  | Diplomatic agreements     |
| cultural    | `#9333ea` | purple-600 | Arts, cuisine, traditions |
| religious   | `#ca8a04` | yellow-600 | Faith, churches           |
| trade       | `#ea580c` | orange-600 | Commerce, companies       |
| naval       | `#1e40af` | blue-800   | Ships, maritime           |
| settlement  | `#7c3aed` | violet-600 | City founding             |
| government  | `#475569` | slate-600  | Political events          |
| biography   | `#be185d` | pink-700   | Notable people            |
| linguistic  | `#65a30d` | lime-600   | Language, ethnicity       |
| upheaval    | `#991b1b` | red-800    | Revolutions, civil wars   |
| natural     | `#059669` | teal-600   | Geographic/environmental  |
| exploration | `#0891b2` | cyan-600   | Discovery, expeditions    |

### 8.4 Wiki Country Section Icons (Remix Icons)

| Section      | Icon                    |
| ------------ | ----------------------- |
| overview     | RiGlobalLine            |
| geography    | RiMapLine               |
| government   | RiBuildingLine          |
| economy      | RiMoneyDollarCircleLine |
| demographics | RiTeamLine              |
| history      | RiHistoryLine           |
| culture      | RiHeartLine             |
| military     | RiShieldLine            |
| education    | RiBookOpenLine          |

### 8.5 Chat Badge / Cosmetic Icon Pool

**Badges**: Crown, Shield, Sparkles, Flame, Swords, Award, Star, Heart, Check, Zap, Trophy, ShieldAlert, Gem, Gift

**Department categories**: GraduationCap, Briefcase, Globe, Home, Users, Truck, Leaf, Building, Wifi, Palette, Beaker, Medal, Eye, AlertTriangle, MoreHorizontal

**Government component defaults**: Settings, Building2, Vote, Clock, TrendingUp, Cross, Scale, Flag, Cpu, DollarSign, Target, BarChart3, Brain, Monitor, Network, CheckCircle, BookOpen, Handshake, Microscope, Lightbulb, ArrowRightLeft, Copyright, MessageSquare, RefreshCw, Info, Upload

(Resolved in `src/lib/resolve-lucide-icon.ts`)

---

## 9. Icon Libraries Used

| Library                        | Package                    | Usage                                                                        |
| ------------------------------ | -------------------------- | ---------------------------------------------------------------------------- |
| **Lucide React**               | `lucide-react`             | Primary icon set — nav, sidebar, UI elements                                 |
| **React Icons (Font Awesome)** | `react-icons/fa`           | Wiki nav (FaWikipediaW), Labs (FaLanguage)                                   |
| **React Icons (Game Icons)**   | `react-icons/gi`           | Cards nav (GiCardRandom), Labs (GiSoapExperiment), Vexel (GiVibratingShield) |
| **React Icons (Remix)**        | `react-icons/ri`           | Country wiki section labels                                                  |
| **Custom Animated Icons**      | `src/components/ui/icons/` | 36 animated SVG components                                                   |

### Custom Animated Icon Catalog

Activity, AlertTriangle, ArrowTrendingUp, ArrowTrendingDown, Bell, BookOpen, Brain, Briefcase, ChartBar, ChartPie, Cog, Crown, CurrencyDollar, Eye, GlobeAlt, Heart, Landmark, Layers, LayoutDashboard, LockClosed, MagnifyingGlass, Map, MapPin, MousePointer, PaintBrush, Pencil, Plus, RocketLaunch, Scroll, ShieldCheck, Sparkles, Star, Target, Trash, Trophy, Users, Vote

---

## 10. External Integrations

| Integration            | Purpose                               | Key Reference                                 |
| ---------------------- | ------------------------------------- | --------------------------------------------- |
| **NationStates API**   | Nation data, verification, card dumps | `ns-api-client.ts`, `/api/proxy-ns-image`     |
| **IxWiki (MediaWiki)** | Country infobox, wiki articles        | `mediawiki-service.ts`                        |
| **IIWiki**             | Secondary wiki source                 | `mediawiki-config.ts` (WikiSource.IIWIKI)     |
| **Althistory Wiki**    | Tertiary wiki source                  | `mediawiki-config.ts` (WikiSource.ALTHISTORY) |
| **Clerk**              | Authentication                        | `@clerk/nextjs`, `src/proxy.ts`               |
| **Discord API**        | Bot, webhooks, user sync              | `discord.ts`, `discord-webhook.ts`            |
| **XenForo**            | Forum backend                         | `modules/forum/services/xenforo-service.ts`   |
| **Unsplash**           | Card backgrounds                      | `unsplash-service.ts`                         |
| **Giphy**              | GIF picker                            | ThinkPages composer                           |
| **Wikimedia Commons**  | Image repository                      | `wikiCommonsImageService.ts`                  |
| **FlagCDN**            | Flag images                           | Referenced in external API cache              |
| **c15t**               | Consent management                    | `@c15t/nextjs`, `prisma/schema/c15t.prisma`   |
| **MapLibre GL**        | Map rendering                         | `src/components/maps/core/`                   |
| **Redis (ioredis)**    | Rate limiting, caching                | `rate-limiter.ts`                             |
| **Socket.IO**          | WebSocket transport                   | `server.mjs`                                  |
| **node-cron**          | Scheduled jobs                        | `server.mjs`                                  |
