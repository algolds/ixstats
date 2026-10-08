# IxStates Passport showcase

Date: 2026-10-07 · Branch: `rose-garden` · Status: approved design, awaiting plan

## Goal

Make the passport (`/@handle`) an external showcase: correct, tight, premium, and shareable.
Audience, in order: Discord/social unfurls, player bragging, recruiting outsiders. Embeds for
wiki/forum are explicitly out of v1.

Success means: a `/@handle` link pasted in Discord unfurls as a rich card showing the right person,
nation, realm and stats; the page itself reads in three seconds with no invented or repeated values;
a realm invite link credits the sharer when the recruit's claim is approved.

## Decisions (from the interview)

| Topic | Decision |
|---|---|
| Passport ID | Removed. It was client-generated decoration (`MidRibbonPassportDocument.tsx:106`), never stored or used. |
| Handle | New claimable `User.handle`; legacy forms 301 to it. |
| Front face hero | Person + nation. |
| Front stats | Lorewards + rank, realms/nations, member since. |
| Tabs | Realms (default), Work, Collection, History. Overview deleted. |
| Nation ownership | `Country.ownerUserId` only, after a review-and-backfill audit of leader-name matches. |
| Share v1 | Passport OG card, realm OG card, share sheet, realm invite links. No iframe embed. |
| Invites | Record inviter on the claim, reward with achievements only. |
| Name | "IxStates Passport". |
| Premium cues | Guilloché, tighter type and grid, polished flip/open, anti-slop pass. No realm-tinted cover. |
| Signed-out visitors | Quiet footer CTA. |
| Link previews | New `showLinkPreview` privacy toggle. |
| Country-name passport URLs | Dropped (`/@Caphiria` no longer resolves to a person). |

## Phase 1: identity and data correctness

### Schema (additive, nullable; owner runs `db:push:force`)

- `User.handle String? @unique`: lowercase, `^[a-z0-9_]{3,24}$`.
- `User.handleChangedAt DateTime?`: enforces the single self-service change.
- `RealmClaim.invitedByUserId String?` with an index.
- `PassportPreference.showLinkPreview Boolean @default(true)`.

### Handle

- Reserved: `me`, `admin`, `embed`, `settings`, plus the realm tab segments (`board`, `nations`,
  `rules`, `manage`, `happenings`).
- Backfill script (`scripts/identity/backfill-handles.ts`): slugify today's computed
  `passportHandle` (`routers/ixnayid/core.ts:96-105`), suffix collisions `_2`, `_3`. Dry run by
  default, prints the full table; writes only with `--apply`.
- The user can change their handle once from settings (`AccountIdentityPanel`); admins can always
  change it.
- Resolver (`identity.resolve.ts`): `handle` is checked first. Forum name, wiki name, Clerk id and cuid
  still resolve, and the page 301s to `/@handle`. Country name/slug/id resolution is removed from
  person lookup.
- Every display and share surface uses the server `data.handle`, never the URL segment. This fixes
  Share copying `/@me`.

### Nations and realms

- A nation is held only via `Country.ownerUserId`. Delete the leader-name and `identity.country`
  matching in `identity.resolve.ts:187-207` after the audit script
  (`scripts/identity/audit-leader-ownership.ts`) lists leader-name matches with no owner for review.
