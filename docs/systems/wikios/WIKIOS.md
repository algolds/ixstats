# WikiOS v1.0-alpha

**A modern wiki frontend replacing MediaWiki's UI** — built with Next.js 16, React 19, a contentEditable visual editor, CodeMirror 6, and Parsoid.

WikiOS lives within IxStats as a `(wikios)` route group. MediaWiki continues to run headlessly as the backend for content storage, Lua/Scribunto template processing, and the Parsoid wikitext-to-HTML engine. WikiOS replaces everything the user sees and touches.

## Why WikiOS?

MediaWiki's frontend was designed in 2004. WikiOS reimagines the wiki experience with:

- **Instant navigation** — React SPA with client-side routing, no full page reloads
- **Sub-second article loads** — Direct MySQL queries (38ms) instead of PHP API (8.6s)
- **Modern editing** — contentEditable WYSIWYG + CodeMirror source editor with live preview
- **Facet design** *(glass/refraction/depth)* — Dark-mode-first UI matching IxStats' design system
- **Gamified contributions** — Lorewards daily/weekly/monthly awards with streak tracking
- **Community prompts** — Blurbs system for Topic Tuesday cultural dispatches
- **Lore Stash** — Color-coded article collections with text annotations
- **Unified platform** — Wiki, maps, economic data, and social features in one app

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                    │
│  ├─ ArticleRenderer    ← reads articles                 │
│  ├─ WikiVisualEditor   ← WYSIWYG editing (contentEditable)                │
│  ├─ WikiSourceEditor   ← wikitext editing               │
│  ├─ TemplateInserter   ← template picker + forms        │
│  ├─ Stash              ← save-for-later collections     │
│  ├─ Lorewards          ← contribution leaderboard       │
│  ├─ Blurbs             ← Topic Tuesday prompts          │
│  └─ CategoryTree       ← lazy-loaded navigation         │
└──────────────┬──────────────────────────────────────────┘
               │ tRPC (type-safe)
┌──────────────┴──────────────────────────────────────────┐
│  WikiOS Router (34 endpoints)                           │
│  Blurbs Router (12 endpoints)                           │
│  Lorewards Router (11 endpoints)                        │
│  ├─ Reader: getArticleHtml, search, history, diff       │
│  ├─ Editor: saveArticle, saveWikitext, preview          │
│  ├─ Templates: searchTemplates, getTemplateData         │
│  ├─ Stash: stashPage, getAnnotations, addAnnotation     │
│  ├─ Blurbs: getActivePrompts, submitResponse            │
│  ├─ Lorewards: getLeaderboard, getUserStats             │
│  └─ Categories: getCategoryMembers, getParentCategories │
└──────────────┬──────────────────────────────────────────┘
               │
