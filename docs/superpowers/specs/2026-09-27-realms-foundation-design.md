# Realms Phase 1 — Foundation (design)

**Date:** 2026-09-27 · **Branch:** `realms-foundation` (from `rose-garden` 9f2bd3a6)
**Product model:** `docs/architecture/realms-framework-spec.md` (read first — the decisions table is the source of truth).
**Goal:** Put the data model and security foundations under Realms with **no user-visible change for IxWorld
players except the claim flow**, and close two live holes:
1. `ixnayid.linkWiki` links any unclaimed ixwiki username without proof of ownership (spoofs authorship,
   Lorewards and achievements attribution).
2. `users.linkCountry` lets any signed-in user take any unclaimed IxWorld nation, first come first served.

Phases 2–4 (founding, playing, social) are out of scope; nothing here may build their UI.

## Invariants

- **I1 — ownership:** `Country.ownerUserId` is the owner. `User.countryId` is the owner's *active* nation:
  it is `null` or points at a country with `ownerUserId = user.id`. System owners
  (`isSystemOwner(clerkUserId)`) are exempt — they may point at any country (existing override).
- **I2 — cap:** a user owns at most `realmSettings(realm).maxNationsPerUser` (default **1**) countries per realm.
- **I3 — one writer:** only `src/server/modules/realms/realms.ownership.ts` writes `Country.ownerUserId` or
  `User.countryId`.
- **I4 — behaviour parity:** every existing writer/reader keeps its current observable behaviour for IxWorld
  (one user ⇄ one nation), except `linkCountry`, which becomes a claim.

## §1 Ownership & the active nation

Schema (`prisma/schema/core.prisma`):
- `Country.ownerUserId String?` + `owner User? @relation("CountryOwner", fields: [ownerUserId], references: [id], onDelete: SetNull)`, `@@index([ownerUserId])`.
- `User.ownedCountries Country[] @relation("CountryOwner")`. `User.countryId` / `country` / `Country.users` unchanged (active pointer).

Module `src/server/modules/realms/realms.ownership.ts` (arch.md: modules never import other modules):
- `assignNation(tx, { userId, countryId })` — fails if the country is owned by someone else; enforces I2
  (count `Country where ownerUserId = userId AND realmId = country.realmId AND id != countryId`); sets
  `country.ownerUserId` and `user.countryId` in the caller's transaction.
- `releaseNation(tx, countryId)` — clears `ownerUserId`; nulls `countryId` of any user whose active pointer
  is that country.
- Existing writers are rewritten to call these, preserving their current semantics (I4):
  `admin/users.ts` (`assignUserToCountry`, `unassignUserFromCountry`, and the system-owner branch which only
  moves the active pointer), `users/country-linking.ts` (`createCountry`, remaining paths),
  `countries/management/create.ts`, `users/profile.ts`, `geo/editor/linkage/{assignment,validation}.ts`.

Owner lookups (≈30 sites) move from "user whose `countryId` = X" / `country.users[0]` to
`country.ownerUserId` / `country.owner`:
- `user.find*({ where: { countryId } })`: `lib/activity/{auto-post,hooks}.ts`, `lib/economy/auction-service.ts`
  (×2), `lib/intent/intent-summation.ts`, `lib/vault/vault-passive-income.ts`,
  `routers/achievements/{country,progress}.ts`, `routers/countries/management/lifecycle.ts`,
  `routers/meetings/meetings.ts`, `routers/security/conflicts.ts` (×2),
  `modules/messaging/conversation-operations.ts`.
- `country.users[0]` / `users: { some }`: `app/countries/[slug]/(profile)/layout.tsx`,
  `routers/achievements/country.ts`, `routers/admin/countries/grid.ts`, `routers/admin/users.ts`,
  `routers/countries/economy.ts`, `routers/diplomacy/policies/alliances.ts`,
  `routers/geo/editor/linkage/validation.ts`, `routers/security/conflicts.ts` (×3),
  `modules/identity/identity.resolve.ts`.
- "Played countries" crons select `Country where ownerUserId not null`:
  `lib/government/politics-drift-cron.ts`, `lib/national-issues/generation-cron.ts`.
- **Unchanged (active semantics, correct as-is):** `ctx.user.countryId` everywhere,
  `countryOwnerMiddleware`, `lib/economy/passive-income-distribution-cron.ts` (only the active nation pays),
  `routers/users/admin.ts` "users with countries".

Not in Phase 1: `setActiveNation`, passport switcher, nav chip (Phase 3).

## §2 Verified wiki accounts

Schema (`core.prisma`): `WikiAccountLink { id, userId → User (Cascade), source ("ixwiki"|"iiwiki"|"althistory"),
username, wikiUserId Int?, token String?, tokenExpiresAt DateTime?, verifiedAt DateTime?, createdAt, updatedAt;
@@unique([source, username]); @@unique([userId, source]) }`.

