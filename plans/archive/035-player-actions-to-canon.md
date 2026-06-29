# Plan 035: Player actions → canon — policy affects the sim + meetings/policy produce news

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f3a52c4a..HEAD -- src/server/api/routers/policies/crud.ts src/server/api/routers/quickactions/meetings.ts src/lib/diplomatic-news-generator.ts`
> If any changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (independent; complements 037)
- **Category**: direction
- **Planned at**: commit `f3a52c4a`, 2026-06-15

## Why this matters

The design north-star is "every player action is an input to canon, not a move in
a game." Two executive actions currently fall short of it:

1. **Policy is a placebo for the simulation.** `activatePolicy` updates a row and
   posts a news item, but it **never creates a `StorytellerEffect`**, so an
   enacted policy has *zero* effect on the country's modeled economy. Kir's
   feedback was "I like the Models" — policy should actually move them. The
   `Policy` model already carries `gdpEffect`/`employmentEffect`/etc. and
   `policyType`, so the data to drive an effect is right there.
2. **The policy news uses the wrong template.** Enacting a domestic policy posts
   as a "free trade agreement" ([policies/crud.ts:196](../src/server/api/routers/policies/crud.ts#L196)),
   and suspending one posts as foreign "sanctions" ([crud.ts:243](../src/server/api/routers/policies/crud.ts#L243)) —
   canon that reads wrong.
3. **Cabinet meetings produce no canon at all.** `completeMeeting` marks the
   meeting done and returns suggestions, but writes no narrative record
   ([quickactions/meetings.ts:411-520](../src/server/api/routers/quickactions/meetings.ts#L411)).

This plan makes policy enactment feed the simulation (via `StorytellerEffect`,
which `IxStatsCalculator` already consumes) and creates a visible ledger entry,
and gives policy + meetings semantically-correct auto-news. No scores, no
cooldowns, no costs — just action → real effect → canon.

## Current state

- **`StorytellerEffect` model** (maps to table `DmInputs`) — the sim's effect
  ledger. Fields used here: `countryId`, `ixTimeTimestamp` (DateTime), `inputType`
  (String), `value` (Float), `duration` (Int?), `isActive` (Boolean),
  `description` (String?), `createdBy` (String?). `IxStatsCalculator` already
  processes `inputType` values like `GDP_ADJUSTMENT`, `POPULATION_ADJUSTMENT`,
  `GROWTH_RATE_MODIFIER`, `ECONOMIC_POLICY`, `SPECIAL_EVENT`.

- **`Policy` model** carries: `policyType` (String), `category` (String),
  `priority` (String), and `gdpEffect`/`employmentEffect`/`inflationEffect`/
  `taxRevenueEffect` (Float, default 0), `userId`, `name`, `description`,
  `countryId`.

- **`activatePolicy`** — `src/server/api/routers/policies/crud.ts:134-204`. After
  setting status active it sends a notification and fires:

  ```ts
  void generateDiplomaticNews(ctx.db, policy.countryId, "free_trade_signed", {
    countryName: country?.name ?? "Government",
    targetName: policy.name,
    severity: "light",
    reason: `New policy enacted: ${policy.description || policy.name}`,
  }).catch(...);
  ```

  `suspendPolicy` (crud.ts:206) fires `"sanction_imposed"`; `repealPolicy`
  (crud.ts:253) fires `"policy_lifted"`. None create or deactivate a
  `StorytellerEffect`.

- **News generator** — `src/lib/diplomatic-news-generator.ts`. Adding an event
  type means: extend the `NewsEventType` union (lines 18-33) **and** add a
  matching entry to the `NEWS_TEMPLATES` record (lines 50-114). Template fns
  receive a `NewsContext` ({ countryName, targetName, actionType, severity,
  reason, ... }).

- **`completeMeeting`** — `src/server/api/routers/quickactions/meetings.ts:411`.
  Imports `notificationHooks` and `TRPCError` already. After
  `cabinetMeeting.update(... status: "completed" ...)` it notifies and builds
  `suggestedDecisions`. It does **not** import `generateDiplomaticNews`.

**Convention to follow**: news calls are fire-and-forget (`void generate...().catch(...)`),
never awaited on the critical path — match the existing call sites exactly.
Pure, testable logic goes in `src/lib/*.ts` (see `src/lib/ixtime.ts` for the
module style).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck (file) | `bun run typecheck:file src/lib/policy-effects.ts` | exit 0 |
| Typecheck (file) | `bun run typecheck:file src/server/api/routers/policies/crud.ts` | exit 0 |
| Typecheck (file) | `bun run typecheck:file src/lib/diplomatic-news-generator.ts` | exit 0 |
| Typecheck (file) | `bun run typecheck:file src/server/api/routers/quickactions/meetings.ts` | exit 0 |
| Tests | `bun run test -- src/lib/policy-effects.test.ts` | all pass |
| Lint | `bun run lint` | exit 0 (pre-existing warnings tolerated) |

(Never run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build` — they OOM the server.)

## Scope

**In scope**:
- `src/lib/policy-effects.ts` (create — pure `policyToEffect` helper)
- `src/lib/policy-effects.test.ts` (create)
- `src/lib/diplomatic-news-generator.ts` (add `policy_enacted`, `policy_suspended`, `cabinet_concluded`)
- `src/server/api/routers/policies/crud.ts` (create/deactivate StorytellerEffect; correct templates)
- `src/server/api/routers/quickactions/meetings.ts` (post minutes news on completeMeeting)

**Out of scope** (do NOT touch):
- `IxStatsCalculator` — it already consumes `StorytellerEffect`; no change needed.
- The `policyEffectLog` system in `policies/effects.ts` — separate, leave as-is.
- Policy *costs*, political capital, cooldowns — explicitly NOT part of the
  canon-first design. Do not add gating.
- `createPolicy` — only `activate`/`suspend`/`repeal` change.

## Git workflow

- Branch: `advisor/035-actions-to-canon`
- Conventional commits, e.g. `feat(policies): policy enactment creates real StorytellerEffect + correct news`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Pure `policyToEffect` helper + test

Create `src/lib/policy-effects.ts`:

```ts
/**
 * Maps an enacted policy to a StorytellerEffect the simulation can consume.
 * Prefers a policy's own modeled effect fields; otherwise applies a modest,
 * bounded default by policy type so every enacted policy nudges the model.
 *
 * ponytail: small heuristic, values clamped to ±10% — intentionally conservative.
 * Upgrade path: if policies gain richer modeled effects, prefer those fields.
 */