┌──────────────┴──────────────────────────────────────────┐
│  Data Sources                                           │
│  ├─ MediaWiki Action API (parse, search, revisions)     │
│  ├─ Parsoid REST API (wikitext ↔ HTML roundtrip)        │
│  ├─ Direct MySQL (WikiBridge, 38ms per article)         │
│  └─ PostgreSQL (Prisma — 9 WikiOS models)               │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── app/(wikios)/                          # Route group (15 pages)
│   ├── w/
│   │   ├── page.tsx                       # Redirect → Main_Page
│   │   ├── layout.tsx                     # WikiOS layout wrapper
│   │   ├── [slug]/page.tsx                # Article reader
│   │   ├── [slug]/edit/page.tsx           # Article editor (dual mode)
│   │   └── [slug]/talk/page.tsx           # Talk/discussion page
│   └── wiki-special/
│       ├── search/page.tsx                # Full-text search
│       ├── stashes/page.tsx               # Lore Stash browser
│       ├── recent-changes/page.tsx        # Recent edits feed
│       ├── history/[slug]/page.tsx        # Revision history
│       ├── diff/page.tsx                  # Visual diff viewer
│       ├── random/page.tsx                # Random article redirect
│       ├── categories/[...slug]/page.tsx  # Category browser
│       ├── whatlinkshere/[slug]/page.tsx   # Backlinks
│       ├── contributions/[user]/page.tsx  # User edit history
│       ├── user/[username]/page.tsx       # User profile page
│       ├── images/page.tsx                # Image/file gallery
│       └── lorewards/page.tsx             # Lorewards leaderboard
│
├── app/blurbs/                            # Blurbs system (2 pages)
│   ├── page.tsx                           # Browse active prompts
│   └── [slug]/page.tsx                    # Single prompt + responses
│
├── app/admin/blurbs/                      # Admin dashboard
│   └── page.tsx                           # Prompt CRUD + response moderation
│
├── components/wikios/                     # Components (30+ files)
│   ├── reader/
│   │   ├── ArticleRenderer.tsx            # Main article display
│   │   ├── WikiOSMainPage.tsx             # Custom homepage (stats, featured, explore)
│   │   ├── StickyToc.tsx                  # Table of contents sidebar
│   │   ├── FloatingTocPill.tsx            # Compact TOC (mobile)
│   │   ├── LinkPreview.tsx                # Hover link tooltips
│   │   ├── ImageLightbox.tsx              # Full-screen image viewer
│   │   ├── InfoboxWithMap.tsx             # Infobox + IxWorld map embed
│   │   ├── SearchOverlay.tsx              # Cmd+K search autocomplete
│   │   ├── CategoryBreadcrumb.tsx         # Category hierarchy breadcrumbs
│   │   ├── CategoryTreeExplorer.tsx       # Expandable category tree
│   │   ├── AnnotationOverlay.tsx          # Text selection highlights + comments
│   │   ├── StashButton.tsx                # One-click stash/unstash toggle
│   │   ├── IxStatsEmbed.tsx               # Economic data embed blocks
│   │   ├── IxWorldEmbed.tsx               # Country/location map embed
│   │   └── IxTimeTooltip.tsx              # Timeline hover tooltip
│   ├── editor/
│   │   ├── WikiVisualEditor.tsx           # contentEditable WYSIWYG editor (data-mw roundtrip)
│   │   ├── WikiSourceEditor.tsx           # CodeMirror 6 source editor
│   │   ├── WikiTemplateModals.tsx         # Infobox/CountryStats/MapCoords insert modals
│   │   ├── TemplateInserter.tsx           # Template picker + parameter forms
│   │   ├── ImageSearchGrid.tsx            # Image search results grid
│   │   └── ImageSearchModal.tsx           # Upload + search for inserting images
│   ├── shared/
│   │   ├── WikiOSLayout.tsx               # Navigation rail + shell + footer
│   │   ├── WikiContext.tsx                 # TOC & article state context
│   │   ├── LorewardsIcon.tsx              # Animated award icon
│   │   └── useWikiOSShortcuts.ts          # Keyboard shortcuts
│   └── profile/
│       └── StreakCalendar.tsx              # Heatmap calendar for award streaks
│
├── components/blurbs/                     # Blurbs components (3 files)
│   ├── BlurbPromptList.tsx                # Infinite-scroll prompt listing
│   ├── BlurbPromptDetail.tsx              # Prompt + responses + submission form
│   └── BlurbCountryGallery.tsx            # Country-specific blurb gallery
│
├── lib/wikios/                            # Core utilities (7 files)
│   ├── html-transformer.ts                # Server-side HTML processing
│   ├── parsoid-client.ts                  # Parsoid REST API client + cache
│   ├── template-registry.ts               # TemplateData sync + categorization
│   ├── url-compat.ts                      # /wiki/ ↔ /w/ URL conversion
│   ├── wikitext-diff.ts                   # Line-by-line diff engine
│   ├── mediawiki-timestamp.ts             # Timestamp formatting
│   └── csrf-cache.ts                      # CSRF token cache for edits
│
├── server/api/routers/
│   ├── wikios.ts                          # WikiOS tRPC router (34 endpoints)
│   ├── blurbs.ts                          # Blurbs tRPC router (12 endpoints)
│   └── lorewards.ts                       # Lorewards tRPC router (11 endpoints)
│
└── styles/
    ├── wikios/                            # Modular design system stylesheets
    │   ├── variables.css                  # Theme custom properties, tokens, and colors
    │   ├── layout.css                     # Outer page shell, sidebar, and headers layout
    │   ├── elements.css                   # Typography, buttons, forms, and glass cards
    │   ├── components.css                 # Wiki components: Toc, Infoboxes, Search, special pages
    │   ├── integrations.css               # PlateJS editor blocks, maps, and special widgets
    │   ├── lorewards.css                  # Scoreboard, streaks calendar, and user achievements
    │   ├── editors.css                    # CodeMirror wikitext, WikiOS Canvas layout, and Writer mode
    │   └── animations.css                 # Smooth transitions and spring-based transforms
    └── wikios.css                         # Unified style entry point


