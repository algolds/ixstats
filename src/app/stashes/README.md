# Stash

**Last updated:** June 2026

The Stash (internally "Lore Stash") is the platform's save-for-later system. Signed-in users bookmark wiki pages, media-repository images, and forum threads into named, color-coded collections, then add notes and inline text highlights for worldbuilding research. It is part of the WikiOS surface and renders inside `WikiOSLayout`.

## Routes

| Route | File | Description |
|-------|------|-------------|
| `/stashes` | `src/app/stashes/page.tsx` | Stash manager — sidebar of collections, item grid with Pages / Images / Threads tabs |

Signed-out visitors see a sign-in prompt instead of the manager.

## Key Features

| Feature | Detail (per code) |
|---------|-------------------|
| Color-coded stashes | Named collections with a preset color and optional icon; max **25** per user (`createStash`) |
| Default stash | Auto-created "My Stash" when a user first stashes anything (`getDefaultStash` / `stashPage`) |
| One-click save | `StashButton` saves the current page to the default stash, or to specific stashes via a popover / manager modal |
| Item notes | Per-item rich-text note, sanitized on render, up to 50,000 chars (`updateItemNote`) |
| Text annotations | Selection-based highlights with anchor/focus selectors, selected text, optional comment, and color (`addAnnotation`) |
| Organization | Reorder stashes (`reorderStashes`), move an item between stashes (`moveItem`), rename/recolor (`updateStash`) |
| Stash-edit notifications | When a stashed wiki page is edited via WikiOS, owners get a `wiki_edit` notification (`notifyStashOwners`) |
| Help guide | `StashWelcomeModal` onboarding (Getting Started, Page Markups, Image Repository, Forum Threads) |

## Architecture

| Piece | Location | Role |
|-------|----------|------|
| Page | `src/app/stashes/page.tsx` | Manager UI; tabs filter items by `pageTitle` prefix (`commons:` = image, `forum:thread:` = thread, else wiki page). Includes `StashedImageModal` (lightbox + wikitext copy formats) |
| Stash button | `src/components/wiki-os/reader/StashButton.tsx` | Save toggle + popover + `StashManagerModal` |
| Welcome modal | `src/components/wiki-os/shared/StashWelcomeModal.tsx` | First-run help (localStorage `wikios-stashes-welcome-seen`) |
| Other entry points | `src/components/wiki-os/media-search/MyStashTab.tsx`, `src/components/messages/MessagesStashAttachmentModal.tsx` | Stash access from media search and messaging |
| Styles | `src/styles/wiki-os.css` | `wikios-stash-*` classes |

Models live in `prisma/schema/wiki.prisma`: `LoreStash`, `LoreStashItem` (`contentType` = `wiki` | `forum_thread` | `forum_post`, optional `contentId`), `LoreStashAnnotation`.

## Data Sources

Stash CRUD lives in the **`wikios`** tRPC router (`src/server/api/routers/wikios/`), merged from `stash.ts` and `watchlist-annotations.ts`. All procedures are `protectedProcedure`.

| Procedure | Type | Purpose |
|-----------|------|---------|
| `api.wikios.getStashes` | query | List user's stashes with item counts |
| `api.wikios.getDefaultStash` | query | Get or auto-create the default stash |
| `api.wikios.createStash` | mutation | Create a stash (max 25) |
| `api.wikios.updateStash` | mutation | Rename / recolor / set icon |
| `api.wikios.deleteStash` | mutation | Delete (cannot delete default) |
| `api.wikios.reorderStashes` | mutation | Reorder collections |
| `api.wikios.stashPage` | mutation | Save a page (default stash if none given) |
| `api.wikios.unstashPage` | mutation | Remove from one or all stashes |
| `api.wikios.isStashed` | query | Whether/where a page is stashed (powers button color) |
| `api.wikios.getStashItems` | query | Paginated items in a stash (with annotation counts) |
| `api.wikios.getStashItem` | query | Single item |
| `api.wikios.moveItem` | mutation | Move item to another stash |
| `api.wikios.updateItemNote` | mutation | Set item note |
| `api.wikios.addAnnotation` / `updateAnnotation` / `deleteAnnotation` / `getAnnotations` | mutation/query | Text-selection highlights on a stashed page |

The image tab resolves Commons thumbnails via `api.commons.getImageInfoByTitles`; the modal can download files via `api.wiki.downloadFile`.

## Connections — what can be stashed

| Content | How it's stored | Stash API |
|---------|-----------------|-----------|
| Wiki pages | `pageTitle` as-is, slug `/wiki/<slug>` | `wikios.stashPage` / `unstashPage` |
| Media-repository images | `pageTitle` prefixed `commons:` | `wikios.stashPage` (re-resolved via `commons.getImageInfoByTitles`) |
| Forum threads | `pageTitle` prefixed `forum:thread:`, `contentType` = `forum_thread` | `forum.stashThread` / `unstashThread` / `isThreadStashed` / `getStashedThreads` (`src/server/api/routers/forum/stash.ts`) |

All three content types share the same underlying `LoreStash` / `LoreStashItem` tables; the `/stashes` page disambiguates them by `pageTitle` prefix at render time.
