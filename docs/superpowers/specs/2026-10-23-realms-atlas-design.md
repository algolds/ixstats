# Realms atlas: the /realms landing refresh

Status: approved by the owner on 2026-10-23, through question rounds and a clickable mockup
(https://claude.ai/artifact/Eg8YczfteYTDv2CcgYyNwB).

## Problem

`/realms` reads as unfinished next to ThinkPages and the Dashboard:

- It sits off Facet. Each section is a hand-rolled opaque `border bg-surface` box that hides the
  realms canvas wash `AppShell` already paints.
- The hero is a boxed SaaS block: an explainer paragraph, three caption stats and two buttons.
- Each realm appears three times: in Open to join, in Browse all and in search results. Only two
  realms are listed.
- The directory cards show an empty grey banner when a realm has none, and both live realms have none.
- The realm feed sits full width at the bottom of a single column.

## Direction

The page is an **atlas of worlds**: realms are places, so the worlds themselves lead.

### Header

`PageHeader` on the canvas, with no box:

- Title "Realms".
- Subtitle: one sentence for newcomers, then a counts line.
- One action at the right.

The newcomer sentence shows only to signed-out viewers and signed-in viewers with no nation:
"Worlds with their own nations, boards and lore. Claim a nation and play."

The counts line reads "2 realms · 280 nations · 262 open", using the existing totals (nations is
the sum of `nationCount`, open is the sum of `openToJoinCount`).

The action depends on who is viewing:

| Viewer | Action | Style | Target |
| --- | --- | --- | --- |
| Signed out | Sign in to play | primary | sign-in, redirecting back to /realms |
| Signed in, no nation | Join a realm | primary | `#atlas` |
| Holds nations | Join another realm | outline | `#atlas` |

### Layout

On desktop the page has a main column and a 20rem right rail, like ThinkPages.

- **Main column:** the atlas grid, then Your claims (`MyClaims`, unchanged, shown only when the viewer has claims).
- **Rail:** search, Your realms (signed in), then the realm feed.

Below `lg` everything is one column in this order: search, atlas, claims, Your realms, feed.

### Atlas grid

- Every listed realm is one card. The default order is most open nations first, then name.
- Open to join is no longer a separate section. Its job moves into the cards.
- Sort and tag filters appear only when there are 6 or more realms.
- Below `md` the grid becomes a horizontal scroll-snap row with cards at 84% width.
- A final tile depends on the viewer:
  - **Admins:** "Found a realm", linking to `/admin/maps/studio`.
  - **Everyone else:** "Bring your realm", linking to the ThinkPages Find a Realm board (`/thinkpages/c/find-a-realm`).

### Realm card (Facet `Card content="entity"`)

**Face band.** The face uses the first of these that applies:

1. The founder's banner.
2. The realm's map face.
3. The realm's crest centred on the tint field.

**Map face.** This is an inline SVG of the realm's political map in Web Mercator, built from PostGIS.

| Layer | Fill |
| --- | --- |
| Water | the well colour |
| Land | the realm's climate layer merged into one shape, `fill-3` |
| Open nations | hatched in tint |
| Claimed nations | solid tint |
| Unassigned or reserved | land |

Borders are surface-coloured hairlines. It is cached per realm for an hour. Colours come from
Facet tokens, so it follows light, dark and contrast settings.

**Crest.** `RealmCrest` overlaps the bottom-left of the band.

**Body**

- **Name:** a stretched link, so the whole card opens `/r/{slug}`.
- **"N open" chip:** a hatch swatch matching the map's open pattern, shown only when N > 0.
- **Description:** clamped to two lines.
- **Tags line:** joined with " · ".
- **Meta line:** "{N} nations · {board activity}".

**Actions.** Join links to `/r/{slug}/nations`. Its label depends on how many nations the viewer
holds in the realm:

| Viewer holds | Shows |
| --- | --- |
| none | Join |
| some, below the cap | Claim another |
| the cap | no button, the text "You hold N of M" |

### Motion

All motion follows Apple's fluid-interface rules.

- **Press:** feedback on pointer-down. The card scales to 0.985 while its link is pressed, and
  buttons use the Facet press.
- **Drift:** while a mouse moves over a card, the face drifts against the pointer by at most 6px
  horizontally and 4px vertically, on `springSmooth`. It springs back on leave.
- **Shared element:** opening a realm morphs the card's face into the realm page header's face.
  It uses React `<ViewTransition name="realm-map-{slug}">` and is a progressive enhancement: no
  morph means plain navigation.
- **Reduced motion:** none of the above, no drift and no morph.

### Realm page header

`RealmRegionHeader`'s face band uses the same banner → map face → tint field order in place of
the globe icon, inside the matching `<ViewTransition>`.

### Rail

- **Search:** one field. Typing filters the atlas grid by name, description and tag. From 2 characters it
  lists nation matches below the field (the existing `realms.searchNations`).
- **Your realms:** a compact list. Each realm shows its crest, name and "N of M". Each nation
  shows its flag, name and Play as, then Board and Nations links.
- **Realm feed:** the scope select plus up to 5 compact rows (author, excerpt, time), linking to the
  post. Then an "Open the feed" link to `/dashboard`.

## Removed

`RealmsHero`, `OpenToJoin` (and `openRealms`), `BrowseRealms`, `RealmSearch`'s realm result list,
and the boxed section wrappers.

## Out of scope

- A player-facing realm founding flow.
- Map face invalidation on map edits (the one-hour TTL covers it).
- Redis caching (in-process cache only).
- The front page's realm panes.
