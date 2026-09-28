# Realms — Product Model & Decisions

**Status:** Decided 2026-09-27 (design Q&A with the owner). Supersedes the earlier multi-tenant PRD
(`docs/archive/superpowers/specs/2026-07-21-realms-platform-prd.md`), which is historical only.
**Build phases:** 1 Foundation → 2 Founding → 3 Playing → 4 Social & governance.
Phase 1 spec: `docs/superpowers/specs/2026-09-27-realms-foundation-design.md`.

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
| 15 | Nations per person | One per realm by default; founder may raise the cap (`Realm.settings.maxNationsPerUser`) |
| 16 | Vault income | Only the active nation pays |
| 17 | Simulation | Identical in every realm |
| 18 | Time | One shared IxTime clock; per-realm calendar label via `Realm.settings.yearOffset` (display only) |
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

- iiwiki's Cloudflare challenge blocked `IxStats-Builder` from a dev machine (2026-09-27); the allowlist may
  be IP-bound to production. Phase 2 imports may only run on prod.
- Hand-drawn / textured maps will vectorise poorly; flat-colour political PNGs are required.
