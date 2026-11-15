# Halo expanded redesign: Nation and Passport, on Lens

**Date:** 2026-11-15 · **Status:** design, awaiting owner approval · **Branch base:** `rose-garden` (`fb18a868a`)

## Intent

Halo was IxStates' first original UI piece; the platform and the command palette grew around it. Its expanded
account panel (opened from the greeting on the closed pill, today `MyCountryView` in the core `"mycountry"` mode) has
"too much going on": a membership block, role badges, tap-to-switch stat tiles, a hand-picked action grid, and the
profile reachable three ways. It is not cohesive with the rest of Halo and does not read as IxStates the platform.

The owner wants the expanded Halo to read as the centre of the platform: one panel with two sides, **Nation** (the
realm and country you play) and **Passport** (your whole IxnayID account), built from the same parts the platform
already uses for those two things (the MyCountry hero and country actions sheet; the Passport front face), on Facet
Lens. Every other expanded Halo panel takes the same frame.

## Goals

- One account panel, opened from the greeting, with a two-part switch at the top: **Nation | Passport**. It reopens on
  the side used last.
- **Nation side** reuses the country actions sheet's own components for the viewer's nation (poster header, vitality
  strip, Manage, Open in, Share), in a Halo size, plus the membership tier.
- **Passport side** reuses the Passport front face in a compact size, plus the viewer's role, the "Play as" nation
  switcher, wiki drafts, account shortcuts and Sign out.
- **Country actions are one set everywhere.** The country actions sheet changes the same way as the Nation side (Edit
  beside Share; Manage becomes four tiles), from the same shared components.
- **National issues** move to a pinned row at the top of the notifications tray.
- **Every expanded Halo panel** (search, notifications, settings, MyCountry quick actions, wiki, builder, sports live)
  sits in the same frame: Lens island, solid wells inside, one header and spacing.
- A **temporary, admin-only toggle** compares two island materials (see Material), removed once the owner picks.

## Non-goals

- No change to which panels Halo has, or to their behaviour, beyond the account panel's content and the shared frame.
- No new data. One slim read-only procedure is allowed (see Passport side, data); nothing else server-side.
- No Labs work-in-progress other than wiki drafts (owner left Vexel, Onoma, unfinished founding and directive drafts
  out).
- No change to the closed pill's controls (greeting, Search, Notifications, Settings, plugin actions).

## Anti-goals (a failure even if it works)

- A Halo-only copy of the sheet's or the Passport's parts that can drift from the originals.
- Any part shown twice in one panel (the old panel showed the profile three ways).
- Glass on glass inside the island, other than the one documented exception below.
- Text that is hard to read over a busy page because of nested refraction.

## Constraints

- Facet 5 spec (`docs/reference/facet-design-system.md`), Apple design principles (the `apple-design` skill), the
  repo's CLAUDE.md rules: React Compiler on, `useState` ratchet (≤ 5 per file), `iconoir-react` only, Radix only via
  `src/components/ui`, no AI-design tells, sentence case, semantic tokens, named motion tokens and z-index scale.
- Halo guards must stay green: `facet-zero-dirs`, `facet-guards`, `halo-motion`, `facet-touch-targets`, compiler and
  useState ratchets, `docs:check`.
- The island's open/close morph is a Motion `layout` (FLIP) animation; Reduce Motion makes it instant.
- Lens refraction needs Chromium; elsewhere it must still read as a plain frosted surface. Reduce Transparency and
  Increase Contrast make it solid (existing `facet-lens` behaviour).

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (picked)** | Shared parts in two sizes: the sheet's parts become shared components with a `sheet` and a `halo` size; the Passport front face gains a compact size; Halo composes them. | More careful work up front; the only option where cohesion holds over time. |
| B | Halo-only copies that look like the sheet and the Passport. | Fastest; recreates the drift that made Halo incoherent. |
| C | Drop the whole sheet body and Passport front face into Halo. | Most reuse on paper; those parts are sized for a full-height sheet and a page (bleeds, tall top padding), so they need wrappers. |

Owner picked **A**, and asked for a second material version for comparison (Material, below).

## Owner decisions (as decided)

1. Structure: one door (the greeting), a two-part switch inside (**Nation | Passport**), not two buttons on the pill
   and not two stacked cards.
2. Nation side = the MyCountry hero and the country actions sheet's parts as the base.
3. Editors consolidated: **Country editor** and **Map editor** become one **Edit** button in the poster header beside
   Share, opening a two-item menu. Manage becomes four tiles: Dashboard, Executive, Diplomacy, Politics.
4. The country actions sheet changes the same way (Edit beside Share, four Manage tiles).
5. The "national issues are waiting" line is dropped from the Nation side and becomes a pinned row in the
   notifications tray.
6. **Open in** inside Halo hides Passport (the Passport side is one tap away); the sheet keeps it.
7. Nation side shows the **membership tier**; Passport side shows the **role**.
8. Passport side = the Passport front face as the base, as a "mini passport page" (guilloche, masthead, portrait with
   the Vault glow and frame, signature, name, @handle, stat row).
