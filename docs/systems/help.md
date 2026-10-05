# In-App Help System

**Last updated:** 2026-10-05  
**Status:** Production. Every article is registered in the hub and link-checked by tests.  
**Hierarchy:** Platform Support & Documentation Suite.

The in-app help center at `/help` holds plain, task-oriented player guides. Articles describe what the code does today (checked against the routers, `src/lib/**`, the Prisma schema and [SYSTEM_STATUS.md](SYSTEM_STATUS.md)); planned features are only mentioned to say they aren't built yet. Figures quoted in articles (caps, costs, rates) are hand-maintained copy: update the article when the constant changes.

---

## Architecture & Routing

- `src/app/help/page.tsx` – Help center page (header + quick-links footer); renders the client `HelpExplorer`
- `src/app/help/_lib/help-sections.ts` – The registry: `helpSections` (sections → articles: id, title, description, `path`, tags), `retiredHelpArticles` (old paths → replacement), and `filterHelpSections` (search + section filter)
- `src/app/help/_components/HelpExplorer.tsx` – Client hub: search box (title, description, tags, section title), one filter chip per section, result count, section cards
- `src/app/help/[category]/[slug]/page.tsx` – Serves `src/content/help/<category>/<slug>.md` through `DocumentPage` (404 when missing), sets the page title from the frontmatter, and permanently redirects retired paths
- `src/components/documents/DocumentPage.tsx` / `DocumentLayout.tsx` – Shared markdown layout (breadcrumb, table of contents, prev/next) also used by `/terms` and `/privacy`
- `src/lib/markdown-document.ts` – Frontmatter, heading ids (`{#id}` or a slug of the text), callouts (`> [!WARNING]` → warning, other blockquotes → note)
- There is no `help` tRPC router; content is static markdown.

---

## Sections

**Coverage (5 October 2026):** 68 articles in 13 folders, all registered, in 11 hub sections. An article's folder does not have to match its section (for example `gameplay/national-issues` is listed under MyCountry).

| Hub section | Articles | Key system guide |
| :--- | :--- | :--- |
| **Start Here** | welcome, first-country, gameplay/country-building, gameplay-overview, navigation, halo, settings, ixtime, ixnayid, premium | [builder.md](./builder.md), [halo.md](./halo.md), [settings.md](./settings.md), [ixnayid-passport.md](./ixnayid-passport.md) |
| **MyCountry** | mycountry/overview, mycountry/executive, gameplay/national-issues, mycountry/economy, mycountry/politics, mycountry/intelligence, mycountry/editor, mycountry/map-editor, mycountry/canvas-editor | [mycountry.md](./mycountry.md), [elections.md](./elections.md), [WIKIOS.md](./wikios/WIKIOS.md) (Canvas editor) |
| **Economy & Government** | economy/{tiers, calculations, tax-system, trade, modeling}, government/{atomic, components, synergy, traditional} | [economy.md](./economy.md), [calculations.md](./calculations.md) |
| **Diplomacy** | mycountry/diplomacy, diplomacy/{embassies, cultural, scenarios, npc-personalities} | [diplomacy.md](./diplomacy.md), [npc-ai.md](./npc-ai.md) |
| **Defense** | mycountry/defense, defense/{equipment, stability} | [defense.md](./defense.md) |
| **The World** | world/{maps, realms, countries, explore}, gameplay/{simulation, world-events} | [maps.md](./maps.md), [realms.md](./realms.md), [explore-and-country-profiles.md](./explore-and-country-profiles.md), [crisis-events.md](./crisis-events.md) |
| **Wiki & Lore** | wiki/{wikios, lorewards, stash} | [WIKIOS.md](./wikios/WIKIOS.md), [stash.md](./stash.md), [ixnayid-passport.md](./ixnayid-passport.md) (Lorewards on the passport) |
| **Vault, Cards & Rewards** | vault/{overview, ixcredits, card-packs, shop-items, trading, lore-cards, ns-import}, gameplay/{achievements, ribbons, leaderboards} | [ixcredits.md](./ixcredits.md), [cards.md](./cards.md), [myvault.md](./myvault.md), [achievements.md](./achievements.md), [ixnayid-passport.md](./ixnayid-passport.md) (showcase) |
| **Community** | social/{thinkpages, activity-feed, thinkshare, thinktanks, forum, blurbs} | [social.md](./social.md), [thinktanks.md](./thinktanks.md), [forum.md](./forum.md) |
| **Labs** | labs/{overview, myleague-myclub, onoma, vexel} | [myleague.md](./myleague.md), [onoma-roadmap.md](./onoma-roadmap.md), [vexel.md](./vexel.md) |
| **For Admins** | admin/{cms-overview, reference-data} | [admin-cms.md](./admin-cms.md) |

### Retired articles

These were removed because they described features that don't exist, or were merged into another article. The article route permanently redirects each old path (`retiredHelpArticles`):

| Old path | Now | Reason |
| :--- | :--- | :--- |
| `diplomacy/missions` | `diplomacy/embassies` | Embassy missions were deleted (plan 312); nothing to play |
| `defense/overview`, `defense/units`, `defense/customization` | `mycountry/defense` | Merged into one Defense guide |
| `defense/crisis-events` | `gameplay/world-events` | The crisis response engine isn't built; rewritten around what exists (urgent issues, admin world events) |
| `intelligence/{alerts, dashboard, executive-operations, forecasting, metrics, strategic-intelligence, unified-overview}` | `mycountry/intelligence` | The intelligence dashboard, alert rules and forecasting were deleted (plans 312/341) |

---

## Authoring Workflow

1. **Update the system guide** under `docs/systems/` if behaviour changed.
2. **Write the article** at `src/content/help/<folder>/<slug>.md`:
   - Frontmatter: `title`, `description`, `badge` (the hub section title), optional `prevHref`/`prevLabel`/`nextHref`/`nextLabel`. Values are not unquoted, so don't wrap them in quotes.
   - Style: a one-paragraph intro (what it's for, where to find it, linking the real route), then "How to…" steps, key facts, and tips or FAQ. Use the UI's real labels in bold. No marketing copy, no invented numbers.
   - Describe screens that are still being reworked at a stable level (purpose, where, what you can do) rather than pixel by pixel.
3. **Register it** in `helpSections` (`src/app/help/_lib/help-sections.ts`), with the same title as the frontmatter.
4. **Run the tests** (`bunx jest src/tests/content`).

To retire an article, delete the file, remove its registry entry, add the old path to `retiredHelpArticles`, and fix any links to it.

### Tests

- `src/tests/content/help-center.test.ts` – every file is registered exactly once and every registry entry has a file; registry titles match frontmatter; retired paths are gone and redirect to real articles; every in-article link and prev/next link resolves to an app route or an existing article (and heading anchor); search/filter behaviour.
- `src/tests/content/markdown-documents.test.ts` – every help and legal document renders with the expected heading ids, has a title/description/badge, and renders callouts correctly.

---

## Known gaps

- Articles are not versioned against the code; the tests catch broken links and missing files, not stale facts.
- A few articles document known product gaps so players aren't misled (trade tab settings not saved, crisis counts empty). The crafting article was removed when crafting was retired (2026-10-05). Remove those notes when the gaps close.
- `/util/lorewards` (and `/wiki/lorewards`) redirect to `/achievements?tab=wiki-lore`, but that page has no tabs and no Lorewards; the Lorewards article sends players to the passport instead.

---

## Related Documentation

- [Documentation Hub](../README.md)
- [Platform Overview](../overview/platform.md)
- [System Status](./SYSTEM_STATUS.md)
