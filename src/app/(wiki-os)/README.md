# WikiOS

**Last updated:** June 21, 2026

WikiOS is a modern, React-based wiki frontend that replaces the MediaWiki UI for IxWiki. MediaWiki continues to run headlessly as the backend — it stores content, processes Lua/Scribunto templates, and exposes the Action API and Parsoid REST API. WikiOS replaces everything the reader and editor see and touch, served from the `(wiki-os)` Next.js route group at `/wiki/*`.

The editor stack is a custom contentEditable visual editor (HTML ↔ Parsoid ↔ wikitext roundtrip) plus a **CodeMirror 6** source editor. Article HTML is fetched via Parsoid and transformed server-side.

> Status: **alpha / in active development.** Reader, dual-mode editor, stash, lorewards, blurbs, and most special pages are built and wired to live tRPC. Real-time collaboration, autosave, and notifications remain on the roadmap (see [`plans/WIKIOS.md`](../../../plans/WIKIOS.md)).

## Routes (`(wiki-os)` group → `/wiki/*`)

| Route | File | Purpose |
|-------|------|---------|
| `/wiki` | `wiki/page.tsx` | Redirects to `Main_Page` |
| `/wiki/[slug]` | `wiki/[slug]/page.tsx` | Article reader |
| `/wiki/[slug]/edit` | `wiki/[slug]/edit/page.tsx` | Article editor (visual + source) |
| `/wiki/[slug]/talk` | `wiki/[slug]/talk/page.tsx` | Talk / discussion page |
| `/wiki/search` | `wiki/search/page.tsx` | Full-text search |
| `/wiki/recent-changes` | `wiki/recent-changes/page.tsx` | Global edit feed |
| `/wiki/history/[slug]` | `wiki/history/[slug]/page.tsx` | Revision history |
| `/wiki/diff` | `wiki/diff/page.tsx` | Revision diff viewer |
| `/wiki/random` | `wiki/random/page.tsx` | Random article redirect |
| `/wiki/categories/[...slug]` | `wiki/categories/[...slug]/page.tsx` | Category browser |
| `/wiki/whatlinkshere/[slug]` | `wiki/whatlinkshere/[slug]/page.tsx` | Backlinks |
| `/wiki/contributions/[user]` | `wiki/contributions/[user]/page.tsx` | User edit history |
| `/wiki/user/[username]` | `wiki/user/[username]/page.tsx` | User profile |
| `/wiki/lorewards` | `wiki/lorewards/page.tsx` | Lorewards leaderboard |
| `/wiki/repository` | `wiki/repository/page.tsx` | Commons image explorer |
| `/wiki/watchlist` | `wiki/watchlist/page.tsx` | Redirects to `/stashes` |

Related routes live **outside** this group: `/stashes` (Lore Stash browser), `/blurbs` + `/blurbs/[slug]`, `/admin/blurbs`, `/admin/lorewards`, `/admin/stash`, `/admin/wikios-settings`.

## Key features (implemented)

| Area | Feature |
|------|---------|
| Reader | Server-side HTML transform (infobox extraction, TOC, notices), sticky TOC, link previews, image lightbox, category breadcrumbs, infobox-with-map, custom Main Page |
| Editor | Visual editor (contentEditable, data-mw roundtrip), CodeMirror 6 source editor with wikitext toolbar, template inserter, image search/upload modal, edit summary, revert & rollback |
| Stash | Color-coded collections, one-click stash toggle, text-selection annotations, per-item notes |
| Lorewards | Daily/weekly/monthly awards, leaderboard, streak calendar, user stats, award-winning-article badges, cross-validation vs Discord bot |
| Blurbs | Topic-Tuesday prompts, user responses with linked articles, featured responses, country gallery, admin dashboard |
| Search | Full-text search, command-palette search modal, category tree |
| Templates | Template search, TemplateData sync, live preview |

Roadmap items (not built): real-time collaboration, autosave/drafts, live WebSocket recent-changes, user preferences, AI writing assistance, credits integration.

## Architecture

