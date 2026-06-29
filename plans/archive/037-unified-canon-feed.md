# Plan 037: Unified canon feed — merge effects, diplomacy, and decisions into one story

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f3a52c4a..HEAD -- src/server/api/routers/mycountry/dashboard.ts src/components/mycountry/NewsFeedWidget.tsx src/components/mycountry/EnhancedExecutiveContent.tsx`
> If any changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none, but is much richer after 035 (more effects) and 036 (incidents)
- **Category**: direction
- **Planned at**: commit `f3a52c4a`, 2026-06-15

## Why this matters

The community-feedback analysis recommends demonstrating "data = lore = world"
through a **narrative output** — one chronological view of "everything that
happened to/in/from your nation, as a story." Today the only such surface is a
cramped 8-item sidebar (`NewsFeedWidget`) sourced from a single table
(`StorytellerEffect`). Diplomatic events and resolved national-issue decisions —
the other two pillars of what a player actually *did* — never appear together.

This plan adds a `getCanonFeed` procedure that merges the three first-class source
tables into one normalized, time-sorted feed, and a full-size `NarrativeFeed`
panel in the executive section. It deliberately **does not** build a brand-new
parallel system: it sits beside the existing `getNewsFeed`/`NewsFeedWidget` and
reuses their rendering idiom. (We merge the *source* records, not the derived
ThinkPages posts, to avoid double-counting the same event.)

## Current state

- **`getNewsFeed`** — `src/server/api/routers/mycountry/dashboard.ts:181-210`. A
  `publicProcedure` that returns `StorytellerEffect` rows
  (`{ id, description, inputType, value, ixTimeTimestamp, createdAt }`). Add the
  new procedure next to it in the same router file. `db` and `z` are already
  imported there.

- **`NewsFeedWidget`** — `src/components/mycountry/NewsFeedWidget.tsx`. Renders the
  feed in a `CutoutPanel`, with a `CATEGORY_ICONS` map
  ({ diplomatic, economic, military, social, emergency }), a `resolveCategory`
  helper, and a `timeAgo` helper. **Use this file as the structural exemplar** for
  the new component (same imports: `CutoutPanel` from `~/components/mycountry/cards`,
  `ACCENT_CLASSES` from `~/components/mycountry/cards/accents`, lucide icons).

- **Mount point** — `src/components/mycountry/EnhancedExecutiveContent.tsx:46-69`
  renders `<ExecutiveWarRoom countryId={country.id} />` then `<InlineWiki .../>`
  inside `<SectionShell>`. The new panel mounts here, between the War Room and the
  wiki.

- **Source models**:
  - `StorytellerEffect`: `id`, `description`, `inputType`, `value`, `ixTimeTimestamp` (DateTime), `createdAt`.
  - `DiplomaticEvent`: `id`, `country1Id`, `country2Id` (String?), `eventType`, `title`, `severity`, `createdAt` (DateTime), `ixTimeTimestamp` (Float?).
  - `NationalIssue`: has `title`, `countryId`, `domain`, `status`, `respondedAt` (DateTime?), `updatedAt`. Resolved statuses are `"responded"` / `"auto_resolved"` (see `national-issues/player.ts` `getHistory`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck (file) | `bun run typecheck:file src/server/api/routers/mycountry/dashboard.ts` | exit 0 |
| Typecheck (file) | `bun run typecheck:file src/components/mycountry/NarrativeFeed.tsx` | exit 0 |
| Typecheck (file) | `bun run typecheck:file src/components/mycountry/EnhancedExecutiveContent.tsx` | exit 0 |
| Lint | `bun run lint` | exit 0 (pre-existing warnings tolerated) |

(Never run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build` — they OOM the server.)

## Scope

**In scope**:
- `src/server/api/routers/mycountry/dashboard.ts` (add `getCanonFeed` procedure)
- `src/components/mycountry/NarrativeFeed.tsx` (create)
- `src/components/mycountry/EnhancedExecutiveContent.tsx` (mount the panel)

**Out of scope** (do NOT touch):
- `getNewsFeed` / `NewsFeedWidget` — they keep working as the compact sidebar
  version. Do not change their shape.
- The diplomacy section — this panel is executive-only for now (note as follow-up).
- ThinkPages posts as a feed source — excluded on purpose (they're derived from
  the same events; including them double-counts).

## Git workflow