prisma/
├── schema.prisma                          # 9 WikiOS models
└── seed-blurbs.ts                         # 34 seed prompts from Discord
```

## Features

### Reading

| Feature | Description |
|---------|-------------|
| **Article Rendering** | Server-side HTML transformation with infobox extraction, TOC generation, notice separation |
| **Sticky TOC** | Right-side table of contents with scroll-spy (highlights active section) |
| **Floating TOC Pill** | Compact mobile-friendly TOC |
| **Link Previews** | Hover any wiki link to see article intro with redirect resolution |
| **Image Lightbox** | Click any article image for full-screen viewing |
| **Category Breadcrumbs** | Parent category hierarchy shown above each article |
| **Infobox + Map** | Infoboxes extracted and displayed with embedded IxWorld maps |
| **Client Navigation** | Wiki link clicks use Next.js router — no full page reloads |
| **Custom Main Page** | Stats dashboard (articles, edits, users, blurbs), featured article, category grid, country cards |
| **Award Badges** | Articles that have won Lorewards display a badge |
| **IxStats Embeds** | Inline economic data blocks from IxStats |
| **IxWorld Embeds** | Inline country/location map embeds |
| **IxTime Tooltips** | Hover dates to see IxStats timeline context |

### Editing

| Feature | Description |
|---------|-------------|
| **WikiOS Canvas** | Canvas is WikiOS's premium writing environment featuring distraction-free editing, visual/source modes, live previews, templates, and Writer Mode. |
| **Visual Editor** | contentEditable WYSIWYG (Parsoid `data-mw` roundtrip) with headings, tables, images, templates, and wikilinks |
| **Source Editor** | CodeMirror 6 with wikitext syntax highlighting, active line highlight, and formatting toolbar |
| **Apple Notes Toolbar** | Borderless, translucent circular action buttons (Save, Cancel, Preview) that expand on hover |
| **Editor Keymaps** | High-priority keyboard shortcuts (`Ctrl+B`, `Ctrl+I`, `Ctrl+K`) that override browser defaults |
| **Distraction-Free Canvas** | Full-width, left-aligned editing canvas layout parity in visual and source modes |
| **Magnetic Repulsion & Overlays** | Collision-avoidance scroll transition: editor titlebar expands to 82px and switcher pill shifts down/compresses/glows to sit perfectly below the Halo overlay. |
| **Template Inserter** | Searchable template picker with TemplateData parameter forms and live preview |
| **Image Search** | Search IxWiki files and Wikimedia Commons, upload and insert inline |
| **Mode Toggle** | Switch between Visual and Source editing with detailed Apple-styled tooltip status |
| **Edit Summary** | Summary input + minor edit flag before saving |
| **Parsoid Roundtrip** | Visual editor saves via HTML → Parsoid → wikitext → MediaWiki API |
| **Revert & Rollback** | Revert to any previous revision or quick-rollback last editor |


### Talk Pages

| Feature | Description |
|---------|-------------|
| **Discussion View** | Rendered talk page with section formatting |
| **Post Section** | Add new discussion sections with titles |
| **Per-Article** | Talk page accessible from any article via sidebar |

### Lore Stash (Save-for-Later)

| Feature | Description |
|---------|-------------|
| **Collections** | Up to 25 color-coded, named collections with custom icons |
| **One-Click Stash** | Toggle button on every article page |
| **Annotations** | Highlight text selections on stashed articles with color + comments |
| **Notes** | Per-item notes on stashed pages |
| **Move Items** | Reorganize items between stashes |
| **Default Stash** | Auto-created on first use |
| **Activity Tracking** | See recent changes to stashed pages |

### Lorewards (Contribution Awards)

| Feature | Description |
|---------|-------------|
| **Daily Awards** | Auto-scored daily winner + runner-up based on edit quality |
| **Weekly/Monthly Awards** | Aggregated period awards |
| **Leaderboard** | Filterable by period (daily, weekly, monthly, all-time) |
| **Streak Calendar** | Heatmap showing consecutive win/runner-up days |
| **User Stats** | Total wins, runner-ups, bytes contributed, current/longest streak |
| **Award History** | Paginated timeline of a user's awards |
| **Article Badges** | Award-winning articles show badges in reader mode |
| **Award Frequency** | Monthly sparkline charts per user |
| **WikiOS Scoring Engine** | Independent scoring: bytes added, prose ratio, collaborative edits, edit depth, novelty, article importance |
| **Cross-Validation** | Compares WikiOS engine picks vs Discord bot picks for audit |

### Blurbs (Topic Tuesday)

| Feature | Description |
|---------|-------------|
| **Admin Prompts** | Create, publish, close, archive prompts with scheduling support |
| **User Responses** | Up to 1000 characters per response, one per user per prompt |
| **Wiki Article Links** | Link up to 5 relevant wiki articles per response |
| **Featured Responses** | Admin can highlight standout responses |
| **Country Gallery** | Browse all blurbs for any country |
| **24h Edit Window** | Users can update their response within 24 hours |
| **ThinkPages Cross-Post** | Every blurb auto-posts a summary to ThinkPages social feed |
| **WikiOS Homepage Stat** | Live blurb count on the homepage stat bar |
| **Admin Dashboard** | `/admin/blurbs` — stats, prompt CRUD, response moderation, featured toggle |
| **Seeded Content** | 34 prompts sourced from Discord #lore-prompts channel (2022–2025) |

### Search

| Feature | Description |
|---------|-------------|
| **Full-Text Search** | Searches article content, not just titles |
| **Highlighted Snippets** | Results show matching text with highlights |
| **Namespace Filter** | Filter by articles, categories, templates |
| **Sort Options** | Sort by relevance or date |
| **Result Metadata** | Word count, byte size, last modified date |
| **Search Overlay** | Cmd+K command palette for quick search from any page |

### Category Tree

| Feature | Description |
|---------|-------------|
| **Breadcrumbs** | Parent categories shown above each article |
| **Expandable Tree** | Click to expand subcategories, lazy-loaded |
| **Page Counts** | Shows number of pages and subcategories per node |
| **Category Browser** | Full category page with subcategories and member pages |

### User Profiles & Contributions

| Feature | Description |
|---------|-------------|
| **User Profile Page** | Edit count, registration date, user groups, contributions |
| **Contribution History** | Paginated edit history for any user |
| **Backlinks** | "What links here" for any article |

### Special Pages

| Page | Route | Description |
|------|-------|-------------|
| Search | `/wiki-special/search` | Full-text search |
| Lore Stash | `/wiki-special/stashes` | Personal article collections |
| Recent Changes | `/wiki-special/recent-changes` | Global edit feed |
| History | `/wiki-special/history/[slug]` | Article revision history |
| Diff | `/wiki-special/diff` | Visual diff between revisions |
| Random | `/wiki-special/random` | Random article redirect |
| Categories | `/wiki-special/categories/[slug]` | Category browser |
| What Links Here | `/wiki-special/whatlinkshere/[slug]` | Backlinks |
| Contributions | `/wiki-special/contributions/[user]` | User edit history |
| User Profile | `/wiki-special/user/[username]` | User stats + awards |
| Images | `/wiki-special/images` | Image/file gallery |
| Lorewards | `/wiki-special/lorewards` | Leaderboard + awards |

### Template Registry

| Feature | Description |
|---------|-------------|
| **Template Search** | Search by name with local cache + wiki fallback |
| **TemplateData Sync** | Auto-fetches parameter schemas from MediaWiki |
| **Parameter Forms** | Dynamic input forms generated from TemplateData |
| **Live Preview** | Renders template with current parameters via MediaWiki |
| **Categorization** | Auto-categorizes templates (infobox, navigation, citation, etc.) |
| **Bulk Sync** | Admin endpoint to populate the registry |

### Navigation & UX

| Feature | Description |
|---------|-------------|
| **Icon Rail Sidebar** | Desktop: vertical icon rail with tooltips |
| **Mobile Pills** | Mobile: horizontal scrollable pill navigation |
| **Keyboard Shortcuts** | Cmd+K (search), Cmd+E (edit), and more |
| **Footer** | "Powered by WikiOS v{WIKIOS_VERSION}" (defined in [src/lib/buildVersion.ts](file:///ixwiki/public/projects/ixstats/src/lib/buildVersion.ts)) |

## API Endpoints

### WikiOS Router (34 endpoints)

**Reader (Public):**
`getArticleHtml` · `getWikitext` · `getEditorHtml` · `getIntroResolved` · `getSections` · `search` · `getRecentChanges` · `getRandomPage` · `getSiteStats` · `getHistory` · `getDiff` · `getRevisionContent` · `getBacklinks` · `getCategoryMembers` · `getUserContribs` · `getUserInfo`

**Editor (Protected):**
`previewWikitext` · `htmlToWikitext` · `saveArticle` · `saveWikitext` · `revertToRevision` · `rollback`

**Template Registry (Public/Protected):**
`searchTemplates` · `getTemplateData` · `getTemplatePreview` · `syncTemplates`

**Lore Stash (Protected):**
`getStashes` · `createStash` · `updateStash` · `deleteStash` · `reorderStashes` · `stashPage` · `unstashPage` · `isStashed` · `getStashItems` · `moveItem` · `updateItemNote` · `addAnnotation` · `updateAnnotation` · `deleteAnnotation` · `getAnnotations`

**Talk Pages (Public/Protected):**
`getTalkPage` · `addTalkSection`

**Categories (Public):**
`getParentCategories` · `getCategoryMembers`

### Blurbs Router (12 endpoints)

**Public:** `getActivePrompts` · `getAllPrompts` · `getPrompt` · `getResponsesForPrompt` · `getResponsesForCountry` · `getBlurbCount`

**Protected:** `getMyResponse` · `submitResponse` · `updateResponse`

**Admin:** `createPrompt` · `updatePrompt` · `featureResponse`

### Lorewards Router (11 endpoints)

**Public:** `getLeaderboard` · `getRecentWinners` · `getUserStats` · `getUserAwardHistory` · `getStreakCalendar` · `isAwardWinningArticle` · `getAwardWinningArticles` · `getAwardFrequency`

**Admin:** `triggerSync` · `scoreDay` · `crossValidate`

## Database Models

```prisma
// Template registry cache
model WikiTemplate {
  id, name, description, category, templateData (Json),
  paramCount, usageCount, lastSynced
}

