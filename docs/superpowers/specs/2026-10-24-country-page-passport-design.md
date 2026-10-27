# Country page as one document (passport-style)

Date: 2026-10-24 · Branch: rose-garden · Owner decisions gathered in conversation on 2026-10-24.

## Intent

The public country page (`/countries/[slug]`) has grown four layers of navigation and repeats the same subjects in two or three places. The owner wants it **clean, streamlined, no fat, like the passport** (`/@me`): one document with an identity face, a ribbon attached to it, and one panel. Every subject lives in exactly one place.

Today a visitor can pass through: the Factbook · Dossier · Activity bar, then the overview card's five tabs (Lore, Map, Economy, State, Foreign affairs), then on deep pages the Factbook section links (Overview, Economy, Labor, Government, Geography), then collapsibles inside those sections. Lore exists in the Lore tab and the Dossier; the map in the hero and the Map tab; the economy in the Economy tab, the Economy section and the Labor section; the state in the State tab and the Government section.

## Goals

- One passport-style document: hero face, ribbon, one panel.
- Four ribbon tabs, each the single home of its subject: **Factbook · Map · Lore · History**.
- The Factbook is a snapshot of every subject that fits about one screen; full detail is one level deeper, in context (a sheet), never a separate page tier.
- Each tab has its own URL, switching instantly.

## Non-goals

- Changing the hero face built on 2026-10-24 (shared `CountryHeroCard`, map media slot, identity panel, figures, Country DNA row), apart from the actions below.
- Changing MyCountry or the dashboard (the dashboard keeps rendering `CountryHeroCard` as today).
- Rewriting the deep economy, labor and government sections' internals; they move into sheets as they are.

## Anti-goals (a failure even if it works)

- Any second navigation tier inside a tab (pills, rails, nested segmented controls). The Economy & people sheet's two segments are the only exception, and they live inside the sheet.
- The same subject shown in two tabs (no lore in the Factbook, no second map outside the hero and the Map tab).
- A page that scrolls through stacked cards to find things: the Factbook must read as a snapshot.

## The document

```
Countries › Caphiria                                  (breadcrumb, kept)
┌─ face ───────────────────────────────────────────────────────────┐
│ [ live map  ⤢ ]        │ flag · Caphiria · ribbons      [Action] │
│                        │ chips: Federal Republic · Capital Venceia│
│                        │ realm · IxnayID strip                    │
│                        │ POP | GDP | Standing · Approval · Stab.  │
│ Country DNA row: rings · rank chips · meters                      │
├── Factbook ─── Map ─── Dossier ─── History ──────────────────────┤  ← passport ribbon
│                                                                    │
│   the one panel                                                    │
└────────────────────────────────────────────────────────────────────┘
```

- **Face**: today's `ProfileHero` on `CountryHeroCard`, unchanged except that the hero map gets an expand control (see Map) and the action button moves onto the face (see Actions).
- **Ribbon**: the passport's ribbon (`src/components/passport/document/PassportTabRibbon.tsx`), visually identical. It hardcodes the passport's tabs today, so it must be generalised into a shared document ribbon that takes its tabs (id, label, icon, optional count), with the passport passing its four and the country page passing its four. Its tabs/tabpanel ARIA pattern and the passport's panel transition (spring fade, `REDUCED_MOTION_FADE` under Reduce Motion) carry over.
- **Panel**: inside the same card as the face and ribbon, as on the passport (`MidRibbonPassportDocument`).
- The separate `CountryTabs` bar, the overview card's own header and segmented control, `FactbookSectionNav` and the `factbook/layout.tsx` pill rail all go away.

## Tabs

### Factbook (`/countries/[slug]`)

Three compact snapshot blocks, side by side on wide screens and stacked on phones, in this order: **Economy & people · State · Foreign affairs**. Each block: one headline figure, three to five facts, one small visual, and one **More** that opens its sheet. The whole tab should fit about one screen at 1440px.

