# Dropping the unused Prisma models (D9)

**Last updated:** 2026-10-06
**Status:** Prepared on branch `chore/drop-unused-models`, not applied. Decision D9 in
[ROADMAP.md](../roadmap/ROADMAP.md#decisions-needed): approved, applied only after a successful production restore
test.

This branch removes 56 models and one column from `prisma/schema/`. Nothing in `src/`, `scripts/` or the seeds reads
or writes them. The tables and their rows stay in the database until an operator runs `prisma db push` and accepts the
data loss, as described below.

---

## 1. What is dropped

Each model was re-checked on 2026-10-06, right before the drop, with:

```bash
grep -rnE "db\.<camel>\b|\.<camel>\.(find|create|update|upsert|delete|count|aggregate|groupBy)|prisma\.<camel>\b|tx\.<camel>\b" \
  src scripts prisma/seeds prisma/*.ts
grep -rn '"<table>"' src scripts prisma/seeds   # raw SQL
```

plus a search for every relation field that points at the model (`include`, `select`, `_count` and nested writes).
Only models with no hit at all are in the list. Relation fields that pointed at them from kept models are removed too
(for example `Country.territories`, `User.scheduledChanges`, `TaxSystem.taxPolicy`, `EconomicModel.sectoralOutputs`).

| Model | Table | Why it is unused |
|---|---|---|
| `subject`, `domain`, `consentPolicy`, `runtimePolicyDecision`, `consentPurpose`, `consent` | same as the model | c15t consent tables. The `@c15t/*` packages and routes were deleted earlier; no code reads them. The whole `c15t.prisma` file goes |
| `C15tAuditLog` | `auditLog` | c15t audit log (not the live `AuditLog` table) |
| `private_c15t_settings` | `private_c15t_settings` | c15t settings |
| `NSImport` | `ns_imports` | NationStates import log; never written (VT-25) |
| `SyncCheckpoint` | `sync_checkpoints` | Never written (VT-25) |
| `CardTrade` | `CardTrade` | Superseded by `TradeOffer` (VT-25) |
| `CraftingRecipe` | `CraftingRecipe` | Crafting is retired (2026-10-05). This branch also deletes the `crafting` router, which refused every call, its tests, `src/lib/cards/crafting-rules.ts` and `prisma/seeds/crafting-recipes.ts` |
| `CraftingHistory` | `CraftingHistory` | Same as above |
| `Post` | `Post` | Starter-template leftover; ThinkPages uses `ThinkpagesPost` |
| `ScheduledChange` | `ScheduledChange` | Its pipeline was deleted on 2026-10-06 (D11) |
| `LogRetentionPolicy` | `LogRetentionPolicy` | Never read or written |
| `EncryptionKey`, `EncryptionAuditLog` | same as the model | No encryption feature uses them |
| `CountryActivity` | `CountryActivity` | Activity lives in `ActivityFeed` |
| `ArchetypeCategory`, `Archetype`, `UserArchetypeSelection`, `CountryArchetypeMatch` | same as the model | Old archetype quartet; economic archetypes use `EconomicArchetype` |
| `DiplomaticRelationshipHistory`, `DiplomaticAction`, `DiplomaticMessage`, `EmbassyRequirement` | same as the model | Never read or written; `DiplomaticChannel` keeps its participants |
| `ScenarioGeneration`, `ScenarioTemplate`, `ScenarioUsageAnalytics` | same as the model | Diplomatic scenarios use `DiplomaticScenario` and `ScenarioChoice` only |
| `VitalityHistory`, `ComponentEffectivenessHistory` | same as the model | Never read or written (`VitalityHistory` is from MC-19) |
| `SectoralOutput`, `PolicyEffect` | same as the model | Economic-model children nothing loads; `EconomicModel` itself stays |
| `EconomicIndicator`, `TaxPolicy`, `TaxCalculation`, `CrossBuilderSynergy`, `FiscalPolicy`, `AtomicEconomicImpact` | same as the model | Economy modelling tables with no reader or writer (`TaxPolicy` is from MC-19) |
| `GovernmentSynergy` | `GovernmentSynergy` | Never read or written; synergies use `ComponentSynergy` |
| `Territory` | `territories` | Unused map model (AT-15) |
| `WorldTemplate` | `world_templates` | Unused procedural-world model (AT-15) |
| `ProceduralWorld` | `procedural_worlds` | Unused procedural-world model (AT-15) |
| `ElevationZone` | `elevation_zones` | Unused map model (AT-15) |
| `TransportNode` | `transport_nodes` | Transport network segments (AT-15); routes and hubs stay |
| `TransportSegment` | `transport_segments` | Same as above |
| `TransportRouteSegment` | `transport_route_segments` | Same as above |
| `MediaTrack`, `MediaPlaylist`, `PlaylistTrack`, `PlaybackHistory` | same as the model | The media player keeps its queue in the browser; the `MediaType` enum stays |
| `ActivityLike`, `ActivityComment`, `ActivityShare` | same as the model | Activity reactions were never built |
| `CountryMoodMetric` | `CountryMoodMetric` | Never written |

Column: `CardPack.pdsConfig` (VT-19). The seed no longer writes it; `scripts/setup/generate-pack-assets.ts` still reads
the same settings from `prisma/seeds/data/card-packs.json`.

Enums only these models used (for example `MediaType`) stay in the schema; `prisma db push` does not need them gone.

### Kept on purpose

- **Exchange (₷), 11 models** (`Company`, `Shareholding`, `SectorIndex`, `Contract`, …): D5 (a), being built.
- **Military and defense:** `MilitaryBranch`, `MilitaryUnit` (D2 (a), being restored), and `ThreatIncident`,
  `NeighborThreatAssessment` (defense data; the second is still read through `BorderSecurity.neighborThreats`).
- **Read through a relation, so not dead:** `Permission`, `RolePermission` (role checks), `GovernmentBranch`,
  `SubBudgetCategory`, `MeetingActionItem`, `EventChain`, `EmbassyUpgrade`, `AllianceDocument`, `EconomicModel`,
  `ThinktankMessage` (counted on thinktank groups), `ScenarioChoice` (seeded through nested writes).
- **Written through nested writes:** `PollOption`, `WorldEventCountry`. **PostGIS:** `spatial_ref_sys`.
- **Still read or written (MC-19 and seed-only lists):** `Treaty`, `DiplomaticChannel`, `QuickActionTemplate`,
  `CrisisEvent`, `MeetingDecision`, `PolicyEffectLog`, `ElectionCandidate` and the rest. Dropping them needs code
  changes first.

---

## 2. Pre-flight

Do not start until all of these hold:

1. **A production restore test has passed.** Take a fresh dump and restore it into a scratch database, not
   production:

   ```bash
   bun run db:backup                                    # backups/ixstats-<stamp>.dump
   docker run -d --name ixstats-restore-test -e POSTGRES_PASSWORD=restoretest postgis/postgis:16-3.4
   docker exec ixstats-restore-test createdb -U postgres ixstats
   docker exec -i ixstats-restore-test pg_restore -U postgres -d ixstats --no-owner < backups/ixstats-<stamp>.dump
   ```

   It passes when `pg_restore` exits 0 and the row counts match production for a few key tables:

   ```bash
   for t in Country User Card VaultTransaction ThinkpagesPost; do
     docker exec ixstats-postgres psql -U postgres -d ixstats -tAc "SELECT '$t', count(*) FROM \"$t\";"
     docker exec ixstats-restore-test psql -U postgres -d ixstats -tAc "SELECT '$t', count(*) FROM \"$t\";"
   done
   docker rm -f ixstats-restore-test
   ```

   Record the dump name and the date of the passing test in the PR or the ROADMAP D9 row.
2. **The branch is reviewed and merged** with the rest of the release, and CI is green.
3. **Know what you are deleting.** On production, count the rows in the tables from section 1 (most are empty;
   `CraftingRecipe`, `CraftingHistory` and `ScheduledChange` may hold rows). Keep the output with the backup:

   ```bash
   docker exec ixstats-postgres psql -U postgres -d ixstats -c \
     "SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE relname IN ('CraftingRecipe','CraftingHistory','ScheduledChange','CardTrade','ns_imports','sync_checkpoints','territories','transport_nodes','transport_segments','transport_route_segments') ORDER BY 1;"
   ```

---

## 3. Command order

Run on the production server, from the checkout of the release that contains this branch, in a maintenance window:

1. Stop the writers: `pm2 stop ixstats-cron ixstats-ws ixstats-ixtwitter`, and stop the web app (it is not a PM2 app;
   `scripts/start-production.sh` started it).
2. Back up again, right before the change: `bun run db:backup`. Note the dump name; it is the rollback point.
3. Apply the schema interactively, so you see the warnings:

   ```bash
   bunx prisma db push
   ```

   Prisma lists every table and column it will drop and asks whether to continue. Read the list: it must match
   section 1 (56 tables plus `CardPack.pdsConfig`) and nothing else. Answer **yes** only after that review. If the
   list names any other table, answer no and stop. Never pass `--accept-data-loss`.
4. `bun run db:generate`, then deploy as usual (`bun run deploy:prod`). Its own `db:push:force` step now finds nothing
   to change. If you deploy first instead, that step stops on the data-loss warning, because it runs without a
   prompt; run step 3 and deploy again.
5. The deploy restarts the web app and reloads the PM2 apps. Check `GET /api/health`, the vault, MyCountry and the
   maps.

---

## 4. Rollback

The drop deletes data, so rollback is a restore of the dump from step 2:

```bash
pm2 stop ixstats-cron ixstats-ws ixstats-ixtwitter   # and stop the web app
bun run db:restore -- backups/ixstats-<stamp>.dump --i-know-this-is-production        # review the plan
bun run db:restore -- backups/ixstats-<stamp>.dump --i-know-this-is-production --yes  # restore
```

Then redeploy the previous release (`bun run deploy:rollback -- <remote-branch>`; see the
[release guide](release-guide.md#rollback)) so the schema matches the restored tables. The code before this branch
does not use the dropped tables either, so no data written after the drop depends on them. A restore also rolls back
every other write made after the dump, which is why the writers stay stopped from step 1 until the check in step 5.
