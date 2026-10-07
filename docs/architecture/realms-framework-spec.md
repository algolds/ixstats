# Realms — Product Model & Decisions

**Status:** Decided 2026-09-27 (design Q&A with the owner). Supersedes the earlier multi-tenant PRD
(`docs/archive/superpowers/specs/2026-07-21-realms-platform-prd.md` — `docs/archive/` is gitignored, so it exists only in local archives), which is historical only.
**Build phases:** 1 Foundation → 2 Founding → 3 Playing → 4 Social & governance.
Phase 1 spec: [`docs/specs/2026-09-27-realms-foundation-design.md`](../specs/2026-09-27-realms-foundation-design.md).

## What a realm is

A realm is a **separate world**: its own nations, map, lore and calendar. IxWorld is a realm — tenant 0,
the Ixnay community's world (`Realm.id = "default"`, slug `ixworld`). First outside community planned as a
live demo: **Eurth** (eurth.org — Discourse forum; lore on iiwiki `Portal:Eurth`; equirectangular map).

## The one rule

> **The realm wall is the country.** Anything a country owns is realm-scoped. Anything a person owns
> travels with their passport.

- Only *root* records carry a realm: `Country.realmId`, map layers (`MapLayer`, `TransportRoute`,
  `SharedVertex`), WikiOS `source`. Everything with a `countryId` inherits its realm through the country.
- Every query that lists **across** countries (leaderboards, rankings, directories, diplomacy lists) must
  filter by realm.
- **One backend.** No per-realm infrastructure. A realm is a tag, not a partition.

## Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Meaning | Separate worlds; IxWorld is tenant 0 |
| 2 | Scope | Country stuff → realm. Passport, messages, notifications, settings, **Vault (global)**, **achievements (per account)** → passport |
| 2 | ThinkPages | One feed per realm; a user setting shows one global feed |
| 3 | WikiOS / forum | Shared app, content tagged per realm (`WikiArticle.source` = realm), one backend; the WikiOS front page is a portal to all lore. Forum follows the same model |
| 4 | Realm context | The **active nation** decides the realm. `?realm=` only on pages with no nation of their own |
| 5 | Country names | Unique per realm. Slugs stay globally unique; a colliding slug gets a realm-qualified suffix. `/countries/[slug]` unchanged |
| 6 | Founding | Apply → site admin approves |
| 7 | Seed lore | Application may link an iiwiki or althistory page; on approval it is imported **once**, crawling sub-categories (visited-set, depth ≤ 5, ≤ 2,000 pages, no wiki-global categories, admin preview first) |
| 8 | Imported nations | Tagged *claimable*; a `Country` row is created only when someone claims one (builder, prefilled) |
| 9 | Map | Generated (UPG v2) or an uploaded image |
| 10–11 | Image maps | Auto-vectorised by the IxMap pipeline (`runMapPipeline`: PNG → potrace → SVG → GeoJSON); the admin runs `PipelineWizard` at approval and maps colours → nations. Founders supply a clean flat-colour political PNG |
| 12 | Membership | Owning a nation in a realm = membership. Founder = `Realm.ownerId`; no other roles yet |
| 13–14 | Claims | Claim anything that already exists (nation page, territory, existing country); create new nations freely. Founder (site admins for IxWorld) approves; **auto-approved** when the claimant is the verified creator of the nation's wiki page. Wiki accounts are verified by a token on the user page (ixwiki, iiwiki, althistory) |
| 15 | Nations per person | One per realm by default; founder may raise the cap (`Realm.settings.maxNationsPerUser`) — today site admins set it in `/admin/realms` (1–20); founder tooling is planned. The effective cap is min(realm cap, tier cap): 1 for free accounts, 5 for MyCountry Premium (`realms.nation-cap.ts`) |
| 16 | Vault income | One dividend per account, from its primary (earliest-created owned) nation — not the active one, so switching cannot farm payouts |
| 17 | Simulation | Identical in every realm |
| 18 | Time | One shared IxTime clock; per-realm in-world date label (display only, `Realm.settings.inWorldDate`; built 2026-10-07, see [realms.md §4](../systems/realms.md#4-realm-page-rrealm)) |
| 19 | Visibility | `public` or `unlisted` only — never private |
| 20 | Founder powers | Settings, claim queue, remove nations (data kept → claimable; appeal to site admin), moderate their realm's WikiOS articles and feed posts. One check: `canModerateRealm(user, realmId)` = site admin ∨ `realm.ownerId === user.id` |
| 21 | Lifecycle | Automatic founder succession (60 days unseen → earliest active nation owner; admin override); archived realms are read-only, excluded from crons and payouts |
| 22 | Passport | The passport is the hub: realms, nations, switching, claims, verification, applications, founder queue. A nav chip shows the active nation and opens it |
| 23 | IxWorld | Uses the same claim flow as every realm |
| 25 | Ownership | `Country.ownerUserId`; `User.countryId` becomes the *active* nation pointer |

## Explicitly not doing

Private realms · per-realm clocks/speeds · founder-tunable simulation (presets may come later — Eurth's
starting-stat caps are the first pressure) · Azgaar import · co-owned nations · realm dormancy handling ·
Clerk Organizations as realms.

## Known risks

- iiwiki's Cloudflare challenge blocks `IxStats-Builder` from a dev machine — confirmed 2026-09-28 the
  allowlist is IP-bound to production. Live wiki imports (verification, lore import) must run on prod, or
  from dev through the production proxy (`IIWIKI_DEV_PROXY_URL=https://maps.ixwiki.com/api/mediawiki/iiwiki/api.php`).
- Hand-drawn / textured maps will vectorise poorly; flat-colour political PNGs are required.

## Status (2026-09-29) — final

Both plans are complete and were merged into `rose-garden` on 2026-09-29 (`91a84f50f`), followed by the F-6
verification fix; the local, gitignored ledgers (`.superpowers/sdd/2026-09-27-realms-foundation`,
`.superpowers/sdd/2026-09-28-realms-eurth`) record every task and ruling. Runbook:
[`docs/systems/realms-eurth-onboarding.md`](../systems/realms-eurth-onboarding.md).

- **All tasks complete and reviewed clean:** Phase 1 tasks 1–8; Eurth tasks E1–E8.
- **Gates green at `1d376b33`:** typecheck server/trpc/db/ui 0/0/0/0; full Jest 322 suites / 2,921 tests
  passed.
- **Final whole-branch review** (`cfc44e15..1d376b33`): ready to merge with fixes; those fixes (rulings
  F-1–F-5, below) are applied in the final fix wave.

**Implemented — Phase 1 (tasks 1–8):**

- Schema: `Realm`, `RealmClaim`, `WikiAccountLink` models; `Country.ownerUserId`/`realmId`;
  `User.lastSeenAt` (T1).
- Wiki account verification — a token pasted on the player's own wiki user page proves control of an
  ixwiki/iiwiki/althistory account, provided the token's first appearance since the code was issued was
  saved by the account itself (F-3, F-6); the verified-link write is an admin-only path, separate from self-service linking (T2).
- Per-realm nation ownership with a per-user cap (`Realm.settings.maxNationsPerUser`, default 1; site
  admins set it in `/admin/realms` → Realms → edit → Nations per player, 1–20); a system owner *acting as*
  a nation is no longer treated as its real owner for notifications, crons, or auctions (T3, T5).
- `MapLayer` realm scaffolding and admin nation-assignment tooling (T4, T5).
- `scripts/realms/backfill-foundation.ts` — one-shot data backfill for owners, the IxWorld slug,
  unverified wiki links, visibility, and orphaned map layers; it checks the IxWorld realm row before any
  write and skips the map-layer move (reporting the ids) when NULL-realm rows clash with IxWorld's or with
  each other (T8, E4, E-t).
- Nation claim flow (`/r/eurth`-style `claimCountry`) with instant approval for the verified creator of
  the claimed page, and an `/admin/realms` → Claims review queue for everyone else (T6).
- Settings UI to link and verify wiki accounts (`WikiAccountVerifyRow`, Settings → IxnayID & Passport →
  Linked Accounts) (T7).

**Implemented — Eurth slice, first realm outside IxWorld (tasks E1–E7; status above):**

- `RealmPage` model indexing a realm's lore (titles only, never content) (E1).
- `DEFAULT_REALM_ID` and realm-scope query helpers; viewer-realm resolution (`?realm=` → active nation →
  IxWorld) (E2).
- Realm lore crawler/importer (`scripts/realms/import-realm-lore.ts`): keyword-subcategory crawl (depth 5,
  5,000-page cap, truncation reported), nations from an optional curated `--nation-roster` category or an
  infobox-heuristic fallback (E5).
- Claims extended to lore/nation pages (claiming creates the `Country`); WikiOS read-only rendering for
  non-ixwiki sources end-to-end — links, Halo, Watch, the edit route, and recent/paused sessions all carry
  the page's `?source=` (E6).
- Country-facing queries and caches made realm-correct (name lookups resolve within one realm; a nation
  name a player types — block, mute — is looked up in their own realm before any slug; admin tools and the
  admin flag warmers opt into every realm via `realm: "*"`; IxWorld's cache keys are unaffected) (E3, E-s).
- Map layers and the pipeline wizard are realm-scoped: the **Full Pipeline** mode imports into a chosen
  target realm and refuses an unknown one, while **Quick Update** always edits IxWorld's map. The world
  editor's realm follows the map it's drawn over; the country editor always works in the realm of the
  viewer's own nation, even when opened from another realm's map (E4, E-t).
- This runbook, [`docs/systems/realms-eurth-onboarding.md`](../systems/realms-eurth-onboarding.md) (E7).

- Image maps (decisions 10–11): the **Full Pipeline** takes a flat-colour PNG/JPEG (≤ 25 MB), detects its
  colours, lets the admin map each colour to one of the target realm's nations (existing countries and
  claimable nation pages) or ignore it, and vectorises only the mapped colours into regions named after
  their nations. Approving a nation-page claim links the new country to its realm's unlinked region of
  that name and syncs its geometry in the approving transaction (E8).

- Final fix wave (F-1–F-5): a claim in a second realm never takes the player off their first nation —
  **Play as** on `/r/[realm]` switches between nations they own (`users.setActiveNation`), and an admin
  assignment releases only the player's nations in the target realm; admins revoke verified wiki links on
  any wiki; a pending verification can be unlinked and an expired code is not shown as pending; a pending
  claim is re-verified and upgraded in place; claims, verification and Play as are rate-limited; the
  backfill refuses `--apply` while owner collisions remain or IxWorld is not owned by `system`.

**Not implemented yet (planned):** founder tooling (settings
such as the nation cap, moderation, removal, succession), the public founding application, a per-realm
ThinkPages feed and its global-feed setting, and the nav chip (a player switches with **Play as** on each
realm's page, or with the nation switcher in the nav user menu and on their passport's Realms tab). Also
still open: archived-realm handling (read-only,
excluded from crons and payouts — decision 21), the WikiOS front page as a portal to every realm's lore and
realm-tagged forum content (decision 3). A claimed nation page now prefills the nation its approval creates
from the page's infobox (E-f, AT-3; [realms.md §4](../systems/realms.md#4-realm-page-rrealm)).
Phases 2 (Founding), 3 (Playing) and 4 (Social & governance) have not started as phases; the Eurth slice
pulled forward only the pieces listed above (lore index import, nation-page claims, realm-scoped queries and
maps, PNG realm maps, the realm hub, Play as).

**Rulings (E-a..E-w, F-1..F-6):** E-a–E-j are the Eurth design spec's binding decisions
([`docs/specs/2026-09-28-realms-eurth-design.md`](../specs/2026-09-28-realms-eurth-design.md)) — index lore rather than copy it (E-a), a
5,000-page crawl cap for this slice (E-b), follow only keyword subcategories (E-c), infobox-based nation
detection (E-d), a script-based one-time import (E-e), claiming creates the `Country` (E-f), a
realm-suffixed slug on a name collision (E-g), realm-scoped cross-country queries (E-h), a per-realm
`MapLayer` unique key (E-i), and an admin-created realm owned by `"system"` until a founder exists (E-j).
Rulings made during implementation, superseding or extending those where noted: `?realm=` resolves any
realm status, including draft/archived (E-k); an optional `--nation-roster` category — never a retired
one — drives nation membership, superseding the infobox-only rule (E-d′); the WikiOS reader, Halo, Watch,
the edit route, and session history are all read-only and source-aware for non-ixwiki pages (E-l, E-l′,
E-l″); `ArticleNotFound` extracted to keep reader complexity under threshold (E-m); single-country
rankings scope by that country's own realm, not the viewer's (E-n); admin tools pass `realm: "*"` to see
every realm (E-o); name-based country lookups across ~8 call sites are made deterministic and
realm-correct (E-p); cache keys omit the realm segment for the default realm, preserving IxWorld's cache
sharing (E-q); the map editor's realm is the realm of the map being edited, not a fixed IxWorld default
(E-r); a nation name a player types (block, mute) resolves by name within the viewer's realm first, then
by slug — IxWorld holds the plain slugs — while URL/id lookups keep id → slug → name (E-s); and the E7
fix round carries the remaining final-wave code items so the docs describe the final code — E-s, the
`CountryData:` placeholder realm check, procedure-level `realmWhere` tests, all-realm admin flag warmers,
the admin nation-cap setting, the backfill preflight and duplicate report, the unknown-realm import guard,
and the country editor's realm (E-t). Task E8 (PNG maps through the Full Pipeline with colour → nation
mapping) was added because decisions 10–11 were otherwise unmet (E-u); potrace loads at runtime in every
runtime (E-v); colour analysis only detects colours, imported regions keep their metrics, and unreadable or
oversized map images are refused (E-w).

The final whole-branch review added five more; F-6 later tightened F-3. **F-1:** `assignNation` makes a nation the active one only
when the player has none; `users.setActiveNation` ("Play as") lets an owner switch between their nations;
`adminAssignNation` releases only the player's nations in the target country's realm. **F-2:**
`admin.unlinkUserWiki` takes a `source` and revokes through the wiki-links service; `admin.linkUserWiki`
writes nothing when `adminVerify` refuses (TAKEN). **F-3/F-6:** verification reads the user page's revisions from 5 minutes before the code was
issued to now and requires the token's first appearance in that window to be the account's own save (so a
revert cannot launder a planted code); a truncated window or a hidden revision cannot be attributed and is
refused. **F-4:** a pending verification can be unlinked, and
only an unexpired code counts as pending. **F-5:** a reused pending claim re-runs the creator check and is
upgraded in place; known alt accounts merge on ixwiki only; a lost auto-approval race is a claim error;
claims, verification and Play as use the light mutation rate limit; the backfill refuses `--apply` while
owner collisions remain or IxWorld's owner is not `system`, and the runbook re-runs the dry run after
deploy.