// Lore Stash — color-coded article collections
model LoreStash {
  id, userId, name, color, icon, order, isDefault
}
model LoreStashItem {
  id, stashId, pageTitle, note, lastRevSeen
}
model LoreStashAnnotation {
  id, itemId, selectedText, comment, color, startOffset, endOffset
}

// Lorewards — contribution awards
model LorewardEntry {
  id, date, type (daily/weekly/monthly), status,
  winnerUser, winnerScore, winnerBytes, winnerEdits, winnerArticle,
  runnerUpUser, runnerUpScore, runnerUpBytes
}
model LorewardUserStats {
  id, username, dailyWins, dailyRunnerUps, weeklyWins, monthlyWins,
  totalScore, totalBytes, currentStreak, longestStreak
}
model LorewardCrossValidation {
  id, date, botPick, wikiOSPick, agreed, candidateCount
}

// Blurbs — Topic Tuesday prompts & responses
model BlurbPrompt {
  id, title, question, slug, status (DRAFT/ACTIVE/CLOSED/ARCHIVED),
  scheduledFor, publishedAt, closedAt, isRecurring, createdBy
}
model BlurbResponse {
  id, promptId, userId, countryId, content (1000 chars),
  linkedArticles (Json), featured, thinkpagesPostId
  @@unique([promptId, userId])
}
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WIKIOS_MEDIAWIKI_API` | `https://ixwiki.com/api.php` | MediaWiki Action API URL |
| `WIKIOS_PARSOID_URL` | `https://ixwiki.com/rest.php/v1` | Parsoid REST API URL |
| `WIKIOS_MEDIAWIKI_BOT_TOKEN` | — | Bot token for authenticated edits |

