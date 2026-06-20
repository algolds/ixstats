# In-App Help Center

**Last updated:** June 2026

The help center at `/help` delivers React-rendered articles that mirror the Markdown guides under `docs/`. Each article uses shared layout primitives (`ArticleLayout` and friends) for consistent typography, navigation, and metadata. All content is static React — there is **no tRPC/`api.*` data source and no `help` router**; the only `api.*` occurrences are literal strings inside article copy.

**Coverage (June 2026):** 58 articles registered in the hub across 13 sections, grouped into 6 filter categories.

## Routes

| Route | Purpose |
|-------|---------|
| `/help` | Hub: search box + category filter + section/article cards + quick-links footer |
| `/help/<category>/<slug>` | Individual article (each is a `page.tsx` wrapping `ArticleLayout`) |

Article folders: `getting-started/`, `gameplay/`, `mycountry/`, `economy/`, `government/`, `defense/`, `intelligence/`, `diplomacy/`, `vault/`, `social/`, `technical/`, `admin/`.

## Key Features

- **Article center** — section cards on the hub list every article with title, description, and tag chips, linking to its route.
- **Search** — client-side filter (`useMemo`) over article `title`, `description`, and `tags`; shows an empty-state when nothing matches.
- **Categories** — six filter buttons: All Topics, Getting Started, Gameplay, Features, Technical, Admin. Each hub section declares a `category` of `getting-started` | `gameplay` | `features` | `technical` | `admin`.
- **Quick links footer** — four shortcut cards (New to IxStats, Gameplay, Cards & Vault, API Docs).
- **In-article navigation** — `ArticleLayout` renders a "Back to Help Center" link plus optional prev/next links.

## Architecture

| Piece | Location | Role |
|-------|----------|------|
| Hub | `page.tsx` | Client component; holds the `helpSections` array (sections → articles), search + category state |
| Layout | `_components/ArticleLayout.tsx` | Exports `ArticleLayout`, `InfoBox`, `WarningBox`, `Section`, `ContentCard` |
| Articles | `<category>/<slug>/page.tsx` | Static content composed from the layout primitives |

The hub is the single source of truth for which articles are discoverable: an article folder only appears in search/navigation if it has a matching entry in `helpSections`.

## Content Authoring & Sync

1. Update the corresponding Markdown guide under `docs/` (system reference: `docs/systems/help.md`).
2. Create or edit the matching article `page.tsx`, composing content with the `ArticleLayout` primitives.
3. Register/adjust the article in the `helpSections` array in `page.tsx` (id, title, description, `path`, tags) so it surfaces in search and filters. Keep `path` aligned with the folder (`/help/economy/tiers` → `economy/tiers/page.tsx`).
4. Keep metadata (title, description, tags) consistent between the hub entry and the article.

## Maintenance

- After each deploy, walk `/help` to confirm search, filters, and article rendering.
- To retire an article, remove its `helpSections` entry (delisting it from the hub) and delete or archive the route.
- Stats inside articles (router/endpoint/model counts, tier names, catalog sizes) are hand-maintained copy — refresh them when the underlying systems change.

Align this README with `docs/systems/help.md` whenever the help center structure changes.
