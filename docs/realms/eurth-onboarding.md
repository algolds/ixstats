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

Before it reads anything else, the script checks that the IxWorld realm row (`id = "default"`) exists; if
it doesn't, it stops with `realms row id="default" (IxWorld) is missing — …` and exits non-zero **before
writing anything** (with or without `--apply`). Create that row first — `Country.realmId` depends on it.

The first line is `DRY RUN — pass --apply to write`. Read all five sections that follow before doing
anything else:

1. **Owners** — `owners: <n> to assign, <n> collisions`: `Country.ownerUserId` derived from
   `User.countryId`. Any `  COLLISION <countryId>: users <id>, <id> — resolve by hand` line means two-plus
   users point at the same country — the script will **not** guess; you must resolve it by hand (pick the
   real owner and null out the others' `User.countryId`, or reassign them) before applying.
2. **IxWorld realm slug** — `IxWorld slug: default → ixworld` (the current slug, then the new one).
3. **Wiki links** — `ixwiki links to record (unverified): <n>`: legacy `User.wikiUsername` rows that
   will become **unverified** `ixwiki` `WikiAccountLink` rows (players re-verify later from Settings).
4. **Visibility** — `private realms → unlisted: <n>`: `private` realms that will flip to `unlisted`
   (private is no longer a valid value).
5. **Map layers** — `map layers with no realm → IxWorld: N (M clash with an IxWorld feature, D keys held
   by more than one of them)`, then one `  DUPLICATE <layerType>/<featureId>: <id>, <id>` line per
   duplicated key. Compare `N` to your 1.1 baseline. `M` counts NULL-realm rows whose
   `(layerType, featureId)` IxWorld already has; `D` counts keys shared by two or more NULL-realm rows.
   Either would break the realm-scoped unique key, so if `M > 0` or `D > 0`, `--apply` **skips this step**
   (no rows are moved) and prints `  SKIPPED — resolve the clashing/duplicate rows by hand (deactivate or
   delete the NULL duplicates), then re-run`. Deactivate or delete the offending NULL-realm rows (the
   `DUPLICATE` lines list their ids), then re-run the dry run until `M = 0` and `D = 0`.

### 1.4 Resolve collisions, then apply

Once owner collisions are resolved and map-layer clashes and duplicates are both `0`:

```bash
bun scripts/realms/backfill-foundation.ts --apply
```

Re-run the dry run afterward (omit `--apply`) as a sanity check — it should report
`owners: 0 to assign, 0 collisions`, `IxWorld slug: ixworld → ixworld`, `private realms → unlisted: 0` and
`map layers with no realm → IxWorld: 0 (0 clash with an IxWorld feature, 0 keys held by more than one of
them)`. The wiki-link count stays above `0` only for users whose legacy username duplicated another's
(`--apply` printed a `  skip <userId>: …` line for each; they re-verify from Settings).

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

Check the printed counts before applying. The output has this shape (placeholders in `<>`):

```
DRY RUN — pass --apply to write
realm Eurth (<realm id>) ← iiwiki
pages <P> (crawled <C>), nations <N>, categories <K>, truncated no
nation method: roster Category:Countries (Eurth)
  nation: <first 20 nation titles, A–Z, one per line>
```

Live read-only checks on 2026-09-28 found `C` = 2746 crawled pages in `K` = 49 categories, not truncated,
in about 25 s, and `N` = 100 roster nations. `P` can be a little higher than `C`: roster nation titles the
crawl missed are added to the index.

If `truncated yes` appears, the crawl hit the 5,000-page / depth-5 cap — that would be unusual for Eurth;
investigate before applying (a runaway category, not expected here).

**Never** pass `Category:Retired countries (Eurth)` as `--nation-roster` — the script refuses a retired
roster outright (retired nations aren't claimable).

### 3.2 Apply

Same command, plus `--apply` (it prints the same lines, then `written: <n> new rows, <n> → nation, <n> →
lore`):

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

Default cap is **one nation per player per realm**. A site admin can raise it (1–20) in `/admin/realms` →
**Realms** tab → the realm's pencil (edit) button → **Nations per player** → the check (save) button. It is
stored as `Realm.settings.maxNationsPerUser`; other keys in `Realm.settings` are kept.

Eurth's lore reads live inside WikiOS at `/wiki/<Title>?source=iiwiki` (read-only — edit/history/talk
links point at iiwiki, not IxStats). The realm hub (`/r/eurth`) links to the lore portal, the country
directory (`/countries?realm=eurth`), and the map (`/maps?realm=eurth`).

---

## 5. Optional: give Eurth a map

Without this, `/maps?realm=eurth` is empty — **expected**, not a bug, until you do this step.

> **Warning — don't use Quick Update for Eurth.** The Import Pipeline tab opens in **Quick Update** mode,
> and Quick Update always writes **IxWorld's** map — an Eurth SVG applied there replaces that layer of
> IxWorld's map. Only **Full Pipeline** has a **Target realm** setting.

1. Obtain a **flat-colour political map** of Eurth as a **PNG** (JPEG is accepted, but compression noise
   adds stray colours): one solid colour per nation, equirectangular projection, at most **25 MB**.
   Hand-drawn or textured maps vectorise poorly — it must be flat colour. Colours covering less than
   0.01% of the image are dropped as noise.
2. `/admin/maps` → **Import Pipeline** tab → switch from **Quick Update** to **Full Pipeline** → set
   **Target realm** to `Eurth` → **Choose File** (the PNG) → **Analyse colours**. The pipeline lists the
   map's colours, largest first, each with its swatch, hex and share of the map.
3. **Map colours → nations.** For each colour, pick its nation in the searchable box — the list holds
   Eurth's existing countries plus the claimable nation pages of its lore index (step 3), and you can type
   a name that isn't listed. Tick **Ignore** for the ocean and any other background colour. The summary
   under the list counts the **unmapped colours that will be dropped** from the map; a nation can hold
   only one colour (the wizard won't continue while a nation has two — merge them in the image first).
4. **Vectorise N mapped colours** → each mapped colour is traced into one political region whose feature
   id is the nation's name → check the feature counts and any warnings/validation errors → **Proceed to
   Import** → check that the confirmation reads "Ready to import … features into **Eurth**" → **Import
   to Database**. The import merges into Eurth's map only; an unknown target realm is refused.
   - The tracer is the optional `potrace` package. If the **Pipeline Log** shows `potrace not available`
     for every colour, the server doesn't have it installed and no regions are produced — install it
     before retrying.
5. **Regions become nations' territory:**
   - **Nations claimed after the import take their region automatically.** When a nation-page claim is
     approved (instantly or by review), the new country is linked to Eurth's unlinked political region
     whose feature id (or display name) equals the nation's title, and the country's geometry and land
     area are synced, in the same transaction as the claim. No region of that name → the claim still
     goes through, unlinked. The public map can take up to 15 minutes (its political-layer cache) to
     show the new owner.
   - **Nations that already existed** when you imported, and regions whose names don't match a title
     exactly, are linked in the world editor: `/admin/maps/editor?realm=eurth` → **Links** tab →
     **Auto-Match by Name**, then link any leftovers by hand.

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
- **Not shipped yet** (later phases, don't promise these): a public founding application form, the
  per-realm calendar label (not implemented yet — planned), founder moderation/removal/succession tooling
  (including a founder raising their own realm's nation cap — today only site admins can, in
  `/admin/realms`), a per-realm ThinkPages feed, and the passport realm/nation switcher.

---

## Quick reference

| Need to… | Do this |
|---|---|
| Check for unresolved owner collisions or map-layer clashes/duplicates | Re-run `bun scripts/realms/backfill-foundation.ts` (no `--apply`) |
| Re-import Eurth's lore after iiwiki changes | Re-run the step 3 command with `--apply` (safe, but see the re-run caveat in 3.2) |
| See Eurth's realm row / edit name, description, visibility, status, nations per player | `/admin/realms` → Realms tab → pencil |
| Import or update Eurth's map | `/admin/maps` → Import Pipeline → **Full Pipeline** → Target realm `Eurth` (never Quick Update) |
| Review or approve/reject a pending nation claim | `/admin/realms` → Claims tab |
| See who owns what in Eurth | `/admin/realms` → User Access tab, or `/countries?realm=eurth` |