export interface PolicyEffectInput {
  policyType: string;
  priority: string;
  gdpEffect: number;
  employmentEffect: number;
  inflationEffect: number;
  taxRevenueEffect: number;
}

export interface DerivedEffect {
  inputType: string;
  value: number; // fraction, e.g. 0.02 = +2%
  duration: number; // IxTime years
}

function clamp(v: number): number {
  return Math.max(-0.1, Math.min(0.1, v));
}

export function policyToEffect(p: PolicyEffectInput): DerivedEffect {
  // 1) Honor an explicit modeled effect if the policy defines one (percent → fraction).
  if (p.gdpEffect) return { inputType: "GDP_ADJUSTMENT", value: clamp(p.gdpEffect / 100), duration: 4 };
  if (p.taxRevenueEffect) return { inputType: "ECONOMIC_POLICY", value: clamp(p.taxRevenueEffect / 100), duration: 4 };
  if (p.employmentEffect) return { inputType: "GROWTH_RATE_MODIFIER", value: clamp(p.employmentEffect / 100), duration: 4 };

  // 2) Otherwise a modest default by type, scaled by priority.
  const base =
    p.priority === "critical" ? 0.02 :
    p.priority === "high" ? 0.015 :
    p.priority === "medium" ? 0.01 : 0.005;

  switch (p.policyType) {
    case "economic": return { inputType: "ECONOMIC_POLICY", value: base, duration: 4 };
    case "infrastructure": return { inputType: "ECONOMIC_POLICY", value: base, duration: 6 };
    case "social": return { inputType: "POPULATION_ADJUSTMENT", value: base * 0.5, duration: 4 };
    case "diplomatic": return { inputType: "SPECIAL_EVENT", value: base * 0.5, duration: 2 };
    case "governance":
    default: return { inputType: "SPECIAL_EVENT", value: base * 0.5, duration: 2 };
  }
}
```

Create `src/lib/policy-effects.test.ts` (Jest, model after any `*.test.ts` in repo):

```ts
import { policyToEffect } from "./policy-effects";

