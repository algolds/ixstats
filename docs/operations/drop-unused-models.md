# Dropping the unused Prisma models (D9)

**Last updated:** 2026-10-27
**Status:** Applied in the schema (decision D9 in [ROADMAP.md](../roadmap/ROADMAP.md#decisions-needed), owner
2026-10-27: "apply drop unused models"). Production drops the tables during the 1.5 deploy, in the deploy's own
`db push`. Run the read-only check in [section 3](#3-pre-window-check-b2-read-only) first.

The drop was prepared on 2026-10-06 (`chore/drop-unused-models`, 56 models and `CardPack.pdsConfig`) and re-verified
on 2026-10-27 against the merged tree, after the cards refresh, MyCountry, realm time, IxnayID, WikiOS and the
pre-production audit. None of the 56 had gained a reader or a writer. Seven of them and the column were already gone
(section 1.2), so this change removes the other **49 models**, the relation fields on kept models that pointed at
them, `prisma/schema/c15t.prisma`, and the `MediaType` enum (only `MediaTrack` used it).

---

## 1. What is dropped

Each model was searched on 2026-10-27 for:

- its Prisma accessor (`db.`, `tx.`, `prisma.`, `ctx.db.` and dynamic `db[...]` access);
- its model and table name in raw SQL, `$queryRaw`/`$executeRaw`, `prisma/manual-migrations/`, the
  `prisma/migrations/` files added since 2026-10-06, `scripts/` and the seeds;
- reads of the relation fields that point at it (`include`, `select`, `_count`) and nested writes;
- the generated types (`Prisma.<Model>…`, `import type { <Model> } from "@prisma/client"`).

Only the archived one-off scripts in `scripts/archive/` (excluded from typechecks and never run by the app) still
name a few of these models: `validate-production.ts` (`Archetype`), `migrate-messages-to-thinkshare.ts`
(`DiplomaticMessage`, the source of the finished ThinkShare migration), `enhance-altitude-metadata.ts`
(`ElevationZone`) and `migrate-routes-to-segments.ts` (the transport segment tables).

### 1.1 The 49 models

| Model                                                                                                             | Table                                                               | Why it is unused                                                                                               |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `subject`, `domain`, `consentPolicy`, `runtimePolicyDecision`, `consentPurpose`, `consent`                        | same as the model                                                   | c15t consent tables. The `@c15t/*` packages and routes were deleted earlier. The whole `c15t.prisma` file goes |
| `C15tAuditLog`                                                                                                    | `auditLog`                                                          | c15t audit log. **Not** the live `AuditLog` table: the names differ only in case                               |
| `private_c15t_settings`                                                                                           | `private_c15t_settings`                                             | c15t settings                                                                                                  |
| `Post`                                                                                                            | `Post`                                                              | Starter-template leftover; ThinkPages uses `ThinkpagesPost` and the forum `forum_posts`                        |
| `ScheduledChange`                                                                                                 | `ScheduledChange`                                                   | Its pipeline was deleted on 2026-10-06 (D11)                                                                   |
| `LogRetentionPolicy`                                                                                              | `LogRetentionPolicy`                                                | Never read or written                                                                                          |
| `EncryptionKey`, `EncryptionAuditLog`                                                                             | same as the model                                                   | No encryption feature uses them                                                                                |
| `CountryActivity`                                                                                                 | `CountryActivity`                                                   | Activity lives in `ActivityFeed`                                                                               |
| `ArchetypeCategory`, `Archetype`, `UserArchetypeSelection`, `CountryArchetypeMatch`                               | same as the model                                                   | Old archetype set; economic archetypes use `EconomicArchetype`                                                 |
| `DiplomaticRelationshipHistory`, `DiplomaticAction`, `DiplomaticMessage`, `EmbassyRequirement`                    | same as the model                                                   | Never read or written (ThinkShare replaced the diplomatic messages)                                            |
| `ScenarioGeneration`, `ScenarioTemplate`, `ScenarioUsageAnalytics`                                                | same as the model                                                   | Diplomatic scenarios use `CulturalScenario`, `DiplomaticScenario` and `ScenarioChoice`                         |
| `VitalityHistory`, `ComponentEffectivenessHistory`                                                                | same as the model                                                   | Never read or written                                                                                          |
| `SectoralOutput`, `PolicyEffect`                                                                                  | same as the model                                                   | Economic-model children nothing loads (no query includes them); `EconomicModel` stays                          |
| `EconomicIndicator`, `TaxPolicy`, `TaxCalculation`, `CrossBuilderSynergy`, `FiscalPolicy`, `AtomicEconomicImpact` | same as the model                                                   | Economy modelling tables with no reader or writer                                                              |
| `GovernmentSynergy`                                                                                               | `GovernmentSynergy`                                                 | Never read or written; synergies use `ComponentSynergy`                                                        |
| `Territory`                                                                                                       | `territories`                                                       | Unused map model; geometry lives on `Country` and `map_layers`                                                 |
| `ElevationZone`                                                                                                   | `elevation_zones`                                                   | Unused; elevation zones are read from `map_layers`                                                             |
| `TransportNode`, `TransportSegment`, `TransportRouteSegment`                                                      | `transport_nodes`, `transport_segments`, `transport_route_segments` | Transport network segments; routes and hubs stay                                                               |
| `MediaTrack`, `MediaPlaylist`, `PlaylistTrack`, `PlaybackHistory`                                                 | same as the model                                                   | The media player keeps its queue in the browser                                                                |
| `CountryMoodMetric`                                                                                               | `CountryMoodMetric`                                                 | Never written                                                                                                  |
| `ActivityLike`, `ActivityComment`, `ActivityShare`                                                                | same as the model                                                   | Activity reactions were never built                                                                            |

Relation fields removed from kept models: `Country.atomicEconomicImpacts`, `archetypeMatches`, `moodMetrics`,
`crossBuilderSynergies`, `fiscalPolicies`, `territories`, `transportNodes`, `transportSegments`;
`User.scheduledChanges`, `archetypeSelections`; `DiplomaticChannel.messages`; `DiplomaticScenario.generations`;
`EconomicModel.policyEffects`, `sectoralOutputs`; `TaxSystem.taxCalculations`, `taxPolicy`; `City.transportNodes`;
`TransportRoute.routeSegments`; `ActivityFeed.activityComments`, `activityLikes`, `activityShares`. All are list
fields, so no kept table holds a foreign key into a dropped one.

### 1.2 Already removed by earlier releases (not part of this change)

| Item                                                                                                                                     | Removed by                           | Production drop                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CardTrade`, `CraftingRecipe`, `CraftingHistory`, `NSImport` (`ns_imports`), `SyncCheckpoint` (`sync_checkpoints`), `CardPack.pdsConfig` | Cards refresh Phase 1 (`25c40cb5c`)  | `prisma/migrations/20261027120001_cards_foundations_constraints/migration.sql`, run by the deploy before the push ([cards runbook](../systems/cards.md#deploy-runbook-notes)) |
| `WorldTemplate` (`world_templates`), `ProceduralWorld` (`procedural_worlds`)                                                             | Atlas and World Studio (`180bb9c57`) | `prisma/migrations/20261023120000_atlas_studio/migration.sql`, run by the deploy before the push                                                                              |

The `crafting` tRPC router is **not** dropped: the card workshop (dust, break down, fuse, craft) reuses that name
and is live.

### 1.3 Kept on purpose

- **Exchange (₷):** D5 (a), being built.
- **Military and defense:** `MilitaryBranch`, `MilitaryUnit`, `ThreatIncident`, `NeighborThreatAssessment` (D2, and
  realm time's defense model).
- **Read through a relation or written by nested writes:** `Permission`, `RolePermission`, `GovernmentBranch`,
  `SubBudgetCategory`, `MeetingActionItem`, `EventChain`, `EmbassyUpgrade`, `AllianceDocument`, `EconomicModel`,
  `ThinktankMessage`, `ScenarioChoice`, `PollOption`, `WorldEventCountry`. **PostGIS:** `spatial_ref_sys`.
- **Other models that look idle** (MC-19 in the [backlog](../roadmap/backlog.md)) were not on the approved list and
  stay until someone checks them the same way.

---

## 2. How production drops them

`scripts/deploy-production.sh` takes `bun run db:backup`, applies the additive schema step, runs every hand-written
SQL file, then runs `bun run db:push:force`, which is `prisma db push` **without** `--accept-data-loss`. That push
compares the database with the schema and drops what the schema no longer has:

- **An empty table is dropped silently,** with no warning and no prompt. So are its indexes, its triggers (for
  example `territory_geom_sync` on `territories`), its foreign keys and the now-unused `MediaType` enum type.
- **A table with rows makes Prisma print a data-loss warning.** The deploy has no terminal to answer it, so the push
  exits non-zero and the deploy stops with `Database sync failed (the live build is untouched)`. Every SQL file
  before the push has already run; nothing is dropped.

So when every table in section 3 is empty, the deploy drops all 49 in one push, with no extra step. A dependent
object Prisma does not know about (a view, or a foreign key added by hand from another table) would make the drop
fail; the second query in section 3 finds those.

---

## 3. Pre-window check (B2, read-only)

Run on production during B2 of the [release guide](release-guide.md#b2-pre-window-checks-read-only-the-old-build-still-serving),
with the old build still serving. Both queries only read.

**Row counts.** `NULL` means the table does not exist on production (nothing to drop).

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats <<'SQL'
SELECT t.name AS table_name,
       CASE WHEN to_regclass(format('public.%I', t.name)) IS NULL THEN NULL
            ELSE (xpath('/row/c/text()',
                        query_to_xml(format('SELECT count(*) AS c FROM public.%I', t.name), false, true, '')))[1]::text::bigint
       END AS row_count
FROM unnest(ARRAY[
  'subject','domain','consentPolicy','runtimePolicyDecision','consentPurpose','consent','auditLog',
  'private_c15t_settings','Post','ScheduledChange','LogRetentionPolicy','EncryptionKey','EncryptionAuditLog',
  'CountryActivity','ArchetypeCategory','Archetype','UserArchetypeSelection','CountryArchetypeMatch',
  'DiplomaticRelationshipHistory','DiplomaticAction','DiplomaticMessage','EmbassyRequirement','ScenarioGeneration',
  'ScenarioTemplate','ScenarioUsageAnalytics','VitalityHistory','ComponentEffectivenessHistory','SectoralOutput',
  'PolicyEffect','EconomicIndicator','TaxPolicy','TaxCalculation','CrossBuilderSynergy','FiscalPolicy',
  'AtomicEconomicImpact','GovernmentSynergy','territories','elevation_zones','transport_nodes','transport_segments',
  'transport_route_segments','MediaTrack','MediaPlaylist','PlaylistTrack','PlaybackHistory','CountryMoodMetric',
  'ActivityLike','ActivityComment','ActivityShare'
]) AS t(name)
ORDER BY row_count DESC NULLS LAST, table_name;
SQL
```

`'auditLog'` is the c15t table; the live audit log is `"AuditLog"` and is not in the list.

**Expected:** every `row_count` is `0` or `NULL`. Keep the output with the deploy notes.

**A non-empty table means stop and ask the owner** before the window. Do not drop it by hand and do not answer yes to
an interactive push for it without that decision.

**Expect some rows.** The same query on the local dev database (`ixstats`, 2026-10-27) found rows in six tables:
`consent` 21, `subject` 19, `consentPurpose` 2, `domain` 2, `consentPolicy` 1 (consent records from the removed
c15t banner) and `elevation_zones` 9 (the old elevation legend; the map reads its zones from `map_layers` now). The
other 43 were empty. Production probably holds the same rows, and then the deploy's push stops as described in
section 2. Other tables that could hold rows on an old database: `ScheduledChange` (its pipeline ran until
2026-10-06), `DiplomaticMessage` (the source the ThinkShare migration copied from), the `transport_*` tables (filled
by an archived map script) and `Archetype`.

**If the owner rules the rows disposable,** drop those tables in the window after the backup (B3 step 2) and before
the deploy, the way the deploy drops `world_configs`. For the six above (the eight c15t tables go together, because
they reference each other):

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 <<'SQL'
DROP TABLE IF EXISTS "subject", "domain", "consentPolicy", "runtimePolicyDecision", "consentPurpose", "consent",
  "auditLog", "private_c15t_settings", "elevation_zones";
SQL
```

Add another table to that statement only when the owner has seen its count and said so. The deploy's push then drops
the remaining empty tables on its own.

**Dependents Prisma would not drop.** Expected: no rows.

```bash
docker exec -i ixstats-postgres psql -U postgres -d ixstats <<'SQL'
WITH dropped(name) AS (SELECT unnest(ARRAY[
  'subject','domain','consentPolicy','runtimePolicyDecision','consentPurpose','consent','auditLog',
  'private_c15t_settings','Post','ScheduledChange','LogRetentionPolicy','EncryptionKey','EncryptionAuditLog',
  'CountryActivity','ArchetypeCategory','Archetype','UserArchetypeSelection','CountryArchetypeMatch',
  'DiplomaticRelationshipHistory','DiplomaticAction','DiplomaticMessage','EmbassyRequirement','ScenarioGeneration',
  'ScenarioTemplate','ScenarioUsageAnalytics','VitalityHistory','ComponentEffectivenessHistory','SectoralOutput',
  'PolicyEffect','EconomicIndicator','TaxPolicy','TaxCalculation','CrossBuilderSynergy','FiscalPolicy',
  'AtomicEconomicImpact','GovernmentSynergy','territories','elevation_zones','transport_nodes','transport_segments',
  'transport_route_segments','MediaTrack','MediaPlaylist','PlaylistTrack','PlaybackHistory','CountryMoodMetric',
  'ActivityLike','ActivityComment','ActivityShare'])),
t AS (SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN (SELECT name FROM dropped))
SELECT 'foreign key' AS kind, con.conrelid::regclass::text AS from_object, t.relname AS dropped_table
FROM pg_constraint con JOIN t ON t.oid = con.confrelid
WHERE con.contype = 'f' AND con.conrelid NOT IN (SELECT oid FROM t)
UNION ALL
SELECT DISTINCT 'view', v.oid::regclass::text, t.relname
FROM pg_depend d JOIN pg_rewrite r ON r.oid = d.objid JOIN pg_class v ON v.oid = r.ev_class JOIN t ON t.oid = d.refobjid
WHERE v.oid NOT IN (SELECT oid FROM t);
SQL
```

Any row here also means stop and ask the owner.

---

## 4. Backup and restore

The deploy's `bun run db:backup` runs **before** the additive step, the SQL and the push, and refuses to continue if
it fails. It writes `backups/ixstats-<UTC timestamp>.dump` and appends a line to `backups/deploy-history.log` (time,
commit going live, dump). That dump still holds every table above.

- **Roll the whole release back:** `./scripts/deployment/rollback-deployment.sh <remote-branch> --restore
backups/ixstats-<stamp>.dump` ([release guide, Rollback](release-guide.md#rollback)). 1.5 drops and converts data
  elsewhere too, so a rollback to pre-1.5 code is always a restore.
- **Recover one dropped table without rolling back:** restore the dump into a scratch database, not production, and
  copy what you need from there:

  ```bash
  docker run -d --name ixstats-restore-test -e POSTGRES_PASSWORD=restoretest postgis/postgis:16-3.4-alpine
  docker exec ixstats-restore-test createdb -U postgres ixstats
  docker exec -i ixstats-restore-test pg_restore -U postgres -d ixstats --no-owner < backups/ixstats-<stamp>.dump
  docker exec ixstats-restore-test psql -U postgres -d ixstats -c 'SELECT count(*) FROM "ScheduledChange";'
  docker rm -f ixstats-restore-test
  ```

  The current code reads none of these tables, so a recovered table is for the record only.

---

## 5. Local development

`start-development.sh` runs the same SQL and `bun run db:push:force` whenever a schema file is newer than its stamp,
so the owner's next `bun run dev` drops these tables from the local dev database (`ixstats`) too. Empty tables go
silently. In a terminal, Prisma asks before dropping a table that has rows; answer no if you want to keep them (the
stamp is not written, so the next start asks again). `scripts/refresh-local-db.sh` also ends with
`bun run db:push:force`.
