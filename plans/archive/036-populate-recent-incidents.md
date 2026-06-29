# Plan 036: Populate diplomatic `recentIncidents` from DiplomaticEvent (living ledger)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f3a52c4a..HEAD -- src/server/api/routers/diplomacy/core/relations.ts src/shared/types/diplomacy.dto.ts`
> If either changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (complements 037)
- **Category**: direction / correctness
- **Planned at**: commit `f3a52c4a`, 2026-06-15

## Why this matters

The diplomacy UI is meant to show a living ledger of each bilateral relationship,
but `recentIncidents` is **hardcoded to an empty array** for every relation
([relations.ts:61](../src/server/api/routers/diplomacy/core/relations.ts#L61)) — so
the "recent events with this country" surface is always blank, even though
`DiplomaticEvent` rows (embargoes, embassies, alliances, incidents) exist for
exactly these country pairs. Burg's feedback wants governance made *visible*
("changes are versioned and visible"); this is a one-query gap between data that
exists and a ledger field that never shows it.

This plan populates `recentIncidents` from `DiplomaticEvent`, batched to avoid an
N+1 (one extra query, not one per relation).

## Current state

- **DTO** — `src/shared/types/diplomacy.dto.ts:16`: `recentIncidents: string[];`
  (line 15 `activePolicies: string[];` is also hardcoded empty but is out of
  scope here).

- **`getRelationships`** — `src/server/api/routers/diplomacy/core/relations.ts:11-75`.
  It fetches `diplomaticRelation` rows, batch-looks-up country names, then maps
  each relation to a DTO. The map hardcodes:

  ```ts
  activePolicies: [],
  recentIncidents: [],
  ```

  (lines 60-61). `input.countryId` is the viewer; `targetId` (line 37-38) is the
  other country in each relation.

- **`DiplomaticEvent` model** — fields: `country1Id` (String), `country2Id`
  (String?), `eventType` (String), `title` (String), `description` (String),
  `severity` (String, default `"info"`), `createdAt` (DateTime),
  `ixTimeTimestamp` (Float?). Indexed on `country1Id`, `country2Id`, `createdAt`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck (file) | `bun run typecheck:file src/lib/diplomatic-incidents.ts` | exit 0 |
| Typecheck (file) | `bun run typecheck:file src/server/api/routers/diplomacy/core/relations.ts` | exit 0 |
| Tests | `bun run test -- src/lib/diplomatic-incidents.test.ts` | all pass |
| Lint | `bun run lint` | exit 0 (pre-existing warnings tolerated) |

(Never run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build` — they OOM the server.)

## Scope

**In scope**:
- `src/lib/diplomatic-incidents.ts` (create — pure grouping helper)
- `src/lib/diplomatic-incidents.test.ts` (create)
- `src/server/api/routers/diplomacy/core/relations.ts` (one batched query + use helper)

**Out of scope** (do NOT touch):
- `activePolicies: []` — separate field; leave it (note in maintenance as a
  follow-up that follows the same pattern using `ForeignPolicyAction`).
- The DTO shape in `diplomacy.dto.ts` — `recentIncidents` is already `string[]`.
- Any other procedure in `relations.ts` (`getRecentChanges`, `updateRelationship`, etc.).

## Git workflow

- Branch: `advisor/036-recent-incidents`
- Conventional commits, e.g. `feat(diplomacy): populate recentIncidents from DiplomaticEvent`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Pure grouping helper + test

Create `src/lib/diplomatic-incidents.ts`:

```ts
/**
 * Groups a country's diplomatic events into per-counterparty incident strings
 * for the relationship ledger. Pure + testable; the router does the DB read.
 */
export interface DiplomaticEventLite {
  country1Id: string;
  country2Id: string | null;
  eventType: string;
  title: string;
  severity: string;
}

/**
 * @param events  events where selfId is country1 or country2, newest first
 * @param selfId  the viewing country
 * @param perCountry  max incidents kept per counterparty (default 5)
 * @returns map of counterpartyId -> short incident strings (newest first)
 */
export function groupIncidentsByCountry(
  events: DiplomaticEventLite[],
  selfId: string,
  perCountry = 5
): Map<string, string[]> {
  const byCountry = new Map<string, string[]>();
  for (const ev of events) {
    const other = ev.country1Id === selfId ? ev.country2Id : ev.country1Id;
    if (!other || other === selfId) continue;
    const list = byCountry.get(other) ?? [];
    if (list.length < perCountry) {
      const sev = ev.severity && ev.severity !== "info" ? `[${ev.severity}] ` : "";
      list.push(`${sev}${ev.title}`);
    }
    byCountry.set(other, list);
  }
  return byCountry;
}
```

Create `src/lib/diplomatic-incidents.test.ts`:

```ts
import { groupIncidentsByCountry, type DiplomaticEventLite } from "./diplomatic-incidents";

const ev = (over: Partial<DiplomaticEventLite>): DiplomaticEventLite => ({
  country1Id: "A", country2Id: "B", eventType: "embargo", title: "Embargo imposed", severity: "info", ...over,
});

describe("groupIncidentsByCountry", () => {
  it("buckets by the counterparty (handles either side)", () => {
    const m = groupIncidentsByCountry([ev({}), ev({ country1Id: "C", country2Id: "A", title: "Treaty" })], "A");
    expect(m.get("B")).toEqual(["Embargo imposed"]);
    expect(m.get("C")).toEqual(["Treaty"]);
  });
  it("prefixes non-info severity and caps per counterparty", () => {
    const events = Array.from({ length: 7 }, (_, i) => ev({ title: `E${i}`, severity: "critical" }));
    const m = groupIncidentsByCountry(events, "A", 5);
    expect(m.get("B")).toHaveLength(5);
    expect(m.get("B")![0]).toBe("[critical] E0");
  });
  it("skips events with no counterparty", () => {
    const m = groupIncidentsByCountry([ev({ country2Id: null })], "A");
    expect(m.size).toBe(0);
  });
});
```

**Verify**: `bun run test -- src/lib/diplomatic-incidents.test.ts` → all pass.

### Step 2: Batch-fetch events in `getRelationships` and use the helper

In `src/server/api/routers/diplomacy/core/relations.ts`, add the import at top:

```ts
import { groupIncidentsByCountry } from "~/lib/diplomatic-incidents";
```

Inside `getRelationships`, after `relations` is fetched and the country
name/flag batch lookup, add **one** batched events query (not per-relation):

```ts
const events = await ctx.db.diplomaticEvent.findMany({
  where: { OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }] },
  orderBy: { createdAt: "desc" },
  take: 200,
  select: { country1Id: true, country2Id: true, eventType: true, title: true, severity: true },
});
const incidentsByCountry = groupIncidentsByCountry(events, input.countryId);
```

Then in the `relations.map(...)` return object, replace the hardcoded line:

```ts
recentIncidents: incidentsByCountry.get(targetId) ?? [],
```

Leave `activePolicies: []` unchanged.

**Verify**: `bun run typecheck:file src/server/api/routers/diplomacy/core/relations.ts` → exit 0.

## Test plan

- New: `src/lib/diplomatic-incidents.test.ts` — covers the either-side bucketing,
  the severity prefix + per-country cap, and the null-counterparty skip. This is
  the non-trivial logic; the router change is a batched query + a `Map.get`.
- Structural pattern: any existing `*.test.ts`.
- Manual (reviewer note, not required to pass): `getRelationships` for a country
  with prior `DiplomaticEvent` rows returns non-empty `recentIncidents`.

## Done criteria

ALL must hold:

- [ ] `groupIncidentsByCountry` exists in `src/lib/diplomatic-incidents.ts`; test passes
- [ ] `getRelationships` issues exactly one additional batched `diplomaticEvent` query (no query inside the relations loop)
- [ ] `recentIncidents` is populated from that query; `activePolicies` left as `[]`
- [ ] `bun run typecheck:file` passes for both edited/created TS files
- [ ] `bun run test -- src/lib/diplomatic-incidents.test.ts` passes
- [ ] `bun run lint` exits 0
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `DiplomaticEvent` model lacks `country1Id`/`country2Id`/`title`/`severity`
  (drift) — the query/helper can't be built as specified.
- `recentIncidents` in the DTO is no longer `string[]` (its shape changed).
- `getRelationships` was refactored away from the per-relation `.map` with
  `targetId` — re-derive the counterparty id before wiring the lookup.

## Maintenance notes

- `activePolicies` (line 60) is the same kind of gap: populate it from active
  `ForeignPolicyAction` rows with an identical batch-and-group approach. Deferred
  here to keep the change small; follow this plan as the template.
- The `take: 200` cap on the events query is a coarse bound; if a country can have
  thousands of events, switch to a per-counterparty windowed query. Not needed at
  current data scale.
- Plan 037's canon feed can reuse the same `DiplomaticEvent` source; keep the
  two consistent if event titles/format change.
- Reviewer: confirm the events query is outside the `.map` loop (no N+1).