9. "Other realms (toggle)" = **switch nation**: the existing `NationSwitcher` ("Play as"), grouped by realm; switching
   moves the Nation side and all of MyCountry.
10. Work in progress on the Passport side = **wiki drafts** only.
11. Material: **Halo becomes Lens** (the one Chrome surface that is Lens, an amendment to the Facet spec), applied to
    the whole island including the closed pill. Inside, sections sit on solid wells; the one exception is the vitality
    strip over the flag poster (the spec's existing hero-over-cover case).
12. A second version, **Chrome island with Lens inside**, behind a **temporary admin-only toggle** for comparison.
13. All other expanded panels take the same frame.
14. Pinned issues row: top of the notifications tray, shown only to nation owners, cannot be swiped away, disappears
    when no issues are pending, opens Executive.
15. Realm founder credit is not shown in Halo (owner, after the builder check).

## Design

### The account panel

Opened from the greeting button on the closed pill (unchanged trigger, `data-halo-trigger="mycountry"`). The panel is
the existing `"mycountry"` expanded mode, renamed in UI copy only (the dialog's accessible name becomes "Account").

- **Switch:** `SegmentedControl` from `~/components/ui` with "Nation" and "Passport", at the top of the panel, inside
  the island's padding. The last side used is remembered per viewer in `localStorage` (a convenience; falls back to
  Nation). Signed-in viewers without a nation open on Passport, and the Nation side shows the existing "You don't
  have a nation yet / Found a nation" empty state. Signed-out viewers see the existing sign-in state with no switch.
- Width: the panel keeps the `MEDIUM` preset today; it will likely need `TALL` or a new width to fit the poster and
  four tiles comfortably. Builder's call, checked in the browser at 1366 px and 390 px.

### Nation side

Top to bottom:

1. **Poster header** (shared part, `halo` size): the flag sharp at the top fading behind the nation name; a blurred
   copy carrying the flag's colours down. Under the name: the realm badge (links to `/r/[slug]`), "Your nation", and
   the **membership tier** as a `Badge` ("Premium" for `mycountry_premium`, "Basic" otherwise). In the poster's top
   corner: **Edit** (menu: Country editor → `MYCOUNTRY_EDITOR_PATH`, Map editor → `MYCOUNTRY_MAP_EDITOR_PATH`) and
   **Share** (system share sheet, else copy link, as the sheet does today).
2. **Vitality strip** (shared part): Vitality, Population, GDP, each opening the same detail modal the sheet opens
   (`HeroDetailModal`). This is the one Lens inside the island, over the flag poster.
3. **Manage** (shared part, well): four round tone tiles: Dashboard, Executive, Diplomacy, Politics.
4. **Open in** (shared part, well): Profile, Wiki, Map, Exchange. Passport hidden in Halo (a `hide` option on the
   shared part).

Navigating from any of these closes Halo first, then routes with the router (existing `navigateWithBasePath` / Next
`Link` behaviour).

"The MyCountry hero as the base": the poster header and vitality strip are the same visual language as the MyCountry
header and dashboard hero (flag/cover with a frosted Lens panel over it). The shared parts should be the ones the
sheet uses today (`src/components/mycountry/dossier/CountryActionsHeader.tsx`). If the MyCountry hero has its own
copies of these, consolidating it onto the same shared parts is in scope only where it is a small change; otherwise
note it as follow-up.

### Passport side

Top to bottom:

1. **Passport page** (Passport front face, `compact` size): guilloche background, masthead, `PassportPortrait` (with
   the equipped Vault glow and frame), signature, display name with the **role** as a `Badge`, @handle, and the front
   face's stat row (Lorewards standing, nations and realms held, join month). The compact page is a **static picture
   with one link**: the whole page opens the full Passport (`/@handle`). None of the front face's own controls appear
   in compact size (no @handle copy button, nation or realm links, Lorewards modal, or masthead Edit), and there is no
   nation line (the Nation side shows it). *(Advisor's call.)*
2. **Play as** (well): `NationSwitcher` as it is (realm groups, active nation marked). Hidden when the viewer has one
   nation. Switching updates the Nation side and closes nothing.
3. **Wiki drafts** (well): `listDrafts(owner)` from `src/lib/wiki-os/editor/draft-store.ts`, newest first, at most
   three, each with "Resume" (opens the article in edit mode, as the wiki workspace does). Hidden when empty. Reads
   browser storage, so it renders after hydration and handles unavailable storage.
4. **Account shortcuts:** three compact buttons: Vault (`/vault`), Messages (`/messages`), Settings (`/settings`).
5. **Footer:** Sign out (Clerk `SignOutButton` with a ui `Button` child). No "View Passport" button: the Passport
   page above already links there. *(Advisor's call.)*

**Data** *(advisor's call)*: the full `ixnayid.getPassport` is too heavy to run on every open (Clerk lookup, forum
gateway, Lorewards, Vault and achievements showcases) and is keyed by a handle `users.getProfile` does not return.
The compact page reads existing light sources: `users.getProfile` (name, handle, role, tier, join date), Clerk
`useUser` (portrait), `ixnayid.getOwnPassportSettings` (signature), `realms.myNations` (nations and realms counts),
`useUserCosmetics` / equipped cosmetics (glow and frame). The one gap, the Lorewards standing, comes from a new slim
read-only procedure `ixnayid.getMyPassportCard` that wraps the existing `getPassportCard` in
`identity.service.ts` for the signed-in viewer (no new data, no writes). The compact front face takes these as props
rather than the full `PassportFaceData`.

Role: today's panel labels any role with `level <= 20` as "Founding member", but that level is the site-admin band
(owner, admin, staff). This design shows `role.displayName` and drops the derived label. The base role ("Member",
level 100) gets **no badge**, matching the Passport's own convention. *(Advisor's call.)* Realm founder credit (staff-chosen,
`realms.founders`) is **not shown in Halo**; it stays on the realm page and the full Passport (owner decision).

### Country actions sheet (`CountryActionsMenu`)

Uses the same shared parts in their `sheet` size. Changes: Edit (Country editor, Map editor) joins Share in the
sheet's corner for the viewer's own nation; Manage drops to four tiles; Open in keeps Passport. Behaviour for other
nations (Follow, Message, Summit, diplomacy rows) is unchanged.

### Notifications tray: pinned issues row

At the top of the Notifications tab in `NotificationsView`, above the grouped list: "N national issues are waiting",
from `api.nationalIssues.getPendingCount` (the query `use-nav-badges.ts` already uses, so it shares its cache). Shown
only when the viewer owns a nation and the count is above zero. No swipe or dismiss. Opens Executive
(`/mycountry/executive`) and closes Halo. It does not count toward the unread badge (it is a standing task, not a
notification).

### The shared frame for every expanded panel

- **Island material:** Lens (see Material). Inside, content sits on solid wells; sections are separated by spacing and
  wells, not hairlines.
- **Header:** `HaloViewHeader` becomes the one header: title (or the switch, for the account panel), optional
  trailing actions, Close. Same padding everywhere.
- **Spacing:** one inner padding and one gap scale for all panels (builder picks from the Facet spacing tokens and
  applies it consistently).
- Panels in scope: Search, Notifications, Settings, MyCountry quick actions, Builder "Jump to section", Wiki (workspace,
  narrator, profile), Sports live, and the **NavTray** (the apps grid under the island), which moves off
  `FacetMaterial layer="chrome"` with the island and follows the material toggle. Their content and behaviour stay; they are restyled onto wells inside the frame.
- `HaloEmpty`, `HaloCloseButton`, `country-actions.ts` remain the shared vocabulary; `HaloViewParts.tsx` gains a
  `HaloWell`.

### Material

- **Version 1 (default): Halo is Lens.** The island (closed pill and expanded panel) uses the Lens layer
  (`FacetMaterial layer="lens"` or the `facet-lens` utility) instead of `facet-chrome`. The refraction samples the
  page beneath. Inside: solid wells; the vitality strip is the only inner Lens.
- **Version 2: Chrome island, Lens inside.** The island stays `facet-chrome`; the inner hero panels (vitality strip,
  Passport page, Manage and Open in wells) are Lens. This is glass on glass, allowed only for the comparison.
- **Toggle:** a "Halo material" switch (Lens / Chrome + Lens) visible only to admins (`useCanOpenAdmin`), in Halo's
  quick settings. Stored per viewer in `localStorage`. Not shown to players; both versions removed down to the winner
  after the owner decides (tracked as a follow-up).
- **Spec amendment:** `docs/reference/facet-design-system.md` section on Lens gets one line: Halo's island is the one
  Chrome surface that is Lens (owner ruling 2026-11-15). The comparison version is not documented as allowed.

### Motion and accessibility

- The island's existing layout morph stays. Risk: Lens refraction is computed in the island's own box, and the FLIP
  morph scales the box, so the bend may distort mid-animation. Check in a browser; if it does, drop the refraction
  (keep the frost) while the island is animating, or animate a static-size backdrop layer. Reduce Motion stays
  instant.
- Switching Nation ↔ Passport cross-fades the content (no slide), and the island resizes with its morph.
- The switch is a real segmented control (arrow keys work); the panel remains `role="dialog"` with focus moved inside
  and returned to the greeting on close (existing behaviour).
- All new controls: ui `Button`/`Badge`/`SegmentedControl`/`DropdownMenu`, `focusRing`, 44 px touch targets on coarse
  pointers.

## Left to the builder

- Exact widths and preset for the account panel; exact spacing tokens.
- How the shared parts take a size (`size` prop vs. separate thin wrappers), as long as both the sheet and Halo render
  the same components.
- Whether the Edit control is a `DropdownMenu` or a small popover (must open from the button, per spatial
  consistency).
- How to lazy-load the Passport and sheet parts so they stay out of every page's first bundle (Halo's expanded views
  are already lazy).
- Tests: component tests for both sides (signed out, no nation, one nation, several realms; drafts present/absent;
  tier and role), the sheet's own-nation layout, the pinned tray row (shown/hidden/count), the admin toggle gating, and
  the existing Halo guards.
