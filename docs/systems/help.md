# In-App Help System

**Last updated:** August 2026  
**Status:** Production Ready (Beta)  
**Hierarchy:** Platform Support & Documentation Suite.

The in-app help system delivers rich, interactive, and contextual documentation directly inside the application at `/help`. It mirrors the technical and gameplay specifications in this repository so player-facing guidance remains 100% consistent with developer references.

---

## Architecture & Routing

- `src/app/help/page.tsx` – Main help center hub with full-text search, category filters, and quick links
- `src/components/documents/DocumentPage.tsx` / `DocumentLayout.tsx` – one markdown layout (breadcrumb, table of contents, share/print) shared with `/terms` and `/privacy`
- Articles are markdown files at `src/content/help/<category>/<slug>.md`, served by the single dynamic route `src/app/help/[category]/[slug]/page.tsx` (404 when the file is missing)
- Headings take an id from a trailing `{#id}` or a slug of their text; `> [!WARNING]` blockquotes render as warning callouts, other blockquotes as info callouts

---

## Category Taxonomy

| Category | Coverage & Scope | Key System Guide |
| :--- | :--- | :--- |
| **Getting Started** | Account setup, first nation creation, Builder walkthrough | [`systems/builder.md`](./builder.md) |
| **Executive & Statecraft** | Directives, Civil Capacity (CivCap), Issues inbox, Cabinet meetings | [`systems/mycountry.md`](./mycountry.md) |
| **Economy & Resources** | GDP tiers, taxes, budget allocations, passive income dividends | [`systems/economy.md`](./economy.md) |
| **Governance & Politics** | Atomic government components, legislature, elections | [`systems/elections.md`](./elections.md) |
| **Defense & Security** | Readiness posture, military operations, equipment catalogs | [`systems/defense.md`](./defense.md) |
| **Diplomacy & Intelligence** | Embassies, missions, treaties, classified briefings | [`systems/diplomacy.md`](./diplomacy.md) |
| **IxVault & Cards** | Trading cards, pack opening, crafting, marketplace | [`systems/cards.md`](./cards.md) |
| **IxWorld Maps** | MapLibre navigation, layer controls, territory editor | [`systems/maps.md`](./maps.md) |
| **Social & Community** | ThinkPages, ThinkShare messaging, Forum, Stashes | [`systems/social.md`](./social.md) |
| **Linguistics (Onoma)** | Name generation, conlang studio, Kokoro voice narration | [`systems/onoma-brand-guide.md`](./onoma-brand-guide.md) |

---

## Authoring Workflow

1. **Update System Guide**: Maintain or update the primary Markdown specification under `docs/systems/`.
2. **Author In-App Article**: Create or update `src/content/help/<category>/<slug>.md` (no React code needed), and add it to the hub's list in `src/app/help/page.tsx`.
3. **Register in Hub Config**: Update the `helpSections` array in `src/app/help/config.ts` with metadata (title, description, icon, keywords).
4. **Contextual Tooltips**: Wire in-app question mark icons (`<HelpTooltip topic="..." />`) directly to the relevant help slug.

---

## Related Documentation

- [Documentation Hub](../README.md)
- [Platform Overview](../overview/platform.md)
- [API Reference](../reference/api-complete.md)