- Branch: `advisor/037-canon-feed`
- Conventional commits, e.g. `feat(mycountry): unified canon feed (effects + diplomacy + decisions)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the `getCanonFeed` procedure

In `src/server/api/routers/mycountry/dashboard.ts`, add next to `getNewsFeed`:

```ts
getCanonFeed: publicProcedure
  .input(z.object({ countryId: z.string(), limit: z.number().min(1).max(60).default(30) }))
  .query(async ({ input }) => {
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [effects, events, decisions] = await Promise.all([
        db.storytellerEffect.findMany({
          where: { countryId: input.countryId, ixTimeTimestamp: { gte: since } },
          orderBy: { ixTimeTimestamp: "desc" },
          take: input.limit,
          select: { id: true, description: true, inputType: true, ixTimeTimestamp: true },
        }),
        db.diplomaticEvent.findMany({
          where: { OR: [{ country1Id: input.countryId }, { country2Id: input.countryId }] },
          orderBy: { createdAt: "desc" },
          take: input.limit,
          select: { id: true, title: true, eventType: true, severity: true, createdAt: true },
        }),
        db.nationalIssue.findMany({
          where: { countryId: input.countryId, status: { in: ["responded", "auto_resolved"] } },
          orderBy: { respondedAt: "desc" },
          take: input.limit,
          select: { id: true, title: true, domain: true, respondedAt: true, updatedAt: true },
        }),
      ]);

      type CanonFeedItem = { id: string; kind: "effect" | "diplomacy" | "decision"; title: string; category: string; timestamp: number };
      const items: CanonFeedItem[] = [
        ...effects.map((e) => ({
          id: `eff_${e.id}`, kind: "effect" as const,
          title: e.description ?? e.inputType,
          category: e.inputType.toLowerCase().includes("popula") ? "social" : "economic",
          timestamp: e.ixTimeTimestamp.getTime(),
        })),
        ...events.map((d) => ({
          id: `dip_${d.id}`, kind: "diplomacy" as const,
          title: d.title,
          category: d.severity && d.severity !== "info" ? "emergency" : "diplomatic",
          timestamp: d.createdAt.getTime(),
        })),
        ...decisions.map((n) => ({
          id: `dec_${n.id}`, kind: "decision" as const,
          title: n.title,
          category: "governance",
          timestamp: (n.respondedAt ?? n.updatedAt).getTime(),
        })),
      ];

      items.sort((a, b) => b.timestamp - a.timestamp);
      return items.slice(0, input.limit);
    } catch (error) {
      console.error("[MyCountry CanonFeed] Error:", error);
      return [];
    }
  }),
```

(If `NationalIssue` lacks `respondedAt`, fall back to `updatedAt` only — see STOP
conditions. Verify the field names against the live Prisma model before relying on them.)

**Verify**: `bun run typecheck:file src/server/api/routers/mycountry/dashboard.ts` → exit 0.

### Step 2: Build the `NarrativeFeed` panel

Create `src/components/mycountry/NarrativeFeed.tsx`, modeled structurally on
`NewsFeedWidget.tsx` (same `CutoutPanel`/icon/`timeAgo` idiom) but full-width and
sourced from `api.mycountry.getCanonFeed`. Sketch:

```tsx
"use client";

import { useMemo } from "react";
import { Globe, Landmark, Heart, AlertTriangle, Gavel, Newspaper, type LucideIcon } from "lucide-react";
import { api } from "~/trpc/react";
import { CutoutPanel } from "~/components/mycountry/cards";
import { ACCENT_CLASSES } from "~/components/mycountry/cards/accents";

const CATEGORY_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  diplomatic: { icon: Globe, color: "text-cyan-500" },
  economic: { icon: Landmark, color: "text-emerald-500" },
  social: { icon: Heart, color: "text-pink-500" },
  emergency: { icon: AlertTriangle, color: "text-amber-500" },
  governance: { icon: Gavel, color: "text-indigo-500" },
};