Flow (identity module `identity.wiki-links.ts`, MediaWiki I/O in `src/lib`):
1. `ixnayid.startWikiVerification({ source, username })` — resolves the user via the wiki API (must exist),
   refuses if another IxStats user holds a *verified* link for `(source, username)`, upserts the link with a
   fresh token `ixstates-verify-<10 chars>` valid 24 h. Returns the token and the exact user-page URL.
2. The user pastes the token anywhere on `User:<username>` on that wiki.
3. `ixnayid.confirmWikiVerification({ source })` — fetches the user page's current wikitext through the
   wiki API (`User-Agent: IxStats-Builder`); if it contains the unexpired token → `verifiedAt = now`, token
   cleared. For `ixwiki` it also writes the legacy `User.wikiUsername` / `wikiUserId` (45 consumers read them)
   via the existing `linkWikiAccount` internals.
4. `ixnayid.unlinkWikiAccount({ source })` — deletes the link; for `ixwiki` also clears the legacy columns.

- `ixnayid.linkWiki` (unverified write) and `unlinkWiki` are **removed**; their two callers
  (`AccountIdentityPanel.tsx`, `IxnayIDCard.tsx`) use the new flow. The admin path
  (`admin/users.ts` → `linkWikiAccount`) stays as a trusted override and marks the link verified.
- Existing ixwiki links are backfilled as **unverified** rows (legacy columns untouched, nothing breaks);
  only verified rows count for claim auto-approval. Username comparison is MediaWiki-normalised
  (underscores → spaces, first letter upper-case).
- UI: the linked-accounts section of `AccountIdentityPanel` shows ixwiki, iiwiki and althistory rows, each
  with *Unverified / Verified* state and the token step. Moving this into the passport is Phase 3.

## §3 Claims

Schema (`maps.prisma`): `TerritoryClaim` (0 rows, 0 references) is replaced by
`RealmClaim { id, realmId → Realm (Cascade), userId → User (Cascade), countryId String? → Country (Cascade),
wikiSource String?, wikiPageTitle String?, mapLayerFeatureId String?, status ("pending"|"approved"|"rejected"|"withdrawn"),
autoApproved Boolean @default(false), reviewedBy String?, reviewedAt DateTime?, rejectionReason String?,
createdAt, updatedAt; @@index([realmId, status]); @@index([userId]); @@index([countryId]); @@map("realm_claims") }`.
`wikiSource`/`wikiPageTitle`/`mapLayerFeatureId` are for Phase 2 targets; Phase 1 only claims existing countries.

Module `src/server/modules/realms/realms.claims.ts`:
- `claimCountry(userId, countryId)`: country must exist and be unowned; no other pending claim by this user
  for this country; cap (I2) must allow it. **Auto-approve** if the user has a *verified* `WikiAccountLink`
  for `country.wikiSource ?? "ixwiki"` whose username equals the creator (first revision author) of
  `country.wikiPageTitle ?? country.name` on that wiki. Otherwise `pending`. Wiki lookup failure ⇒ `pending`
  (never an error, never an approval).
- `reviewClaim(reviewer, claimId, { approve, reason? })`: requires `canModerateRealm(reviewer, claim.realmId)`;
  approving re-checks "still unowned" and the cap inside the transaction (a lost race ⇒ auto-reject with reason);
  rejection requires a reason.
- Approval (auto or manual) runs the side effects `linkCountry` runs today: `assignNation`, the
  "Country Assigned" notification, the one-time new-player bonus, `user_profile` cache delete.
- `realms.access.ts`: `canModerateRealm(user, realmId)` = site admin ∨ `realm.ownerId === user.id`.
  IxWorld's owner is `"system"`, so IxWorld claims are reviewed by site admins.
- `realms.settings.ts`: `realmSettings(realm)` parses `Realm.settings` JSON with zod →
  `{ maxNationsPerUser: number }` (default 1). `yearOffset` is added in Phase 2 when something reads it.

Router: `studio` is renamed **`realms`** (`routers/realms/`), mounted directly (no single-child
`mergeRouters`): existing `adminListRealms`, `adminUpdateRealm`, `adminListUsers`; new `getBySlug` (public),
`claimCountry`, `myClaims`, `listClaims` + `reviewClaim` (moderators). `adminListWorldConfigs` /
`adminUpdateWorldConfig` are deleted with `WorldConfig`.
`users.linkCountry` is **removed**; `src/app/setup/page.tsx` calls `realms.claimCountry` and shows a
"claim submitted — awaiting review" state when the result is `pending`. `users.createCountry` stays direct
(create freely) but writes ownership through `assignNation`.
Admin UI: `/admin/realms` gains a **Claims** tab (pending list, approve, reject-with-reason).

## §4 Realm schema cleanup

