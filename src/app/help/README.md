# In-App Help Center

**Last updated:** 30 September 2026

The help center at `/help` renders Markdown articles from `src/content/help/<folder>/<slug>.md` through one shared layout (`src/components/documents/DocumentPage.tsx`), the same one used by `/terms` and `/privacy` (`src/content/legal/*.md`). There is no tRPC data source and no `help` router.

**Coverage:** 63 articles, all registered in the hub across 11 sections. See [docs/systems/help.md](../../../docs/systems/help.md) for the section list, retired articles and authoring rules.

## Routes

| Route                   | Purpose                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `/help`                 | Hub: search box, one filter chip per section, section cards, quick-links footer                             |
| `/help/<folder>/<slug>` | Article: renders `src/content/help/<folder>/<slug>.md` (404 if missing); retired paths redirect permanently |

## Files

| Piece         | Location                                                              | Role                                                                                |
| ------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Registry      | `_lib/help-sections.ts`                                               | `helpSections` (sections → articles), `retiredHelpArticles`, `filterHelpSections`   |
| Hub           | `page.tsx` + `_components/HelpExplorer.tsx`                           | Server page (header, quick links) and the client explorer (search + section filter) |
| Article route | `[category]/[slug]/page.tsx`                                          | Title metadata from frontmatter, retired-path redirects, `DocumentPage`             |
| Layout        | `src/components/documents/DocumentPage.tsx` + `DocumentLayout.tsx`    | Markdown rendering and page chrome                                                  |
| Conventions   | `src/lib/markdown-document.ts`                                        | Frontmatter, heading ids, callouts                                                  |
| Tests         | `src/tests/content/help-center.test.ts`, `markdown-documents.test.ts` | Registry, links, anchors, rendering                                                 |

## Adding or changing an article

1. Write `src/content/help/<folder>/<slug>.md` with frontmatter `title`, `description`, `badge` (the section title) and optional `prevHref`/`prevLabel`/`nextHref`/`nextLabel`. Don't quote frontmatter values.
2. Add it to `helpSections` in `_lib/help-sections.ts` with the same title.
3. Link only to real routes and articles; the tests check every link.
4. Run `bunx jest src/tests/content`.

To retire an article: delete it, remove its registry entry, add the old path to `retiredHelpArticles` with its replacement, and fix links.