## Performance

| Operation | Latency | Method |
|-----------|---------|--------|
| Article load | ~38ms | Direct MySQL (WikiBridge) |
| Article (cached) | ~10-50ms | In-memory LRU |
| Search | ~100-200ms | MediaWiki prefix search |
| Full-text search | ~200-500ms | MediaWiki full-text API |
| Special pages | ~100-300ms | MediaWiki API |
| Editor load | ~1.5-2s | Parsoid HTML + contentEditable mount |
| Template preview | ~500ms-1s | MediaWiki parse API |

## Design System

WikiOS uses a modular design system split from the original `wikios.css` into a dedicated stylesheet folder (`src/styles/wikios/`) containing:

- `variables.css` — Global CSS variables for background/foreground colors, layout sizing, and typography tokens. Supports light mode overrides via `[data-theme="light"]`.
- `layout.css` — Top navigation shell, side rails, responsive mobile drawers, and structural flexboxes/grids.
- `elements.css` — Core typography, links, translucent borders, buttons, segmented selector groups, and hover-triggered micro-animations with spring-based transforms (`scale(1.08)` / `translateY(-1px)`).
- `components.css` — Domain-specific wiki views including table of contents sidebars, infobox structures, recent changes, search overlays, and annotation sheets.
- `integrations.css` — Custom styles for third-party embeds like PlateJS visual blocks, Google fonts, and leaflet interactive maps.
- `lorewards.css` — Visual styling for daily/weekly/monthly badges, streak calendar grid heatmap, and leaderboard cards.
- `editors.css` — High-fidelity layout overrides for editing suites. Features theme-compliant line numbers, custom CodeMirror gutter colors, full-width canvas layouts (`.wikios-ve-editable`), and overlay transitions for the Command Palette and Halo overlay in Writer Mode.
- `animations.css` — Custom keyframe animations, shimmer effects, scale transforms, and backdrop filters for high-end glass physics feedback.

