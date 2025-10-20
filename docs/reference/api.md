# API Reference Snapshot

**Last updated:** October 2025

The tRPC layer exposes 35 routers with a combined 546 procedures (274 queries / 272 mutations). This snapshot lists each router with counts for quick auditing. For detailed schemas, inspect the router files under `src/server/api/routers`.

## Router Index
| Router | Procedures | Queries | Mutations |
| --- | ---: | ---: | ---: |
| achievements | 4 | 3 | 1 |
| activities | 10 | 6 | 4 |
| admin | 33 | 12 | 21 |
| archetypes | 10 | 5 | 5 |
| atomicEconomic | 6 | 2 | 4 |
| atomicGovernment | 12 | 5 | 7 |
| atomicTax | 6 | 2 | 4 |
| countries | 40 | 28 | 12 |
| customTypes | 5 | 3 | 2 |
| diplomatic | 26 | 13 | 13 |
| diplomatic-intelligence | 5 | 4 | 1 |
| eci | 13 | 12 | 1 |
| economics | 19 | 8 | 11 |
| enhanced-economics | 6 | 6 | 0 |
| formulas | 6 | 4 | 2 |
| government | 14 | 6 | 8 |
| intelligence | 11 | 6 | 5 |
| meetings | 27 | 9 | 18 |
| mycountry | 6 | 5 | 1 |
| notifications | 6 | 4 | 2 |
| optimized-countries | 6 | 6 | 0 |
| policies | 23 | 8 | 15 |
| quickactions | 21 | 8 | 13 |
| roles | 10 | 4 | 6 |
| scheduledChanges | 7 | 3 | 4 |
| sdi | 33 | 17 | 16 |
| security | 34 | 9 | 25 |
| taxSystem | 11 | 3 | 8 |
| thinkpages | 56 | 21 | 35 |
| unified-intelligence | 29 | 21 | 8 |
| unifiedAtomic | 6 | 5 | 1 |
| user-logging | 10 | 8 | 2 |
| users | 19 | 9 | 10 |
| wikiCache | 11 | 5 | 6 |
| wikiImporter | 5 | 4 | 1 |

## Usage Notes
- Procedures are generated with strongly typed inputs/outputs via Zod schemas defined in each router
- All routers share the same context (`src/server/api/trpc.ts`), enforcing Clerk auth and rate limits
- Use `api.<router>.<procedure>.useQuery` / `.useMutation` in React components via the auto-generated client (`src/trpc/react.tsx`)
- When adding new procedures, update corresponding help articles and system guides, and re-run `npm run audit:wiring`

For detailed payloads and examples, open the router file and the matching help or system guide.