- `realmCount` counts distinct realms; add `nationCount` (`identity.service.ts:297`).
- Realm role (Founder from the realm's founder, Officer from `RealmOfficer`) replaces the site role
  on realm rows. Remove the invented "Leader" fallback (`identity.service.ts:73`).
- Filter out draft and unlisted realms with `DIRECTORY_REALM_WHERE` (`routers/realms/places.ts:26`).
- One concept, "Primary nation": `User.countryId` if set, otherwise the highest-GDP held nation. Used
  on the passport and in realms' "Play as" UI copy.
- The IxWorld fallback name is "IxWorld" everywhere (fix `identity.mappers.ts:16-18`).

### Privacy and cost

- `getHistory` honours `hideWiki` like `getWork` does (`identity.service.ts:375-395`).
- Move the fire-and-forget `db.user.update` (`syncLinkedAccounts`) out of the public `getPassport`
  query, into the signed-in owner's own status call.
- New `ixnayid.getPassportCard({ handle })`: about 4 queries, no external calls. It returns display
  name, handle, avatar, primary nation (flag, name, realm, realm role), the three front stats and the
  join date, each already redacted by `PassportPreference`. With `showLinkPreview` off, it returns
  a `preview: false` marker that metadata and the OG image honour. It is used by the front face, page
  metadata and the OG image. The tabs keep their own procedures.

## Phase 2: the document

### Front face

- Masthead: seal plus "IxStates Passport" on the left, Share on the right. Owner sees Edit;
  other signed-in viewers see Message (to `data.handle`).
- Body: portrait (Vault cosmetics kept), display name, `@handle`, then one line: flag, primary
  nation, realm, realm role.
- Stat row: Lorewards with rank (opens the existing Lorewards sheet), "N realms · M nations",
  "Since Mon YYYY". A stat that is unknown or hidden is omitted, never shown as a placeholder.
- Signature in serif, no label. ThinkPages bio becomes a one-line footer.
- Removed: ID, "Status: Active", duplicated primary-realm stat, front-face IxCredits/Focus/Forum,
  "01." tab numbering, Spark decorations, the `Eyebrow`.

### Back face (owner only)

- The hidden face gets `inert` (fixes the focus leak).
- Flip via CSS 3D transform. Reduced motion uses a crossfade.
- One-time open entrance (cover hinge, about 400ms, ease-out) on first load. Skipped under reduced
  motion and when the page loads onto a non-default tab.
- Back face privacy switches gain "Link previews" (`showLinkPreview`).

### Tabs

- **Realms** (default): nation cards (population, GDP, approval) grouped by realm with the realm
  role, "Recruited N" when N > 0, links to `/r/{slug}`. Delete the unreachable "View realm" and Globe
  placeholder branch (`PassportRealmsTab.tsx:166-170, :211-227`).
- **Collection**: vault level, deck value, top cards, IxCredits, Focus, achievements and the pinned
  showcase shelf. Vault links go to the holder's public vault view, or are removed if none exists.
- **Work**: unchanged content; forum counters (from the deleted affiliations panel) move to its
  header.
- **History**: unchanged, now respecting `hideWiki`.
- `?tab=overview` maps to `realms`. The Overview tab, "civic stature" panel and Showcase "Lorewards
  standing" panel are deleted.

### Visual pass

- `PassportGuilloche` component: one inline SVG of hairline rosettes, used as the front face's
  background at very low contrast in the page tint. Reused by the OG image.
- Tabular numerals for stats, hairline rules instead of nested cards, one spacing scale, semantic
  tokens instead of `text-yellow` / `text-blue` (`PassportStatGrid.tsx`, `PassportShowcase.tsx`,
  Lorewards sheet `bg-yellow` vs `bg-caution`).
- Anti-slop sweep across `src/components/passport/**` and the realm passport page: no eyebrows,
  Sparks, uppercase, em-dash placeholders or invented fallbacks.
- Tighten `src/tests/architecture/facet-ratchet.test.ts` so an aliased Spark import
  (`Spark as Sparkles`) is counted.

### Realm passport route

- Move `/r/[realm]/[username]` to `/r/[realm]/@[username]` inside the `(region)` layout. It gets
  the realm header, a 404 for unknown realms, and the passport's noindex rule. The old path
  redirects.
- Link officers and the founder on realm pages to `/@handle` (`RealmSidebar.tsx:98,117`,
  `RealmRegionHeader.tsx:142`).

## Phase 3: share layer

### Server metadata

- `src/app/id/[username]/layout.tsx` (already server) adds `generateMetadata` from
  `getPassportCard`: title `Display Name (@handle) · IxStates Passport`, description
  (primary nation, realm, stat line), canonical `/@handle`.
- `src/app/r/[realm]/(region)/layout.tsx` is a client component today. It becomes a server layout
  with `generateMetadata` wrapping the current client layout, which moves to
  `RegionLayoutClient.tsx`.
- Root layout sets `metadataBase` from the existing public base URL env var so prod's base path
  resolves.

### OG images (`next/og`, no new dependency)

- `src/app/id/[username]/opengraph-image.tsx`: 1200×630, guilloché background, portrait, name,
  `@handle`, flag, nation, realm, role, three stats, wordmark. Schibsted Grotesk from
  `public/fonts`. `revalidate = 3600`. With `showLinkPreview` off: a generic IxStates Passport card.
- `src/app/r/[realm]/(region)/opengraph-image.tsx`: banner (tint fallback), realm name,
  "N nations · M open to claim", "Join on IxStates".
- Confirm the proxy (`src/proxy.ts`) lets crawlers fetch both without auth.

### Share sheet

One component on the passport masthead and the realm header, built on the existing `ui/` Popover:

- Copy link: always the canonical URL, no `?tab=`.
- Native share via `navigator.share`, only where available.
- Download card: a link to the OG image URL with `download`.
- On realms, "Copy invite link" (`/r/{slug}?via={handle}`), only for viewers holding a nation there.

### Invites

- `/r/[realm]?via=handle` shows "@handle invited you" on the Join panel (client only; no per-inviter
  OG image).
- `via` survives sign-in through the existing `redirect_url`; no cookie.
- `claimCountry` and `claimNationPage` take optional `via`. The server sets
  `RealmClaim.invitedByUserId` only when the inviter resolves, isn't the claimant, holds a nation in
  that realm, and the claim has no inviter yet.
- On approval, `onNationAssigned` (`routers/realms/index.ts:41`) also queues an achievement check
  for the inviter. Three new achievements count approved invited claims: Recruiter (1), Envoy (5),
  Founder's Hand (25). Names are placeholders.
- Signed-out passport visitors see a footer: "Get your own passport" and
  "Join {primary realm}" (with `?via=`).

## Out of scope (v1)

Iframe embed (passports stay `X-Frame-Options: DENY`), oEmbed, QR codes, per-inviter OG cards,
realm-tinted passport covers, IxCredits recruiter rewards.

## Testing

Test first for the Phase 1 and Phase 3 server logic, with Jest following the existing
`src/tests/server/identity/*` patterns:

- Handle validation, reserved names, collision suffixing, single-change rule.
- Resolver: handle first; legacy forms return a redirect target; country names no longer resolve.
- Ownership-only nations, distinct realm count, realm role, draft/unlisted filtering.
- `getPassportCard` redaction, including `showLinkPreview`.
- `getHistory` with `hideWiki`.
- Invite guards: self-invite, inviter without a nation in the realm, an existing inviter never
  overwritten.

Component tests: the front face never renders an unknown stat; `?tab=overview` maps to Realms; the
hidden face is `inert`; the share sheet copies the canonical URL.

Gates: `typecheck:ui`, `typecheck:server`, Jest, lint. No builds. OG routes are checked by fetching
them in dev with the browser-check tooling.

## Risks

- Schema push and backfills touch production data. Scripts are dry-run by default and the owner
  runs `db:push:force` and `--apply`.
- If the ownership audit finds many name-only nations, those players lose them from their passport
  until backfilled. The audit runs before the matching is deleted.
- OG image URLs depend on prod's base path; verify `metadataBase` before shipping.
- The `(region)` layout split touches files with uncommitted in-flight realm work; land that first or
  rebase carefully.
