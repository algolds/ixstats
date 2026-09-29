# Eurth Onboarding Runbook

**Audience:** the site admin deploying the Realms feature and bringing up Eurth, the first realm outside
IxWorld. Exact commands, no fluff. Background/decisions: [`docs/architecture/realms-framework-spec.md`](../architecture/realms-framework-spec.md).

Run every step against **dev first**. Only repeat the full sequence against **prod** once dev looks right.

---

## 1. Deploy the Realms schema + backfill

### 1.1 Preflight (before touching anything)

Record a baseline count of map layers that currently have no realm, straight from Postgres (the Prisma
field is `realmId`, but the underlying column is still named `worldId`):

```sql
SELECT count(*) FROM map_layers WHERE "worldId" IS NULL;
```

You'll compare this to what the backfill's step 5 reports below.

### 1.2 Push the schema

```bash
bun run db:push:force
```

This is destructive. It will:

- **Drop** `world_configs` (1 row today) and `territory_claims` (0 rows today).
- Swap `Country` name uniqueness from global to **per-realm** (`@@unique([realmId, name])`).
- Add `realm_pages`, `realm_claims`, `wiki_account_links` tables.
- Add `ownerUserId` and `lastSeenAt` columns.
- Change `MapLayer`'s unique key to `(worldId, layerType, featureId)` (per-realm map features).

There is no undo short of a DB restore — make sure you have a recent backup (`bun run db:backup`) before
running this against prod.

### 1.3 Backfill — dry run

```bash
bun scripts/realms/backfill-foundation.ts
```

Read all four sections of the output before doing anything else:

1. **Owners** — `Country.ownerUserId` derived from `User.countryId`. Any `COLLISION <countryId>: users
   <id>, <id>` line means two-plus users point at the same country — the script will **not** guess; you
   must resolve it by hand (pick the real owner and null out the others' `User.countryId`, or reassign
   them) before applying.
2. **IxWorld realm slug** — reports `default → ixworld`.
3. **Wiki links** — counts legacy `User.wikiUsername` rows that will become **unverified** `ixwiki`
   `WikiAccountLink` rows (players re-verify later from Settings).
4. **Visibility** — counts `private` realms that will flip to `unlisted` (private is no longer a valid
   value).
5. **Map layers** — `map layers with no realm → IxWorld: N (M clash with an IxWorld feature)`. Compare `N`
   to your 1.1 baseline. If `M > 0`, `--apply` will **skip this step** and print `SKIPPED — resolve the
   clashing rows by hand` — deactivate or delete the NULL-realm duplicates that collide with an existing
   IxWorld `(layerType, featureId)` pair, then re-run the dry run until `M = 0`.

### 1.4 Resolve collisions, then apply

Once owner collisions are resolved and map-layer clashes are `0`:

```bash
bun scripts/realms/backfill-foundation.ts --apply
```

Re-run the dry run afterward (omit `--apply`) as a sanity check — it should report `0` outstanding
collisions, clashes, and orphaned map layers.

### 1.5 Deploy the code

```bash
bun run deploy:prod     # prod — builds and restarts via PM2
# or, for a dev/staging box:
bun run deploy:local
```

If something is badly wrong after deploy, `bun run deploy:rollback` reverts to the previous release —
it does not revert the schema push, so only use it for a code-only regression.

---

## 2. Create the Eurth realm

In `/admin/realms` → **Realms** tab → **New realm**, fill in exactly:

| Field | Value |
|---|---|
| Name | `Eurth` |
| Slug | `eurth` |
| Description | `Realistic geofiction and political simulation, loosely based on NationStates. Lore on IIWiki (Portal:Eurth); community at eurth.org.` |
| Visibility | `public` |

The realm is created **active**, owned by `system` (shown as `system` in the Owner column). It stays that
way until an Eurth admin has their own IxStats account and is handed the realm — until then, **site
admins moderate Eurth's claims** from the Claims tab (step 4 below).

---

## 3. Import Eurth's lore index

This is a **one-time index import** — titles only, never page content. It must run somewhere iiwiki's
Cloudflare challenge lets the `IxStats-Builder` user agent through, which today is **only the production
server**.

- **On production:** run the command below directly.
- **From a dev machine:** iiwiki blocks it outright. Route through the production proxy first:
  ```bash
  export IIWIKI_DEV_PROXY_URL=https://maps.ixwiki.com/api/mediawiki/iiwiki/api.php
  ```

### 3.1 Dry run

```bash
bun scripts/realms/import-realm-lore.ts \
  --realm eurth --source iiwiki \
  --category "Category:Eurth" --keyword Eurth \
  --nation-roster "Category:Countries (Eurth)"
```

Check the printed counts before applying. A live dry run on 2026-09-28 crawled in ~25s and reported:

```
pages 2,746 (crawled 2,746), nations 100, categories 49, truncated no
nation method: roster Category:Countries (Eurth)
```

If `truncated yes` appears, the crawl hit the 5,000-page / depth-5 cap — that would be unusual for Eurth;
investigate before applying (a runaway category, not expected here).

**Never** pass `Category:Retired countries (Eurth)` as `--nation-roster` — the script refuses a retired
roster outright (retired nations aren't claimable).

### 3.2 Apply

Same command, plus `--apply`:

```bash
bun scripts/realms/import-realm-lore.ts \
  --realm eurth --source iiwiki \
  --category "Category:Eurth" --keyword Eurth \
  --nation-roster "Category:Countries (Eurth)" \
  --apply
```

This writes `RealmPage` rows (`kind: "nation"` for the ~100 roster nations, `kind: "lore"` for everything
else). Re-running the import later (e.g. iiwiki adds pages) is safe and idempotent — it upserts kinds and
skips duplicates — except that a page a player has already **claimed** will flip back to `kind: "lore"` if
it no longer matches; don't re-run casually once claiming has started.

---

## 4. Onboard Eurth players

Tell players, in order:

1. **Verify your IIWiki account.** In IxStats: `/settings` → **IxnayID & Passport** section → **Linked
   Accounts** → Manage → the **IIWiki** row → enter your iiwiki username → **Get code**. Paste the shown
   token anywhere on your own `User:<YourName>` page on iiwiki **while logged in as that account**, save
   it, then come back and press **Verify**. The code is valid for 24 hours.
2. **Claim your nation.** Go to `/r/eurth` → **Claimable nations** → find your nation → **Claim**.
   - If you are the verified creator of that nation's iiwiki page, the claim is **approved instantly** —
     the country is created in Eurth and assigned to you.
   - Otherwise the claim goes to **pending**; a site admin reviews it in `/admin/realms` → **Claims**.

Default cap is **one nation per player per realm**. Raising it (`Realm.settings.maxNationsPerUser`, 1–20)
has no admin UI yet — it takes a direct `Realm.settings` JSON edit in the database; there is no supported
way to do it from `/admin/realms` today.

Eurth's lore reads live inside WikiOS at `/wiki/<Title>?source=iiwiki` (read-only — edit/history/talk
links point at iiwiki, not IxStats). The realm hub (`/r/eurth`) links to the lore portal, the country
directory (`/countries?realm=eurth`), and the map (`/maps?realm=eurth`).

---

## 5. Optional: give Eurth a map

Without this, `/maps?realm=eurth` is empty — **expected**, not a bug, until you do this step.

1. Obtain a **flat-colour political PNG** of Eurth: one solid colour per nation, equirectangular
   projection. Hand-drawn or textured maps vectorise poorly — it must be flat colour.
2. `/admin/maps` → **Pipeline wizard** → set **Target realm** to `Eurth` → upload the PNG → step through
   detection/preview/import, mapping each detected colour to the matching Eurth nation.

Eurth's map is fully isolated from IxWorld's — features are keyed per-realm
(`(realmId, layerType, featureId)`), so nothing you draw here touches IxWorld's map or vice versa.

---

## 6. Known limits (tell players/admins up front)

- **Lore availability is tied to iiwiki.** Eurth's lore renders live from iiwiki on every read — if iiwiki
  is down or Cloudflare-challenges the request, Eurth's lore pages are down too. This is not an IxStats
  outage.
- **Eurth's stat caps aren't enforced.** Eurth's "Starting Stats v6.1" house rules are not encoded anywhere
  — new Eurth nations run the identical simulation as every other realm (decision 17: one sim, no per-realm
  presets). If Eurth wants caps enforced, that's a future feature, not a config flag today.
- **No founder account yet.** The realm's `ownerId` is `"system"` until an Eurth admin is handed the
  realm; until then, site admins are the only ones who can act on Eurth's claims.
- **Not shipped yet** (later phases, don't promise these): a public founding application form, a
  per-realm calendar label (`yearOffset` is stored but not surfaced), founder moderation/removal/
  succession tooling, a per-realm ThinkPages feed, and the passport realm/nation switcher.

---

## Quick reference

| Need to… | Do this |
|---|---|
| Check for unresolved owner collisions or map-layer clashes | Re-run `bun scripts/realms/backfill-foundation.ts` (no `--apply`) |
| Re-import Eurth's lore after iiwiki changes | Re-run the step 3 command with `--apply` (safe, but see the re-run caveat in 3.2) |
| See Eurth's realm row / edit name, description, visibility, status | `/admin/realms` → Realms tab |
| Review or approve/reject a pending nation claim | `/admin/realms` → Claims tab |
| See who owns what in Eurth | `/admin/realms` → User Access tab, or `/countries?realm=eurth` |
