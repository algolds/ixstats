# In-App Help Center

**Last updated:** September 2026

The help center at `/help` renders Markdown articles from `src/content/help/<category>/<slug>.md` through one shared layout (`src/components/documents/DocumentPage.tsx`), the same one used by `/terms` and `/privacy` (`src/content/legal/*.md`). There is **no tRPC/`api.*` data source and no `help` router**; the only `api.*` occurrences are literal strings inside article copy.

**Coverage (September 2026):** 54 article files; 41 registered in the hub across 10 sections, with 5 filter buttons. The 13 unregistered files (all of `defense/`, `diplomacy/scenarios`, `economy/modeling`, `government/synergy`, and four `intelligence/` pages) are reachable only by direct URL.

## Routes

| Route | Purpose |
|-------|---------|
| `/help` | Hub: search box + category filter + section/article cards + quick-links footer |
| `/help/<category>/<slug>` | Individual article: `[category]/[slug]/page.tsx` renders `src/content/help/<category>/<slug>.md` (404 if missing) |

Article folders (under `src/content/help/`): `getting-started/`, `gameplay/`, `mycountry/`, `economy/`, `government/`, `defense/`, `intelligence/`, `diplomacy/`, `vault/`, `social/`, `admin/`.

## Key Features

- **Article center** — section cards on the hub list every article with title, description, and tag chips, linking to its route.
- **Search** — client-side filter (`useMemo`) over article `title`, `description`, and `tags`; shows an empty-state when nothing matches.
- **Categories** — five filter buttons: All Topics, Start Here (`getting-started`), Living World (`gameplay`), Your Nation (`features`), Admin (`admin`). Sections may also declare `systems` (Economy, Government, Intelligence), which has no button, so those sections only show under All Topics.
- **Quick links footer** — four shortcut cards (New to IxStats?, Build a Nation, How It Works, Cards & Vault).
- **In-article navigation** — the layout renders a "Help Center" breadcrumb, a table of contents built from the `##` headings, and optional prev/next links.

## Architecture

| Piece | Location | Role |
|-------|----------|------|
| Hub | `page.tsx` + `_components/HelpExplorer.tsx` | `page.tsx` is the server page (header, quick links); `HelpExplorer` is the client component holding the `helpSections` array (sections → articles), search + category state |
| Layout | `src/components/documents/DocumentPage.tsx` + `DocumentLayout.tsx` | Loads a `.md` file, renders it with `react-markdown` + `remark-gfm`, wraps it in the page chrome |
| Conventions | `src/lib/markdown-document.ts` | Frontmatter parsing, heading ids, callouts |
| Articles | `src/content/help/<category>/<slug>.md` | Article content |

The hub is the single source of truth for which articles are discoverable: an article folder only appears in search/navigation if it has a matching entry in `helpSections`.

## Content Authoring & Sync

1. Update the corresponding Markdown guide under `docs/` (system reference: `docs/systems/help.md`).
2. Create or edit `src/content/help/<category>/<slug>.md`:
   - Frontmatter (`---` block of `key: value` lines): `title`, `description`, `badge` (hub section name), optional `prevHref`/`prevLabel`/`nextHref`/`nextLabel`.
   - `##` headings become table-of-contents entries; ids are slugs of the heading text, or pinned with a trailing `{#id}`.
   - A blockquote is a callout (`> **Title**` then the body); start it with a `> [!WARNING]` line for a warning callout.
3. Register/adjust the article in the `helpSections` array in `_components/HelpExplorer.tsx` (id, title, description, `path`, tags) so it surfaces in search and filters. Keep `path` aligned with the file (`/help/economy/tiers` → `src/content/help/economy/tiers.md`).
4. Keep metadata (title, description, tags) consistent between the hub entry and the article.

## Maintenance

- After each deploy, walk `/help` to confirm search, filters, and article rendering.
- To retire an article, remove its `helpSections` entry (delisting it from the hub) and delete its `.md` file.
- Stats inside articles (router/endpoint/model counts, tier names, catalog sizes) are hand-maintained copy — refresh them when the underlying systems change.

Align this README with `docs/systems/help.md` whenever the help center structure changes.