function timeAgo(date: Date): string {
  const m = Math.floor((Date.now() - date.getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NarrativeFeed({ countryId }: { countryId: string }) {
  const { data, isLoading } = api.mycountry.getCanonFeed.useQuery(
    { countryId, limit: 30 },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const amber = ACCENT_CLASSES["amber"];
  const items = useMemo(() => data ?? [], [data]);

  if (isLoading) return null;

  return (
    <CutoutPanel className="mt-4" contentClassName="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Newspaper className={amber.text + " h-4 w-4"} />
        <span className="text-sm font-semibold">National Story</span>
        {items.length > 0 && <span className="text-muted-foreground text-[11px]">{items.length} entries</span>}
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">
          Nothing has happened yet. Enact a policy, conclude a meeting, or shape your diplomacy — it will be recorded here.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const { icon: Icon, color } = CATEGORY_ICONS[it.category] ?? CATEGORY_ICONS.diplomatic;
            return (
              <div key={it.id} className="flex items-start gap-2.5 py-1">
                <Icon className={color + " mt-0.5 h-3.5 w-3.5 shrink-0"} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs leading-snug">{it.title}</p>
                  <span className="text-muted-foreground text-[10px]">{timeAgo(new Date(it.timestamp))}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CutoutPanel>
  );
}
```

Confirm the import paths for `CutoutPanel` and `ACCENT_CLASSES` resolve the same
way they do in `NewsFeedWidget.tsx` (copy them verbatim from that file).

**Verify**: `bun run typecheck:file src/components/mycountry/NarrativeFeed.tsx` → exit 0.

### Step 3: Mount the panel in the executive section

In `src/components/mycountry/EnhancedExecutiveContent.tsx`, import and render the
panel between the War Room and the inline wiki:

```tsx
import { NarrativeFeed } from "./NarrativeFeed";
// ...
<ExecutiveWarRoom countryId={country.id} />

<NarrativeFeed countryId={country.id} />

{/* Wiki woven inline */}
<InlineWiki context="executive" accent="amber" maxSections={1} />
```

**Verify**: `bun run typecheck:file src/components/mycountry/EnhancedExecutiveContent.tsx` → exit 0.

## Test plan

- No new automated test required: the procedure is parallel reads + a pure
  in-memory merge/sort, and the component is presentational. The verification
  gates are the three `typecheck:file` runs + lint.
- Optional (only if a tRPC caller harness already exists in
  `src/server/api/routers/__tests__/`): a test asserting `getCanonFeed` merges and
  sorts descending across the three kinds. Otherwise skip (YAGNI).
- Reviewer/manual: load `/mycountry/executive` for a country with effects,
  diplomatic events, and a resolved issue → the panel shows all three interleaved
  newest-first.

## Done criteria

ALL must hold:

- [ ] `getCanonFeed` exists in `dashboard.ts`, merges `storytellerEffect` + `diplomaticEvent` + resolved `nationalIssue`, sorted newest-first, capped at `limit`
- [ ] `NarrativeFeed.tsx` renders the feed using the `NewsFeedWidget` idiom (CutoutPanel + category icons + timeAgo) with a non-empty empty-state message
- [ ] `NarrativeFeed` is mounted in `EnhancedExecutiveContent` between the War Room and `InlineWiki`
- [ ] `getNewsFeed` and `NewsFeedWidget` are unchanged
- [ ] All three `bun run typecheck:file` commands exit 0
- [ ] `bun run lint` exits 0
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `NationalIssue` model lacks `respondedAt` AND `updatedAt`, or the resolved
  statuses differ from `"responded"`/`"auto_resolved"` (confirm via
  `national-issues/player.ts` `getHistory`).
- `db` or `z` is not already imported in `dashboard.ts` (the excerpt assumes they are).
- `CutoutPanel` / `ACCENT_CLASSES` import paths in `NewsFeedWidget.tsx` differ from
  the sketch — copy the real ones.
- `EnhancedExecutiveContent` no longer renders `ExecutiveWarRoom` + `InlineWiki`
  inside `SectionShell` (it was refactored).

## Maintenance notes

- This panel is executive-only. A parallel mount in the diplomacy section
  (`EnhancedDiplomacyContent`) is an easy follow-up using the same procedure.
- Feed sources are the three *source* tables, not ThinkPages posts. If a future
  source of canon appears (e.g. crisis events), add it as a fourth `Promise.all`
  query + mapper — keep the normalized `CanonFeedItem` shape.
- After plan 035 lands, policy enactments and meeting conclusions create
  `StorytellerEffect` rows and (separately) ThinkPages posts; the feed shows the
  effect rows. After 036, diplomatic incidents are richer. The feed gets better as
  those land — it does not depend on them to function.
- Reviewer: confirm the merge does not double-count (we excluded ThinkPages) and
  that timestamps are compared in the same unit (ms epoch) across all three kinds.
