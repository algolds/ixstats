# Eurth Onboarding Runbook

**Last updated:** 2026-10-07

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

There is no undo short of a DB restore — take a backup first. `bun run db:backup` dumps the Docker
container (`pg_dump -Fc`) to `backups/ixstats-<UTC timestamp>.dump`; `bun run db:restore` restores one
(see [deployment.md](../operations/deployment.md#backups-and-restore)):

```bash
bun run db:backup
```

Prisma asks you to confirm the data-loss warnings (the `world_configs` drop and the two new unique
constraints) — answer yes.

### 1.3 Backfill — dry run

```bash
bun scripts/realms/backfill-foundation.ts
```

Before it reads anything else, the script checks that the IxWorld realm row (`id = "default"`) exists; if
it doesn't, it stops with `realms row id="default" (IxWorld) is missing — …` and exits non-zero **before
writing anything** (with or without `--apply`). Create that row first — `Country.realmId` depends on it.

The first line is `DRY RUN — pass --apply to write`; the second is `IxWorld realm ownerId: <id>`, which
must read `system` (IxWorld has no player owner — site admins moderate its claims). Read all five sections
that follow before doing anything else:

1. **Owners** — `owners: <n> to assign, <n> collisions`: `Country.ownerUserId` derived from
   `User.countryId`. Any `  COLLISION <countryId>: users <id>, <id> — resolve by hand` line means two-plus
   users point at the same country — the script will **not** guess; you must resolve it by hand (pick the
   real owner and null out the others' `User.countryId`, or reassign them) before applying.
   Right after this section, one `  BLOCKS --apply: …` line appears per blocker — owner collisions left, or
   an IxWorld ownerId other than `system`. While any is printed, `--apply` refuses (see 1.4).
2. **IxWorld realm slug** — `IxWorld slug: default → ixworld` (the current slug, then the new one).
3. **Visibility** — `private realms → unlisted: <n>`: `private` realms that will flip to `unlisted`
   (private is no longer a valid value).
4. **Wiki links** — `ixwiki links to record (unverified): <n>`: legacy `User.wikiUsername` rows that
   will become **unverified** `ixwiki` `WikiAccountLink` rows (players re-verify later from Settings).
5. **Map layers** — `map layers with no realm → IxWorld: N (M clash with an IxWorld feature, D keys held
   by more than one of them)`, then one `  DUPLICATE <layerType>/<featureId>: <id>, <id>` line per
   duplicated key. Compare `N` to your 1.1 baseline. `M` counts NULL-realm rows whose
   `(layerType, featureId)` IxWorld already has; `D` counts keys shared by two or more NULL-realm rows.
   Either would break the realm-scoped unique key, so if `M > 0` or `D > 0`, `--apply` **skips this step**
   (no rows are moved) and prints `  SKIPPED — resolve the clashing/duplicate rows by hand (deactivate or
   delete the NULL duplicates), then re-run`. Deactivate or delete the offending NULL-realm rows (the
   `DUPLICATE` lines list their ids), then re-run the dry run until `M = 0` and `D = 0`.

### 1.4 Resolve collisions, then apply

Once owner collisions are resolved, the IxWorld ownerId reads `system`, and map-layer clashes and
duplicates are both `0`:

```bash
bun scripts/realms/backfill-foundation.ts --apply
```

`--apply` refuses while any `BLOCKS --apply` line is printed: it prints the blockers, then
`Refusing --apply: nothing was written. Resolve the blockers above, then re-run.`, and exits `1` before
any write. Fix what the lines name and re-run the dry run first.

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

**Re-run the backfill dry run after deploy** (`bun scripts/realms/backfill-foundation.ts`, no `--apply`):
expect `owners: 0 to assign, 0 collisions` and no `BLOCKS --apply` line. Anything else means a player
linked a nation between the backfill and the deploy — resolve it as in 1.3–1.4 and apply again.

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
  The proxy allows about 100 requests a minute and one crawl of Eurth uses about 110, so **wait a minute
  between the dry run and `--apply`** (an HTTP 429 means just that; nothing is written, retry).

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
  nation: <every nation title, A–Z, one per line>
WARNING: <M> roster titles not among the crawled pages (indexed anyway; ...)
  not crawled: <title>
WARNING: <S> roster entries look like a subcategory of pages rather than a nation (kept; ...)
  suspect: <title>
stale rows no longer in the index: <n> would stay (pass --prune to delete), <n> kept (claimed or founded)
  stale: <title>
```

The dry run lists **every** nation, so read the whole list. The two `WARNING` blocks and the `stale rows`
block only appear when they have something to say.

Live read-only checks on 2026-09-28 found `C` = 2746 crawled pages in `K` = 49 categories, not truncated,
in about 25 s, and `N` = 100 roster nations. `P` can be a little higher than `C`: roster nation titles the
crawl missed are added to the index. Each of those titles is printed as `not crawled`: check that
each is a live nation page (not a redirect, a renamed page or a typo in the roster) before applying.

A `suspect` line is a roster entry whose title has a word like `Category`, `templates`, `maps`, `flags`,
`cities`, `people` or `history`, so it may be a subcategory of pages rather than a nation. It is only a
warning: the entry is still indexed as a nation. If it really is not a nation, remove it from the roster
category on iiwiki and run the dry run again.

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
else) in one transaction. Re-running the import later (e.g. iiwiki adds pages) adds new pages, updates
kinds, and only removes stale pages with `--prune`:

- Without `--prune`, a page that is no longer in the index (deleted or moved out of the category tree) keeps
  its row. The dry run lists these as `stale`.
- With `--prune`, those rows are deleted, except a page with a pending or approved claim, or a page that
  already has a Country in the realm. Those are listed as `stale, kept` and never deleted. Run the dry run
  with `--prune` first to see what would go.

A nation page with a pending or approved claim, or with a Country in the realm (claimed, or created unclaimed by
the source sync in step 4), stays `kind: "nation"` even when the roster stops listing it: the apply prints
`kept as nation (claimed or founded): <titles>` instead of turning it into lore. Re-running is safe once claiming
has started.

### 3.3 What a claim's new nation starts with

When a claim on a nation page is approved, the new country is prefilled from the page's infobox: population,
GDP per capita (or GDP divided by population), area, continent, government, leader (the head of state, else
the first leader listed), flag, coat of arms, and national identity (official name, capital, motto, currency,
languages and so on). Flags and coats of arms are stored as IxStats media proxy paths
(`/api/mediawiki/iiwiki/wiki/Special:FilePath/<file>`). GDP figures may carry a currency symbol or code
(`$`, `€`, `US$`, `Int$`, `USD`) and a magnitude (`billion`, `trillion`, `bn`, `tn`). A figure that cannot
be read, or a GDP per capita under $100, falls back to the baseline default instead of founding a near-zero
economy.

---

## 4. Bring in the community map (source sync)

Eurth's nation list is the **union** of the IIWiki roster (step 3) and the community map's nation list
(`a-seth-harrison/eurth-map`, about 130 nations, some with no IIWiki page yet). The source sync creates every one of
them up front as a real, **unclaimed** Country of the realm (`ownerUserId` empty), with figures, continent,
borders and alliances, and keeps them in step on a schedule. Players then claim the existing nations.

**Precedence for a new nation's figures:** the map's figures (forum-checked by its maintainer), then the nation's
IIWiki infobox, then the baseline defaults. Stated land area wins; the map's traced area is used only when the map
states none. Flag, coat of arms, leader and identity come from the infobox.

Nothing about Eurth is built in: the repository, ref, file paths, field names, wiki link prefixes, alliance type
rules, attribution line, options and continent table all live in the realm's own sync settings. Eurth's values ship
as the **`eurth-map` preset** (`src/lib/realms/sources/presets/eurth-map.json`); loading it fills the settings once,
and from then on the realm's settings are the only source of truth.

### 4.1 Configure

Either in `/admin/realms` → **Source sync** tab → realm `Eurth`, or (the founder, once Eurth has one) in
`/r/eurth/manage` → **Source sync**:

1. **Preset** → `Eurth community map` → **Load preset**. This fills the repository (`a-seth-harrison/eurth-map`,
   branch `main`), the format (`eurth-map`), the source settings (file paths
   `eurth-map/src/data/nations.js`, `eurth-map/src/data/organizations.js`, `eurth-map/public/nations.geojson`;
   field names; IIWiki link prefixes; alliance type rules; the attribution
   `Map: Eurth community, via eurth-map by Seth Harrison`), the options and the continent table (a first guess for
   115 nations; the other 16 are left unknown).
2. Check the **continent table** and correct any guess (free text, no fixed list), then **Save source sync**.

From the command line instead (same result):

```bash
bun scripts/realms/sync-realm-source.ts --realm eurth --preset eurth-map          # loads the preset, then dry-runs
bun scripts/realms/sync-realm-source.ts --realm eurth --configure --ref main       # change repo/ref/format later
```

### 4.2 Options

| Option | Default | What it does |
|---|---|---|
| Add new nations | on | Creates unclaimed nations for map entries no nation matches |
| Add roster nations | on | Creates unclaimed nations for roster pages the map does not list (from their infobox) |
| Read new nations' wiki infobox | on | Fills what the map lacks, plus flag, arms, leader, identity; one page at a time, paced, 8 s each |
| Update unclaimed nations | on | Keeps unclaimed nations' population, GDP per capita, land area, capital, official name, continent in step |
| Update claimed nations too | **off** | Overwrites players' own figures with the map's. Leave off unless Eurth asks for it |
| Update borders | on | Writes the map's borders into Eurth's map (keyed by the map's nation key) and links them |
| Sync alliances | on | Creates the map's organisations as Eurth alliances and adds their listed nations as members |
| Apply continents | on | Sets nations' continents from the continent table |
| List nations the source no longer has | on | Lists them in the run's diff. A sync never deletes a nation |

A sync never deletes a nation, never removes an alliance member and never changes who owns a claimed nation.

### 4.3 Dry run, decide, apply

1. **Dry run** (settings page, or `bun scripts/realms/sync-realm-source.ts --realm eurth`). Read the diff: new
   nations (unclaimed), figure changes, claimed nations left alone, borders, alliances (with the type the name rules
   gave: Treaty, Pact, Defence or Security → military; Economic → economic; else political), nations no longer in
   the map, and **Left to you**: entries whose name matches more than one nation, or a nation another entry also
   matches. Nothing is guessed.
2. **Decide** on each entry left to you: **Match to a nation** (a manual match), or **Exclude** the map key. On
   figure changes, **Pin current value** keeps a field as it is on that nation forever (the sync never overwrites a
   pinned field). Alliance types can be changed in the diff. Decisions are kept in the realm's settings and listed
   under **Your decisions** (clear one there). Dry-run again until the diff reads right.
3. **Apply** (settings page: it runs in the background and appears in the run history; or the script with
   `--apply`). Expect on prod about **130 nations** created unclaimed (the map's 130, matched to the roster where
   they overlap, plus any roster-only pages), **115 borders**, **8 alliances** with their members.
4. Check `/r/eurth` → **Nations**: every nation listed, unclaimed ones badged **Unclaimed** with **Claim**;
   `/maps?realm=eurth` shows the borders and the attribution line; a nation's page shows **Unclaimed** and
   **Claim this nation**.

The local end-to-end rehearsal (2026-10-07, real GitHub source, a simulated 107-page roster with one claimed nation)
created 132 nations (129 from the map plus 3 roster-only pages), matched 1, left the claimed nation's figures
alone, wrote and linked 115 borders (PostGIS geometry and areas filled by the writer, 76 with neighbours), created
8 alliances with 54 members alongside an IxWorld alliance of the same name, and a second dry run showed no changes.
IIWiki refuses requests from outside production (HTTP 403), so every infobox read fell back: all 132 new nations
were still created from the map's figures (defaults where the map has none) and listed under "wiki infobox gave
nothing (re-run to retry)". On production the reads succeed; re-run the apply to fill any that failed.

### 4.4 Schedule

Pick **Manual only**, every 6 or 12 hours, daily, weekly or a custom number of hours, and switch **Run on the
schedule** on. The `realm-source-sync` cron job (add it to `CRON_ENABLED_JOBS`; it runs hourly at minute 37) runs
every realm whose interval has passed since its last applied run, one realm at a time. Each realm's run holds the
lease `realm-source-sync:<realmId>`, so a scheduled run, an admin's apply and the script never overlap (the second
one is recorded as failed: "Another run of this realm's sync is in progress"). A failed applied run still moves the
schedule on, so a broken source is retried at the next interval, not every hour.

### 4.5 Claims on synced nations

- A claim on an unclaimed nation hands the existing Country to the claimant. Its IIWiki infobox then fills only
  what is still empty (flag, coat of arms, leader, identity fields); the map's figures stay.
- A claim filed on a roster page before the sync, and approved after it, takes the synced nation instead of
  creating a second one.
- A nation only on the map (no IIWiki page, so no `wikiSource`) can be claimed but always goes to **manual review**:
  there is no page creator to prove.

---

## 5. Onboard Eurth players

**Before players arrive, set up the region page.** The founder (or a site admin, while Eurth is staff-administered,
or an officer with the `appearance` power) opens `/r/eurth/manage` and fills in:

- **Links:** Eurth's forum, Discord invite, wiki portal and map (up to 8, `https://` only). They appear in the
  **Community** panel of `/r/eurth`.
- **Rules:** the community's rules. They get a **Rules** tab, and every claim in Eurth asks the player to tick
  **I have read the realm's rules** first (the server refuses a claim without it).
- **In-world date:** Eurth's calendar label for the header, either fixed ("14 Harvest 1203 AE", update it as the
  story moves) or the real year plus an offset with an era. Display only; the simulation stays on IxTime.

Tell players, in order:

1. **Verify your IIWiki account.** In IxStats: `/settings` → **IxnayID & Passport** section → **Linked
   Accounts** → Manage → the **IIWiki** row → enter your iiwiki username → **Get code**. Paste the shown
   token anywhere on your own `User:<YourName>` page on iiwiki **while logged in as that account**, save
   it, then come back and press **Verify**. The code is valid for 24 hours.
2. **Claim your nation.** Go to `/r/eurth` → **Nations** → find your nation (badged **Unclaimed**) →
   **Claim**, or **Claim this nation** on its country page. Roster pages without a nation yet are listed under
   **Claimable nations**.
   - If you are the verified creator of that nation's iiwiki page, the claim is **approved instantly** —
     the nation (synced, or created now for a roster page) is assigned to you.
   - Otherwise the claim goes to **pending**; a site admin reviews it in `/admin/realms` → **Claims**. A
     nation only on the community map has no IIWiki page to prove, so its claim is always reviewed.
     Each nation-page claim there has a **Page history** link to the page's history on iiwiki; its first
     entry is the page's creator.
   - When the nation's page is a redirect, the creator check uses the page it redirects to.

Default cap is **one nation per player per realm**. A site admin can raise it (1–20) in `/admin/realms` →
**Realms** tab → the realm's pencil (edit) button → **Nations per player** → the check (save) button. It is
stored as `Realm.settings.maxNationsPerUser`; other keys in `Realm.settings` are kept.

Eurth's lore reads live inside WikiOS at `/wiki/<Title>?source=iiwiki` (read-only — edit/history/talk
links point at iiwiki, not IxStats). The realm hub (`/r/eurth`) links to the lore portal, the country
directory (`/countries?realm=eurth`), and the map (`/maps?realm=eurth`).

---

## 6. Optional: a map from an image (when a realm has no source)

Eurth's borders come from the source sync (step 4). This step is for a realm whose map exists only as an image.
Without either, `/maps?realm=<realm>` is empty, which is **expected**.

> **Warning — don't use Quick Update for Eurth.** The Import Pipeline tab opens in **Quick Update** mode,
> and Quick Update always writes **IxWorld's** map — an Eurth SVG applied there replaces that layer of
> IxWorld's map. Only **Full Pipeline** has a **Target realm** setting.

1. Obtain a **flat-colour political map** of Eurth as a **PNG** (JPEG is accepted, but compression noise
   adds stray colours): one solid colour per nation, equirectangular projection, at most **25 MB** and
   **64 megapixels** (8192×8192). Hand-drawn or textured maps vectorise poorly — it must be flat colour.
   Colours covering less than 0.01% of the image are dropped as noise. A file that isn't a readable
   image, or is over the pixel limit, is refused with the reason ("The map image could not be read …").
2. `/admin/maps` → **Import Pipeline** tab → switch from **Quick Update** to **Full Pipeline** → set
   **Target realm** to `Eurth` → **Choose File** (the PNG) → **Analyse colours**. This only counts the
   map's colours (nothing is traced yet, so it is quick even for a large map) and lists them, largest
   first, each with its swatch, hex and share of the map.
3. **Map colours → nations.** For each colour, pick its nation in the searchable box — the list holds
   Eurth's existing countries plus the claimable nation pages of its lore index (step 3), and you can type
   a name that isn't listed. Tick **Ignore** for the ocean and any other background colour. The summary
   under the list counts the **unmapped colours that will be dropped** from the map; a nation can hold
   only one colour (the wizard won't continue while a nation has two — merge them in the image first).
4. **Vectorise N mapped colours** → each mapped colour is traced into one political region whose feature
   id is the nation's name (only now is anything traced; the import stores each region's centroid,
   bounding box and approximate area alongside its outline) → check the feature counts and any warnings/validation errors → **Proceed to
   Import** → check that the confirmation reads "Ready to import … features into **Eurth**" → **Import
   to Database**. The import merges into Eurth's map only; an unknown target realm is refused.
   - The tracer is the `potrace` package (a dependency since E8 — `bun install` brings it). It is loaded
     at run time from the `node_modules` of the directory the server was started in. If the **Pipeline
     Log** shows `ERROR potrace could not be loaded, no region was traced: <reason>`, no regions are
     produced: run `bun install` in that directory and restart. A single `ERROR tracing #rrggbb: …` line
     means only that colour failed.
5. **Regions become nations' territory:**
   - **Nations claimed after the import take their region automatically.** When a nation-page claim is
     approved (instantly or by review), the new country is linked to Eurth's unlinked political region
     whose feature id (or display name) equals the nation's title, and the country takes the region's
     outline, centroid, bounding box and land area, in the same transaction as the claim. A value the
     region doesn't have never clears the country's own (its baseline land area stays). No region of
     that name → the claim still goes through, unlinked. The public map can take up to 15 minutes (its political-layer cache) to
     show the new owner.
   - **Nations that already existed** when you imported, and regions whose names don't match a title
     exactly, are linked in the world editor: `/admin/maps/editor?realm=eurth` → **Links** tab →
     **Auto-Match by Name**, then link any leftovers by hand.

Eurth's map is fully isolated from IxWorld's — features are keyed per-realm
(`(realmId, layerType, featureId)`), so nothing you draw here touches IxWorld's map or vice versa.

---

## 7. Known limits (tell players/admins up front)

- **Lore availability is tied to iiwiki.** Eurth's lore renders live from iiwiki on every read — if iiwiki
  is down or Cloudflare-challenges the request, Eurth's lore pages are down too. This is not an IxStats
  outage.
- **Eurth's stat caps aren't enforced.** Eurth's "Starting Stats v6.1" house rules are not encoded anywhere
  — new Eurth nations run the identical simulation as every other realm (decision 17: one sim, no per-realm
  presets). If Eurth wants caps enforced, that's a future feature, not a config flag today.
- **A second nation doesn't take over.** A player who already plays a nation (say in IxWorld) keeps
  acting as it after their Eurth claim is approved; they switch with **Play as <nation>** next to their
  nation on `/r/eurth` (and back the same way on `/r/ixworld`). The active one shows **Active**.
- **No founder account yet.** The realm's `ownerId` is `"system"` until an Eurth admin is handed the
  realm; until then, site admins are the only ones who can act on Eurth's claims.
- **Not shipped yet** (later phases, don't promise these): a public founding application form, founder
  removal/succession tooling
  (including a founder raising their own realm's nation cap — today only site admins can, in
  `/admin/realms`), and realm-scoped dashboard feed and trending. Shipped since: a realm filter on the ThinkPages
  feed and the realm board at `/r/eurth/board`, and a nation switcher in the nav and on the passport (alongside
  **Play as** on the realm page), and the region page's links, rules and in-world date (§5), and the source sync (§4).

---

## Quick reference

| Need to… | Do this |
|---|---|
| Check for unresolved owner collisions or map-layer clashes/duplicates | Re-run `bun scripts/realms/backfill-foundation.ts` (no `--apply`) |
| Re-import Eurth's lore after iiwiki changes | Re-run the step 3 command with `--apply` (claimed and synced nation pages stay nations) |
| Sync Eurth's nations, borders and alliances from the community map | `/admin/realms` → Source sync → Dry run → Apply, or `bun scripts/realms/sync-realm-source.ts --realm eurth [--apply]` |
| Correct a continent, exclude or match a map entry, pin a field | `/admin/realms` → Source sync (or `/r/eurth/manage` → Source sync): continent table, the diff's buttons |
| See Eurth's realm row / edit name, description, visibility, status, nations per player | `/admin/realms` → Realms tab → pencil |
| Import a realm map from an image (no source) | `/admin/maps` → Import Pipeline → **Full Pipeline** → Target realm (never Quick Update) |
| Review or approve/reject a pending nation claim | `/admin/realms` → Claims tab |
| See who owns what in Eurth | `/admin/realms` → User Access tab, or `/countries?realm=eurth` |