| Layer | Location |
|-------|----------|
| Route group | `src/app/(wiki-os)/` — layout mounts `WikiDIPlugin` (Halo/Dynamic Island) |
| Components | `src/components/wiki-os/` — `reader/`, `editor/`, `shared/`, `categories/`, `profile/` (~32 files) |
| Reader core | `reader/ArticleRenderer.tsx`, `WikiOSMainPage.tsx`, `StickyToc.tsx`, `InfoboxWithMap.tsx`, `LinkPreview.tsx` |
| Editor core | `editor/WikiVisualEditor.tsx` (contentEditable), `editor/WikiSourceEditor.tsx` (CodeMirror 6), `editor/TemplateInserter.tsx`, `editor/ImageSearchModal.tsx` |
| Shell | `shared/WikiOSLayout.tsx`, `WikiOSUnifiedSidebar.tsx`, `WikiContext.tsx`, `useWikiOSShortcuts.ts` |
| Blurbs UI | `src/components/blurbs/` |
| Lib | `src/lib/wiki-os/` — `parsoid-client.ts`, `html-transformer.ts`, `template-registry.ts`, `template-resolver.ts`, `url-compat.ts`, `wikitext-diff.ts`, `csrf-cache.ts`, `mediawiki-timestamp.ts`, `safe-decode.ts`, `fix-editor-images.ts` |
| Styles | `src/styles/wiki-os.css` (entry) + `src/styles/wiki-os/` (variables, layout, elements, components, integrations, lorewards, editors, animations) |

**Parsoid bridge:** `lib/wiki-os/parsoid-client.ts` fetches rendered HTML from the MediaWiki Parsoid REST API (localhost loopback, cached). `html-transformer.ts` post-processes it (infobox/TOC/notice extraction). The visual editor saves by sending edited HTML back through Parsoid to wikitext, then to the MediaWiki API. `lib/wiki-bridge.ts` provides direct DB-backed reads (wikitext, history, revisions, redirects, category members) used by **both** the `wiki` router and the `wikios` router (`page-content.ts`, `editing.ts` rollback/revert).

## MediaWiki coupling & independence path

WikiOS does **not** own its content — MediaWiki's MySQL/MariaDB is the source of truth and its parser does all rendering. WikiOS is a thick client. Where it touches MediaWiki, and how hard each tie is to cut:

| Concern | Today | Independence cost |
|---------|-------|-------------------|
| **Reads** — wikitext, history, revisions, redirects, categories | Direct MySQL via `wiki-bridge.ts` | **Already done** (no API hop) |
| **Writes** — article saves, uploads, template sync | MediaWiki Action API (`api.php`, CSRF + session via `csrf-cache.ts`) | Low–medium: a direct-MySQL write + parser-cache purge removes the CSRF/session dance, but must keep `pagelinks`/`categorylinks`/search index/recentchanges consistent |
| **Rendering** — templates, Lua/Scribunto, `<ref>`, infoboxes, transclusion | MediaWiki parser + Parsoid REST | **Very high.** This is what makes it a wiki. Parsoid exists precisely because reimplementing the wikitext+Lua parser is a multi-year effort |

**Stance:** keep MediaWiki as a *headless parse/render engine* (its strongest role) and move storage + UX into WikiOS incrementally. "Full independence" = reimplementing the parser and Lua sandbox, which is out of scope for the foreseeable future. The staged migration path lives in [`plans/WIKIOS.md`](../../../plans/WIKIOS.md#mediawiki-independence-path).

Local Postgres state (`prisma/schema/wiki.prisma`) holds only WikiOS-native data: `WikiCache`, `WikiTemplate` (TemplateData), Lore Stash, Lorewards, Blurbs, `WikiArticleAward` — **no article content**.

## Data sources (tRPC)

| Router | Registered in `root.ts` | Scope |
|--------|------------------------|-------|
| `api.wikios.*` | `routers/wikios/` (split: editing, page-content, search-categories, stash, templates, user-talk, watchlist-annotations) | Reader, editor, stash, talk, templates, categories, annotations, watchlist (~59 procedures) |
| `api.lorewards.*` | `routers/lorewards/` | Awards, leaderboard, streaks, user stats, cross-validation |
| `api.blurbs.*` | `routers/blurbs/` | Topic-Tuesday prompts & responses |
| `api.wiki.*` | `routers/wiki/` | Direct wiki-bridge reads (articles, media, discovery) |
| `api.wikiCache.*`, `api.wikiImporter.*` | `routers/wikiCache`, `routers/wikiImporter` | Cache + import support |

Version: `WIKIOS_VERSION` in `src/lib/buildVersion.ts` (Canvas nests under WikiOS as a sub-system).

---

For the full design spec, intended-state details, DB models, and roadmap, see [`plans/WIKIOS.md`](../../../plans/WIKIOS.md). Where this README and the spec disagree, **this README reflects the code as built**; the spec describes intended state (e.g. it references PlateJS and `/w/` + `/wiki-special/` routes that the code does not use).