General design system attributes:
- **Dark mode default** with light mode support via `[data-theme="light"]`
- **Facet aesthetic** *(glass/refraction/depth)* matching IxStats
- **Geist Sans** for UI, **JetBrains Mono** for code
- **Responsive** — icon rail on desktop, horizontal pills on mobile
- **Navbox support** — collapsible navigation boxes matching MediaWiki templates


## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open search overlay |
| `Cmd/Ctrl + E` | Edit current article |
| `Cmd/Ctrl + S` | Save (in editor) |

## Roadmap

### Complete
- [x] Article reader with infobox, TOC, categories, link previews, image lightbox
- [x] Dual-mode editor (contentEditable visual + CodeMirror source)
- [x] Template registry with TemplateData sync and live preview
- [x] Lore Stash — color-coded collections with annotations
- [x] Lorewards — daily/weekly/monthly awards with leaderboard and streaks
- [x] Blurbs — Topic Tuesday prompts with country responses and ThinkPages cross-post
- [x] Full-text search with highlighted snippets
- [x] Category tree with breadcrumbs
- [x] Talk pages with section posting
- [x] User profiles with contribution history
- [x] Recent changes, random page, diff viewer
- [x] Backlinks explorer, image gallery
- [x] Revert and rollback support
- [x] Admin dashboard for blurbs management

### Planned
- [ ] Real-time collaboration (OT engine for concurrent editing)
- [ ] Notifications — wiki events in unified IxStats notification center
- [ ] Drafts/Autosave — debounced save-as-you-type with conflict detection
- [ ] Live Recent Changes — WebSocket-powered real-time feed
- [ ] User Preferences — feature toggles, themes, custom CSS
- [ ] Graph visualization of article relationships
- [ ] LoreAssist — AI-powered writing suggestions
- [ ] Credits economy integration (earn IxCredits for Lorewards wins, blurb submissions)

## MediaWiki Independence Path