const base = { policyType: "economic", priority: "medium", gdpEffect: 0, employmentEffect: 0, inflationEffect: 0, taxRevenueEffect: 0 };

describe("policyToEffect", () => {
  it("honors an explicit gdpEffect (percent → fraction)", () => {
    expect(policyToEffect({ ...base, gdpEffect: 3 })).toEqual({ inputType: "GDP_ADJUSTMENT", value: 0.03, duration: 4 });
  });
  it("clamps absurd modeled effects to ±10%", () => {
    expect(policyToEffect({ ...base, gdpEffect: 999 }).value).toBe(0.1);
  });
  it("falls back to a type/priority default when no modeled effect", () => {
    expect(policyToEffect({ ...base, policyType: "social", priority: "high" })).toEqual({ inputType: "POPULATION_ADJUSTMENT", value: 0.0075, duration: 4 });
  });
});
```

**Verify**: `bun run test -- src/lib/policy-effects.test.ts` → all pass.

### Step 2: Add three news templates

In `src/lib/diplomatic-news-generator.ts`, extend the `NewsEventType` union with
`| "policy_enacted" | "policy_suspended" | "cabinet_concluded"`, then add to
`NEWS_TEMPLATES`:

```ts
policy_enacted: (ctx) => ({
  content: `${ctx.countryName} enacts new ${ctx.actionType ?? "national"} policy: "${ctx.targetName}".${ctx.reason ? ` ${ctx.reason}` : ""}`,
  hashtags: ["Policy", "Government", "Domestic"],
}),
policy_suspended: (ctx) => ({
  content: `${ctx.countryName} suspends policy "${ctx.targetName}".${ctx.reason ? ` ${ctx.reason}` : ""}`,
  hashtags: ["Policy", "Government", "Domestic"],
}),
cabinet_concluded: (ctx) => ({
  content: `${ctx.countryName}'s cabinet concludes session: "${ctx.targetName}".${ctx.reason ? ` ${ctx.reason}` : ""}`,
  hashtags: ["Cabinet", "Government", "Politics"],
}),
```

**Verify**: `bun run typecheck:file src/lib/diplomatic-news-generator.ts` → exit 0.

### Step 3: Policy enactment creates a real StorytellerEffect + correct news

In `src/server/api/routers/policies/crud.ts`, add imports at top:

```ts
import { IxTime } from "~/lib/ixtime";
import { policyToEffect } from "~/lib/policy-effects";
```

In `activatePolicy`, after the policy is updated (and before/after the existing
notification — order isn't critical), create the effect and tag it with the
policy id so it can be deactivated later:

```ts
const derived = policyToEffect({
  policyType: policy.policyType,
  priority: policy.priority,
  gdpEffect: policy.gdpEffect,
  employmentEffect: policy.employmentEffect,
  inflationEffect: policy.inflationEffect,
  taxRevenueEffect: policy.taxRevenueEffect,
});
await ctx.db.storytellerEffect.create({
  data: {
    countryId: policy.countryId,
    ixTimeTimestamp: new Date(IxTime.getCurrentIxTime() * 1000),
    inputType: derived.inputType,
    value: derived.value,
    duration: derived.duration,
    isActive: true,
    description: `Policy: ${policy.name} (policy:${policy.id}) — ${policy.category}`,
    createdBy: policy.userId,
  },
});
```

Then change the `generateDiplomaticNews` call's event type from
`"free_trade_signed"` to `"policy_enacted"` and add `actionType: policy.category`
to its context object.

### Step 4: Deactivate the effect on suspend/repeal + fix suspend news

A repealed or suspended policy must stop affecting the model. In both
`suspendPolicy` and `repealPolicy`, after the status update, deactivate the
policy's effect(s):

```ts
await ctx.db.storytellerEffect.updateMany({
  where: { countryId: policy.countryId, isActive: true, description: { contains: `(policy:${policy.id})` } },
  data: { isActive: false },
});
```

In `suspendPolicy`, change its news event type from `"sanction_imposed"` to
`"policy_suspended"`. Leave `repealPolicy`'s `"policy_lifted"` as-is (it reads
acceptably for a repeal).

**Verify**: `bun run typecheck:file src/server/api/routers/policies/crud.ts` → exit 0.

### Step 5: Cabinet meeting → minutes news

In `src/server/api/routers/quickactions/meetings.ts`, add the import:

```ts
import { generateDiplomaticNews } from "~/lib/diplomatic-news-generator";
```

In `completeMeeting`, after the `cabinetMeeting.update(... status: "completed" ...)`
and after computing `discussedCount` (it's computed inside the notification
`try` — recompute or lift it), fire minutes news (fire-and-forget):

```ts
const country = await ctx.db.country.findUnique({
  where: { id: meeting.countryId },
  select: { name: true },
});
const discussed = meeting.agendaItems.filter((i) => i.status === "discussed").length;
void generateDiplomaticNews(ctx.db, meeting.countryId, "cabinet_concluded", {
  countryName: country?.name ?? "Government",
  targetName: meeting.title,
  reason: `${discussed} agenda item${discussed === 1 ? "" : "s"} resolved.`,
}).catch((err) => console.error("[QuickActions] Failed to generate meeting minutes news:", err));
```

**Verify**: `bun run typecheck:file src/server/api/routers/quickactions/meetings.ts` → exit 0.

## Test plan

- New: `src/lib/policy-effects.test.ts` — covers the modeled-effect path, the
  ±10% clamp (a sim/value safety bound), and the type/priority default. This is
  the non-trivial logic; the router edits are wiring verified by typecheck.
- Structural pattern: any existing `*.test.ts` (e.g. `src/server/api/routers/__tests__/policies.test.ts`).
- Manual/browser verification (note for reviewer, not required to pass): enacting
  a policy creates a `DmInputs` row tagged `(policy:<id>)` and a ThinkPages post;
  repealing it flips that row's `isActive` to false.

## Done criteria

ALL must hold:

- [ ] `policyToEffect` exists in `src/lib/policy-effects.ts`; test passes
- [ ] `NewsEventType` includes `policy_enacted`, `policy_suspended`, `cabinet_concluded`, each with a `NEWS_TEMPLATES` entry
- [ ] `activatePolicy` creates a `StorytellerEffect` tagged `(policy:<id>)` and posts `policy_enacted` news
- [ ] `suspendPolicy` + `repealPolicy` deactivate the policy's effect; `suspendPolicy` posts `policy_suspended`
- [ ] `completeMeeting` posts `cabinet_concluded` news (fire-and-forget)
- [ ] All `bun run typecheck:file` commands above exit 0
- [ ] `bun run test -- src/lib/policy-effects.test.ts` passes
- [ ] `bun run lint` exits 0
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any "Current state" excerpt doesn't match the live code (drift), especially the
  `StorytellerEffect`/`Policy` field names — a wrong field name silently breaks
  the effect.
- `IxTime.getCurrentIxTime()` is not the IxTime API in `src/lib/ixtime.ts`
  (confirm before using).
- `generateDiplomaticNews` no longer fire-and-forgets or its signature changed.
- Creating the `StorytellerEffect` requires a non-null field this plan doesn't set.

## Maintenance notes

- The `(policy:<id>)` tag in the effect `description` is the link between a Policy
  and its sim effect. If a structured FK is ever added, migrate the suspend/repeal
  `updateMany` to use it instead of a `contains` match.
- The `policyToEffect` defaults are deliberately small and capped. If balancing
  shows policies feel inert, raise the `base` values — but keep the ±10% clamp;
  it's the guardrail against a policy nuking a country's economy (a Burg concern:
  changes stay formula-bound and visible).
- Plan 037 (canon feed) will surface these `StorytellerEffect` rows and ThinkPages
  posts chronologically — landing 035 makes that feed substantially richer.
- Reviewer: confirm news calls are never awaited on the request path, and that
  repeal/suspend reliably finds the effect to deactivate (test with a policy that
  was enacted then repealed).
