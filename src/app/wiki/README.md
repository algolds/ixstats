# Wiki Integration Hub

**Last updated:** October 2025

The wiki integration surfaces at `/wiki` and within builder workflows to fetch canonical country data from MediaWiki sources.

## Scope
- Provide quick search against IxWiki/AltHistoryWiki APIs
- Preview and normalise infobox data before persisting to IxStats
- Manage flag/coat-of-arms retrieval with caching and fallbacks

## Key Pieces
| Area | Path | Notes |
| --- | --- | --- |
| Route | `src/app/wiki/page.tsx` | Entry point with search UI, import status, troubleshooting tips |
| Builder Integration | `src/app/builder` | Import step shares logic and components with the wiki route |
| API Routers | `src/server/api/routers/wikiImporter.ts`, `wikiCache.ts` | Search, import, cache, refresh endpoints |
| Proxy Routes | `src/app/api/mediawiki/*` | Server-side fetchers for various wiki domains |
| Utilities | `src/hooks/useUnifiedFlags.ts`, `src/lib/url-utils.ts` | Media handling and safe URL helpers |

## Typical Flow
1. User searches for a country (MediaWiki query via `wikiImporter.previewImport`)
2. Preview shows extracted infobox values + flag imagery (uses `wikiCache.getCountryProfile`)
3. User confirms import → builder mutations persist data into Prisma models
4. Flag/coats cached via `wikiCache` and served to the builder/MyCountry surfaces

## Maintenance Notes
- Ensure new infobox fields are mapped in `wikiImporter.ts` and normalised before persistence
- Update `/docs/systems/builder.md` and `/docs/reference/api.md` when adding importer endpoints
- Use `npm run audit:flags` to verify flag URLs in bulk

Keep this README aligned with the wiki route, importer router, and builder dependencies.