WikiOS is currently a thick client over MediaWiki: MySQL is the source of truth and the MediaWiki parser does all rendering. Reads are already direct-MySQL (`wiki-bridge.ts`); writes and rendering still go through MediaWiki. See the coupling matrix in the [route-group README](../src/app/(wiki-os)/README.md#mediawiki-coupling--independence-path).

**Guiding stance:** demote MediaWiki to a *headless parse/render engine* (its strongest role) and migrate storage + write paths into WikiOS incrementally. Do **not** attempt to reimplement the wikitext parser or Lua/Scribunto sandbox — that is a multi-year effort and pure scope creep. Each stage below is independently shippable and reversible.

### Stage 0 — Reads (done)
- [x] Direct MySQL for wikitext, history, revisions, redirects, category members (`wiki-bridge.ts`), used by `wiki` and `wikios` routers.

### Stage 1 — Direct write path (the genuinely lazy win)
- [ ] Replace the Action API `edit` in `saveToMediaWiki` with a direct-MySQL revision insert + parser-cache purge. Removes the CSRF token + session-cookie dance (`csrf-cache.ts`).
- [ ] Keep link tables consistent on write: `pagelinks`, `categorylinks`, `templatelinks`, `recentchanges`, and the search index. (This is the real work — it's why the Action API exists.)
- [ ] Fall back to the Action API if any consistency step fails. Ship behind a flag.

### Stage 2 — Local article store (source-of-truth flip)
- [x] Prisma `WikiArticle` shadow model + read-through store (`lib/wiki-os/article-store.ts`). `getWikitext` reads through it, edits invalidate it (`saveToMediaWiki` → `invalidateArticleShadow`), and it serves the last-known copy when MediaWiki is unreachable. Backfill is **organic** (populated on read) — no batch migration. Deploy-safe: degrades to a plain MediaWiki passthrough if `wiki_articles` doesn't exist yet. **Run `bun run db:push:force` to create the table.**
- [x] **Stage 2b** — Per-revision history shadow (`WikiRevision`, `wiki_revisions`) + dual-write. On save, `saveToMediaWiki` writes through to Postgres (`recordArticleRevision`: upsert `WikiArticle` + append a `WikiRevision`) instead of just invalidating the shadow. `getHistory`/`getDiff`/`getRevisionContent` read through Postgres (`getArticleHistoryShadow`/`getRevisionWikitextShadow`) with MySQL fallback, so history/diff survive MediaWiki downtime. A recentchanges sync cron (`src/server/cron/sync-wiki-recentchanges.ts`, every 10 min, key `cronSchedule_wikiRecentChanges`) captures edits made directly on MediaWiki, deduped on `(source, mwRevId)`. All DB ops best-effort; degrades to a passthrough if `wiki_revisions` doesn't exist. **Run `bun run db:push:force` to create the table.**
- [ ] Writes land in Postgres first; MediaWiki becomes a pure `wikitext → HTML` render service called on demand.

### Stage 3 — Render service isolation
- [x] **Planned + signed off (not cut over)** — full config plan in `plans/wikios-stage3-config-plan.md`:
  nginx locks MediaWiki's public UI + `Special:*`, 301-redirects article URLs to WikiOS, and restricts
  `api.php`/`rest.php` to loopback + the app host; `LocalSettings.php` keeps API/Parsoid/Scribunto intact.
- [ ] **Blocked on prerequisite:** repoint WikiOS to an internal MediaWiki endpoint first (loopback 301s
  today), then apply the redirect half, then the API-gating half — each staged, with rollback. The public
  redirect is effectively an alpha launch of WikiOS to all of ixwiki.com, so it waits for a cutover window.
- Critical hazard (verified): served HTML rewrites MediaWiki asset URLs (`load.php`/`images`/`thumb.php`/
  `Special:FilePath`) to absolute `ixwiki.com` — those public-GET paths must stay open or infoboxes/images break.

## Packaging — Workstream C (decouple WikiOS from IxStats)

Goal: package/license WikiOS for other worldbuilding communities, backed by a small headless MediaWiki core.
Platform couplings funnel through **seam files** (swap the deployer-specific behaviour there, not in feature code).
Full plan: `plans/wikios-workstream-c-execution.md`; boundary: `plans/wikios-core-boundary.md`;
evidence-based blockers: `plans/wikios-extraction-blockers.md`.

- [x] **C1** — Core-vs-plugin boundary documented.
- [x] **C2** — Auth seam: `lib/wiki-os/auth.ts` (server) + `lib/wiki-os/use-wiki-auth.ts` (client). Zero `@clerk`
  imports outside the client seam; zero raw `ctx.auth`/`ctx.user` outside `auth.ts`. Admin folded in (`isWikiAdmin`).
- [x] **C3** — Storage/identity seam: `lib/wiki-os/storage.ts` owns the IxStats `User.clerkUserId` + User↔Country lookup.
- [x] **A** — Relocated WikiOS-only utilities into the boundary. (`lib/wiki-bridge.ts` stays shared infra — 23 non-WikiOS importers.)
- [ ] **C5** — Design/Facet decoupling (largest remaining; `--wikios-*` token contract + WikiOS-owned primitives; human visual gate).
- [ ] **C4** — Country/maps/`template-resolver` behind a plugin slot (contained).
- [ ] **C6/C7/C8** — config surface; Lorewards/Blurbs core-vs-plugin (product decision); extract + license (only when a real second deployer exists).