- **Economy & people**: headline GDP; real growth, unemployment, inflation; population (with growth), demonym, languages; small visual: the population-by-region share bar. More → sheet with today's **Economy** and **Labor** sections as the sheet's two segments, and one "Model scenarios" link to `/countries/[slug]/modeling` (kept; it is the app's only economic modeling).
- **State**: headline system of government; head of state, head of government, executive; legislature, judiciary, next election ("–" when empty); small visual: the compact chain of offices. More → sheet with today's **Government** section.
- **Foreign affairs**: headline embassy count (else relation count); relations, partners, tensions, treaties; small visual: a mini relations hub (one node per country, an embassy merged into its country's relation). More → sheet with the full relations and embassies lists.
- No Land block: land lives in the Map tab.
- No Lore: lore lives in the Dossier.

Sheets: the app's `Sheet` (Overlay layer), opening from the trailing edge; one open at a time; Escape and the close button dismiss; the URL reflects the open sheet (`?sheet=economy|state|foreign`) so it can be shared and the back button closes it.

### Map (`/countries/[slug]/map`)

The map's one home:

- A big interactive territory map (neighbours, cities, regions; zoom and pan) with one small **Open on map** link to the full Maps app focused on this country (the only place that link appears).
- Land facts beside the map: land area and density, capital, coastline, setting, climate, terrain, arable land, borders (today's Map spread column).
- The regions list with population; choosing a region focuses the map on it.
- Story pins: the country's map stories (title, year or era label, excerpt) as a list; choosing one focuses the map on its pin.
- Today's Factbook Geography section content is folded in here where it adds data the tab does not already show. The country page is read-only for everyone (including the owner) today, so the Map tab is read-only too; geography editing stays where it is (builder's call, owner-confirmed by omission). The country editor's Geography link points to the Map tab.

The hero map's expand control switches the ribbon to Map (and scrolls the panel into view); it does not open a separate full-screen overlay.

### Lore (`/countries/[slug]/lore`, formerly Dossier; `/dossier` redirects)

All the lore and wiki in one reading column:

- The prologue as a lead (larger opening paragraph, the wiki Reading face, 38rem measure).
- Then the wiki chapters in article order, each with its heading, in the same reading style.
- A slim chapter index beside the column on wide screens that follows the section being read (scroll spy), hidden on phones (or a compact jump menu).
- Native lore is not on the public Dossier yet. Today it lives in each visitor's own browser (`useNativeLore`, localStorage) and any visitor can edit it; the owner chose to make it real shared content, which needs a server model and a production schema change, so it is a **separate follow-up project**. When it lands, it joins the Dossier as the last chapter group.
- Today's `DossierTab` modes (Sections / Native lore) are replaced by this single column.

### History (`/countries/[slug]/history`)

One dated timeline, newest first, merging the chronicle (founding dates, map stories, directives, resolved issues, decisions, diplomatic events) with the activity feed items. The existing filter chips (All, Posts, Economic, Diplomatic, Social) and the date-range control stay, plus a **Record** chip. Today's separate Chronicle card and feed list become this one list.

Builder's calls (from the builder check): items sort on the in-game calendar (feed timestamps converted with `IxTime.convertToIxTime`); the date range filters feed items only, so chronicle entries (all time) always show under All and Record; chronicle diplomacy entries also show under Diplomatic; each item keeps its own date label (the chronicle's in-game date, the feed's relative time); no de-duplication across the two sources.

## Actions

- **Visitors**: one primary button on the hero face, "Country actions", opening today's `CountryActionsMenu`.
- **Owner**: a "Manage" button on the face that flips **the face only** (the hero card turns over; the ribbon and panel stay put) with the passport's flip (3D turn, crossfade under Reduce Motion, focus returns to Manage on flip-back; see `MidRibbonPassportDocument`). The back face holds: the cover choice (today's `CoverPicker` options), links to MyCountry and the country editor, and today's private owner strip (`OwnerLayer`: active issues, drafts, directives in force).
- The button leaves the breadcrumb row; the breadcrumb itself stays.

## URLs and redirects

- `/countries/[slug]` Factbook, `/map`, `/lore`, `/history`, switched without a route transition (the app's single-page router pattern: `useState` + `history.pushState` + `popstate`, as `MyCountryRouter` and `CardsHub` do; every tab's `page.tsx` renders the same router).
- Redirects: `/activity` → `/history`; `/dossier` → `/lore`; `/factbook` and `/factbook/economy` → Factbook with `?sheet=economy`; `/factbook/labor` → `?sheet=economy` on its Labor segment; `/factbook/government` → `?sheet=state`; `/factbook/geography` → `/map`.
- The remembered overview tab (`ixstats:country-overview-tab` in localStorage) is retired with the overview card.

## Retired

- The overview card and its spreads as tabs (`OverviewCard`, `spreads/*`): their content is reused where noted (Map column, Foreign hub, State chain, region bar), the rest deleted.
- `CountryTabs`, `FactbookSectionNav`, `factbook/layout.tsx`'s pill rail, the Lore tab, the separate Chronicle card.

## Constraints

- Facet (docs/reference/facet-design-system.md): one primary action per surface, glass never on glass (a Card inside the document is a Well), no eyebrows, uppercase labels, emoji or em dashes in UI copy, sentence case, `iconoir-react` only, semantic tokens only. The country pages wear the Realms tint today; keep it.
- Every public figure and sheet reads public endpoints (verified 2026-10-24: `mycountry.getCountryDashboard` is public and redacts budgets for non-owners; the detail modals use public procedures).
- Repository rules: bun only; no global `tsc`; gates are `typecheck:ui`, `typecheck:tests`, oxlint and Jest (`--maxWorkers=1`); no `next build`; complexity thresholds in CLAUDE.md; dead code 0, so delete what this retires.
- Reduce Motion, Reduce Transparency and 44px coarse targets throughout.

## Left to the builder

- Exact snapshot block contents within the limits above, and the small visuals' sizing.
- How the shared document ribbon is extracted (name, location) as long as the passport looks and behaves exactly as before.
- The Dossier's phone treatment of the chapter index.
- How the History merge orders items with equal dates.
- Test coverage: the ribbon's tab/URL mapping and redirects, the timeline merge, and the snapshot derivations at minimum.