- `Country.name`: `@unique` → `@@unique([realmId, name])`. `Country.slug` stays globally `@unique`
  (the collision suffix is Phase 2 — IxWorld cannot collide with itself).
- `MapLayer`, `TransportRoute`, `SharedVertex`: field `worldId` → `realmId String @default("default") @map("worldId")`
  (Prisma-level rename, **no column change**), code references renamed (`geo/editor/{borders,procedural}.ts`,
  `transport/routeQueries.ts`, `lib/maps/pipeline/enrichment-pipeline.ts`). tRPC input names follow.
- IxWorld realm row: slug `default` → **`ixworld`** (data, via the backfill script). `realmOf()` in
  `identity.mappers.ts` uses the always-selected `country.realm` — the "IxEarth"/"Custom Realm" fallbacks and
  `MidRibbonPassportDocument`'s "IxEarth" default go.
- `Realm.visibility`: default `"private"` → `"unlisted"`; allowed values `public | unlisted` (decision 19).
  `getBySlug` serves both; `private` rows (none exist) are treated as `unlisted` by the backfill.
- `User.lastSeenAt DateTime?` written by `authMiddleware` fire-and-forget, at most once per 24 h per user
  (feeds Phase 4 succession).

## §5 Deletions, docs, rollout

Delete (all verified zero-caller or replaced above):
- Clerk-Organization realm UI: `src/app/realms/new/`, `src/app/r/[realm]/settings/`,
  `components/halo/views/settings/InlineRealmSwitcher.tsx` (+ its `SettingsView` mount), the Clerk-membership
  "Realms" group in `AccountIdentityPanel.tsx`.
- `src/app/r/[realm]/page.tsx`: static cards and the dead `/maps?realm=` link go; the page resolves the
  Prisma realm via `realms.getBySlug` and lists its name, description and nations (links to `/countries/[slug]`).
  A fuller hub is Phase 2. Unknown slug ⇒ `notFound()`.
- `WorldConfig` model + `Realm.worldConfig` relation, `admin/realms/_components/WorldConfigsTab.tsx`,
  `loadWorldConfig` / `loadWorldConfigFromDB` / `IXWORLD_DEFAULTS` / `WorldMapConfig` in `lib/maps/map-config.ts`
  (0 external callers).
- `lib/maps/pipeline/realm-map-committer.ts` + its barrel export + its entry in
  `src/tests/server/country-baseline-ixtime.test.ts` (the live path is `geoEditor.importPipelineResult`).
- The mock "Realm Admin Review Queue"/claim form in `components/maps/pipeline/MapPipelineControls.tsx`.
- `TerritoryClaim` (replaced by `RealmClaim`).

Docs: `docs/architecture/realms-framework-spec.md` rewritten (done); fix `docs/systems/ixtime.md:76`
(no per-realm clocks — shared clock + display offset), `docs/systems/maps.md:121` (dead `FRAMEWORK_SPEC.md`
link), realm mentions in `docs/README.md`; add the backfill script to `scripts/README.md`.

Backfill script `scripts/realms/backfill-foundation.ts` (dry-run by default, `--apply` to write, idempotent):
1. `Country.ownerUserId` from users whose `countryId` points at it: exactly one user ⇒ owner; several ⇒ the
   single non-system-owner; otherwise **report the collision and skip** (owner decides by hand).
2. `realms` row `id = "default"`: `slug = "ixworld"`.
3. `WikiAccountLink(source "ixwiki", verifiedAt null)` for every `User.wikiUsername`.
4. `realms.visibility = 'private'` ⇒ `'unlisted'`.

Rollout (owner runs; agents never touch a database):
1. Verify `DATABASE_URL` target, then `bun run db:push:force` — **destructive parts:** drops
   `world_configs` (1 row) and `territory_claims` (0 rows); swaps the `Country.name` unique index.
2. `bun scripts/realms/backfill-foundation.ts` (dry run) → resolve collisions → `--apply`.
3. Deploy code. Dev first, then prod, same order.

## Testing

Jest (`--maxWorkers=1`), Prisma mocked per repo convention:
- ownership: assign/release keep I1; cap refusal (I2); refusing an owned country.
- claims: auto-approve on verified creator match; pending on mismatch, unverified link, or wiki failure;
  review requires `canModerateRealm`; approval re-checks ownership (race ⇒ reject); side effects called once.
- wiki verification: token issued/expired/mismatched; verified link blocks other users; ixwiki write-through;
  username normalisation.
- `realmSettings` defaults; `realmOf` with the realm relation.
- backfill: collision reported, single owner assigned, idempotent second run.
Gates (coordinator, sequential, after clearing `.next/cache/tsbuildinfo.*`): `typecheck:server`,
`typecheck:trpc`, `typecheck:ui`, `typecheck:db`, touched Jest suites, `bun run lint`. No builds.
