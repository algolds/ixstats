# Scheduled Changes

> **Retired 2026-10-06** to [docs/history/](../README.md). Deleted 2026-10-06 (D11): the service, cron job, route, router and `usePendingLocks` are gone; the `ScheduledChange` model stays until the D9 schema drop.

**Last updated:** 2026-10-05
**Status:** Apply pipeline built and tested; **nothing creates scheduled changes**. Whether to keep or delete it is open
decision D11 in [ROADMAP.md](../../roadmap/ROADMAP.md).
**Routes:** no page. `GET|POST /api/cron/apply-scheduled-changes` (cron secret)
**Code:** `src/server/api/routers/scheduledChanges.ts`, `src/server/modules/scheduled-changes/` (`service.ts`,
`effect-value.ts`), `src/server/cron/apply-scheduled-changes.ts`, `src/app/api/cron/apply-scheduled-changes/route.ts`,
`src/hooks/usePendingLocks.ts`

A scheduled change is a delayed edit to one national figure: "at `scheduledFor`, move `fieldPath` from `oldValue` to
`newValue`". When the change falls due, the pipeline applies it as a `StorytellerEffect`, which the economy calculation
picks up. It never writes the `Country` row directly.

---

## 1. Data model

`ScheduledChange` (`prisma/schema/core.prisma`):

| Field | Meaning |
| :--- | :--- |
| `userId` | Internal `User.id` of the author (cascade delete with the user) |
| `countryId` | Target country |
| `changeType`, `impactLevel` | Free strings. The service maps `impactLevel` `none`/`low`/`medium`/`high` to effect duration (0/1/2/4) and notification priority |
| `fieldPath` | Must be one of `ALLOWED_FIELD_PATHS`: `currentGdpPerCapita`, `currentTotalGdp`, `currentPopulation`, `adjustedGdpGrowth`, `populationGrowthRate`, `unemploymentRate`, `inflationRate`, `taxRevenueGDPPercent` |
| `oldValue`, `newValue` | JSON-encoded finite numbers |
| `scheduledFor`, `appliedAt` | Due time and apply time (real time) |
| `status` | `pending` → `applied`, `failed` or `cancelled` (plain string) |
| `warnings`, `metadata` | Free text |

## 2. Applying a change

`applyDueScheduledChanges` (`service.ts`) loads up to 500 pending rows with `scheduledFor <= now`, oldest first, and
for each:

1. **Validates** the field path and values. The effect value is the relative change
   `(new − old) / |old|` (`toEffectValue`; the economy engine clamps it to ±0.5). A disallowed path, a non-number or
   `oldValue = 0` sets the row to `failed` (conditional on `status = "pending"`). These failures are not retried.
2. **Claims and writes in one transaction.** A conditional `updateMany` (`status = "pending" AND scheduledFor <= now`)
   sets `applied`/`appliedAt`, then a `StorytellerEffect` is created with the mapped `inputType`
   (`FIELD_TO_EFFECT_TYPE`), the value, a description, the impact duration and `createdBy = userId`. A second runner
   gets `count = 0` and skips the row, so each change applies once.
3. **Notifies after commit**: `notificationAPI.create` to the country ("Scheduled Change Applied", category economic,
   source `scheduled-changes`). A notification failure does not undo the apply.

A database error inside the transaction rolls back and leaves the row `pending`, so the next run retries it.

`applyScheduledChangeForUser` (owner-triggered early apply, with NOT_FOUND / FORBIDDEN / not-due / already-applied
checks) exists and is tested, but no procedure calls it.

## 3. Procedures

| Procedure | Auth | What it does |
| :--- | :--- | :--- |
| `scheduledChanges.getPendingChanges` | protected | The caller's own pending changes for their current country, ordered by `scheduledFor` |

There is no create, cancel or apply procedure.

`usePendingLocks` calls `getPendingChanges` and returns `isLocked(fieldPath)`. The MyCountry government forms
`BudgetAllocationForm` and `RevenueItemRow` disable inputs when `isLocked("budgetAllocations")` or
`isLocked("revenueSources")` is true.

## 4. Jobs

| Job | Schedule | Entry |
| :--- | :--- | :--- |
| `scheduled-changes` (`src/server/cron/jobs.ts`) | `*/10 * * * *`, lock `scheduled-changes`, 10-minute lease | `applyDueScheduledChanges`. Runs only when listed in `CRON_ENABLED_JOBS` |
| `/api/cron/apply-scheduled-changes` | On demand | `applyScheduledChangesJob` (same service, with logging). `?status=true` returns counts (total, pending, applied, cancelled, failed, overdue) instead. Guarded by `cronAuthError`: `Authorization: Bearer <CRON_SECRET>`; returns 503 in production when `CRON_SECRET` is unset |

## 5. Does anything create them?

No. A search of `src/`, `scripts/` and `prisma/` finds no `scheduledChange.create` or upsert outside tests. The
table only fills if rows are inserted by hand. With no rows:

- the cron job and the API route apply nothing;
- `getPendingChanges` always returns an empty list, so the government form locks never engage.

## 6. Known gaps

- No writer, so the feature is inert (decision D11: use it for impact-delayed edits, or delete it).
- The router's header comment describes impact levels `instant`, `next_day`, `short_term` and `long_term`; the service
  maps `none`, `low`, `medium` and `high`. Unknown levels get duration 0 and priority medium.
- The form locks check `budgetAllocations` and `revenueSources`, which are not in `ALLOWED_FIELD_PATHS`. A change on
  those paths would fail validation.
- `scheduledFor` is real time; there is no IxTime scheduling.
- `cancelled` is counted in stats but nothing sets it.

## Related documentation

- [Economy](../../systems/economy.md): how `StorytellerEffect` values enter the calculation
- [Notifications](../../systems/notifications.md)
