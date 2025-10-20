# Help System

**Last updated:** October 2025

The help system delivers contextual documentation directly inside the app at `/help`. It mirrors the Markdown guides in this repository so in-app content stays consistent with developer references.

## Architecture
- `src/app/help/page.tsx` – Main help center hub with search, filters, and links to individual articles
- `src/app/help/_components/ArticleLayout.tsx` – Shared layout for article pages (title, metadata, navigation)
- Article routes live under `src/app/help/<category>/<slug>/page.tsx`

## Content Authoring
1. Draft or update the relevant Markdown guide under `docs/`
2. Create or update the matching help article page using `ArticleLayout`
3. Keep metadata (title, description, tags) aligned between the hub configuration (`helpSections` array) and the article page
4. When archiving content, move Markdown to `docs/archive/...` and remove the matching help route

## Categories
- Getting Started, Economy, Government, Defense, Intelligence, Diplomacy, Social, Unified Intelligence, Technical
- Each category maps to a folder under `src/app/help/` and a section in the hub configuration

## Tooling & Localization
- Articles are implemented as React components to allow rich content, callouts, and component reuse
- For purely textual content, wrap Markdown-style text in `<ArticleLayout>` (see new articles created in this refresh)
- Localization is not yet implemented; plan for translation by avoiding hard-coded copy duplication across docs

## Testing
- Smoke test navigation by visiting `/help`
- Add unit tests or Playwright specs when introducing critical interactive help flows

Ensure every major feature ships with an accompanying help article and that both the repo and in-app versions stay synchronised.
