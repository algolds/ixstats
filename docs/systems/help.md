# In-App Help System

**Last updated:** September 2026  
**Status:** Production (content partially registered, see Known gaps)  
**Hierarchy:** Platform Support & Documentation Suite.

The in-app help system delivers rich, interactive, and contextual documentation directly inside the application at `/help`. It mirrors the technical and gameplay specifications in this repository; article stats are hand-maintained and must be refreshed when systems change.

---

## Architecture & Routing

- `src/app/help/page.tsx` – Help center page (header + quick-links footer); renders the client `HelpExplorer`
- `src/app/help/_components/HelpExplorer.tsx` – Hub: holds the `helpSections` array (the registry of discoverable articles), client-side search over title/description/tags, and category filter buttons
- `src/components/documents/DocumentPage.tsx` / `DocumentLayout.tsx` – one markdown layout (breadcrumb, table of contents, prev/next links) shared with `/terms` and `/privacy`
- Articles are markdown files at `src/content/help/<category>/<slug>.md`, served by the single dynamic route `src/app/help/[category]/[slug]/page.tsx` (404 when the file is missing)
- Headings take an id from a trailing `{#id}` or a slug of their text; `> [!WARNING]` blockquotes render as warning callouts, other blockquotes as info callouts (`src/lib/markdown-document.ts`)
- There is no `help` tRPC router; content is static markdown.

---

## Category Taxonomy

**Coverage (September 2026):** 54 markdown articles in 11 folders under `src/content/help/`; **41** are registered in `helpSections` across 10 hub sections. Filter buttons: All Topics, Start Here, Living World, Your Nation, Admin.

| Hub section | Filter category | Articles | Key System Guide |
| :--- | :--- | :--- | :--- |
| **Start Here** | `getting-started` | 6 (welcome, first country, gameplay overview, IxTime, IxnayID, navigation) | [`systems/builder.md`](./builder.md) |
| **Living World** | `gameplay` | 5 (simulation, country building, national issues, achievements, leaderboards) | [`systems/mycountry.md`](./mycountry.md) |
| **MyCountry — Your Nation's Home** | `features` | 6 (overview, executive, diplomacy, intelligence, defense, politics) | [`systems/mycountry.md`](./mycountry.md) |
| **Economy & Finances** | `systems` | 4 (tiers, tax system, trade, calculations) | [`systems/economy.md`](./economy.md) |
| **Government & Structure** | `systems` | 3 (components, atomic, traditional) | [`systems/elections.md`](./elections.md) |
| **Intelligence & Strategy** | `systems` | 3 (dashboard, alerts, metrics) | [`systems/intelligence.md`](./intelligence.md) |
| **Diplomacy & Alliances** | `features` | 4 (embassies, missions, cultural, NPC personalities) | [`systems/diplomacy.md`](./diplomacy.md) |
| **IxVault & Cards** | `features` | 5 (overview, card packs, trading, lore cards, IxCredits) | [`systems/cards.md`](./cards.md) |
| **Community** | `features` | 3 (ThinkPages, ThinkShare, ThinkTanks) | [`systems/social.md`](./social.md) |
| **For Admins** | `admin` | 2 (CMS overview, reference data) | [`systems/admin-cms.md`](./admin-cms.md) |

Known gaps:
- The three `systems` sections have no filter button, so they only appear under **All Topics**.
- 13 article files are not registered in the hub and can only be reached by direct URL: all of `defense/` (overview, units, equipment, customization, stability, crisis-events), `diplomacy/scenarios`, `economy/modeling`, `government/synergy`, and `intelligence/{executive-operations,forecasting,strategic-intelligence,unified-overview}`.
- There are no help sections for IxWorld Maps, Onoma, WikiOS, Stash, or the Forum.

---

## Authoring Workflow

1. **Update System Guide**: Maintain or update the primary Markdown specification under `docs/systems/`.
2. **Author In-App Article**: Create or update `src/content/help/<category>/<slug>.md` (no React code needed).
3. **Register in the Hub**: Add the article to the `helpSections` array in `src/app/help/_components/HelpExplorer.tsx` (id, title, description, `path`, tags) so it appears in search and filters.

---

## Related Documentation

- [Documentation Hub](../README.md)
- [Platform Overview](../overview/platform.md)
- [API Reference](../reference/api-complete.md)
