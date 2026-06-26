# Plan 034: DM event injection — deliberately seed narrative issues to a target

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f3a52c4a..HEAD -- src/server/api/routers/national-issues/ src/lib/national-issues-engine.ts`
> If these changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (pairs with plan 033 — together they replace auto-spawn with DM-spawn)
- **Category**: direction
- **Planned at**: commit `f3a52c4a`, 2026-06-15

## Why this matters

Stakeholder feedback explicitly asked for events that "happen organically
inasmuch as community mods can do community-wide dungeon master event stuff."
The National Issues engine already has the exact primitive for this:
`NationalIssuesEngine.forceGenerate(templateId, countryId, db)` deliberately
instantiates a chosen template against a country, **bypassing trigger
conditions** — it's how the guest-splash seed works
([national-issues/templates.ts:49](../src/server/api/routers/national-issues/templates.ts#L49)).

Today that primitive is reachable only from internal seed code. This plan exposes
it as a deliberate **"inject narrative event"** admin action a DM can use to drop
a hand-picked event onto one country, a region, a continent, or the whole world —
turning the issue system from an algorithm that *forces* chores onto players into
a tool that lets human storytellers *offer* prompts. Combined with plan 033
(auto-generation off by default), DM injection becomes the primary, intentional
source of issues.

## Current state

- **The primitive** — `src/lib/national-issues-engine.ts:812`:

  ```ts
  static async forceGenerate(
    templateId: string,
    countryId: string,
    db: PrismaClient,
    parentIssueId?: string
  ): Promise<string | null> {
    // loads template, builds country snapshot, renders + creates a nationalIssue,
    // bypassing trigger conditions. Returns the created issue id, or null on failure.
  }
  ```

- **The admin router** — `src/server/api/routers/national-issues/templates.ts`
  uses `adminProcedure` for all template CRUD and already imports the engine:

  ```ts
  import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
  import { NationalIssuesEngine } from "~/lib/national-issues-engine";
  ```

  It is registered as part of `nationalIssuesRouter` (root.ts:190), reachable at
  `api.nationalIssues.*`. Add the new mutation here.

- **The existing seed tags issues** via `triggerReason` so they're identifiable
  ([templates.ts:51-54](../src/server/api/routers/national-issues/templates.ts#L51)):
  `data: { triggerReason: SPLASH_SHOWCASE_TAG }`. Reuse this tagging convention
  for DM events.

- **Targeting fields** — the `Country` model has `continent String?` and
  `region String?` (both indexed), so region/continent broadcast is a simple
  `findMany({ where: { continent } })`.

- **Admin UI exists** — `src/app/admin/national-issues/page.tsx` already renders
  the template management interface (consumes `api.nationalIssues.*`).

**Convention to follow**: match the existing `adminProcedure` mutations in
`templates.ts` (Zod input, `ctx.db`, `TRPCError` for failures, `ctx.auth!.userId`
for author attribution as in `createTemplate`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck (file) | `bun run typecheck:file src/server/api/routers/national-issues/templates.ts` | exit 0, no errors |
| Typecheck (file) | `bun run typecheck:file src/server/api/routers/national-issues/index.ts` | exit 0, no errors |
| Lint | `bun run lint` | exit 0 (pre-existing warnings tolerated) |

(Never run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build` — they OOM the server.)

## Scope

**In scope**:
- `src/server/api/routers/national-issues/templates.ts` (add `injectEvent` mutation)
- `src/app/admin/national-issues/page.tsx` (OPTIONAL Step 3 — minimal "Inject"
  control, only if the page's patterns are clear; otherwise deliver backend-only)

**Out of scope** (do NOT touch):
- `src/lib/national-issues-engine.ts` — `forceGenerate` is used as-is, not modified.
- The auto-generation / deadline / credit gating — that is plan 033.
- Any non-admin procedure — injection is admin/DM only.

## Git workflow

- Branch: `advisor/034-dm-event-injection`
- Conventional commits, e.g. `feat(issues): add DM event injection (forceGenerate to target country/region/all)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the `injectEvent` mutation

In `src/server/api/routers/national-issues/templates.ts`, add a new
`adminProcedure` mutation inside `nationalIssuesTemplatesRouter`. Target a single
country or broadcast by region/continent/all. Tag every created issue via
`triggerReason` so DM events are identifiable and auditable. Cap broadcast size
so a misclick can't spawn hundreds of issues.

```ts
const DM_EVENT_TAG = "DM event";
const MAX_BROADCAST = 100; // safety cap on a single injection

// ... inside nationalIssuesTemplatesRouter: {

injectEvent: adminProcedure
  .input(
    z.object({
      templateId: z.string(),
      target: z.discriminatedUnion("scope", [
        z.object({ scope: z.literal("country"), countryId: z.string() }),
        z.object({ scope: z.literal("region"), region: z.string() }),
        z.object({ scope: z.literal("continent"), continent: z.string() }),
        z.object({ scope: z.literal("all") }),
      ]),
      label: z.string().max(100).optional(), // DM note, e.g. "Spring Festival arc"
    })
  )
  .mutation(async ({ ctx, input }) => {
    // Verify the template exists up front (clear error instead of silent nulls)
    const template = await ctx.db.nationalIssueTemplate.findUnique({
      where: { id: input.templateId },
      select: { id: true, slug: true },
    });
    if (!template) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
    }

    // Resolve the target country ids
    let countryIds: string[];
    if (input.target.scope === "country") {
      countryIds = [input.target.countryId];
    } else {
      const where =
        input.target.scope === "region"
          ? { region: input.target.region }
          : input.target.scope === "continent"
            ? { continent: input.target.continent }
            : {}; // "all"
      const countries = await ctx.db.country.findMany({ where, select: { id: true } });
      countryIds = countries.map((c) => c.id);
    }

    if (countryIds.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No countries match the target" });
    }
    if (countryIds.length > MAX_BROADCAST) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Target matches ${countryIds.length} countries (max ${MAX_BROADCAST} per injection)`,
      });
    }

    const tag = `${DM_EVENT_TAG}: ${input.label ?? template.slug} [by ${ctx.auth!.userId}]`;
    const issueIds: string[] = [];
    for (const countryId of countryIds) {
      const issueId = await NationalIssuesEngine.forceGenerate(
        input.templateId,
        countryId,
        ctx.db as any
      );
      if (issueId) {
        await ctx.db.nationalIssue.update({
          where: { id: issueId },
          data: { triggerReason: tag },
        });
        issueIds.push(issueId);
      }
    }

    return { created: issueIds.length, requested: countryIds.length, issueIds };
  }),
```

Notes:
- `TRPCError` is already imported in this file. `z` is already imported.
- `forceGenerate` bypasses trigger conditions by design — that is what makes this
  a *deliberate* DM action rather than the auto-engine.
- Issues created carry the template's `deadlineDaysBase` deadline if the template
  defines one; in narrative mode (plan 033) deadlines don't force anything, so
  this is harmless. DMs who want a hard deadline use a template that sets one.

**Verify**: `bun run typecheck:file src/server/api/routers/national-issues/templates.ts` → exit 0.

### Step 2: Confirm the endpoint is reachable

The mutation is added to a router already merged into `nationalIssuesRouter`, so
no `root.ts` change is needed. Confirm the index still typechecks:

`bun run typecheck:file src/server/api/routers/national-issues/index.ts` → exit 0.

Confirm the new path exists:
`grep -n "injectEvent" src/server/api/routers/national-issues/templates.ts` → 1 match.

### Step 3 (OPTIONAL): Minimal admin UI control

Open `src/app/admin/national-issues/page.tsx`. If it already lists templates with
a clear per-row action pattern (buttons/menus calling `api.nationalIssues.*`
mutations via `useMutation`), add an **"Inject"** action that calls
`api.nationalIssues.injectEvent.useMutation()` for the selected template, with a
small form for scope (country/region/continent/all) + optional label, and shows
the returned `{ created, requested }` in a toast/notice.

**If the page's structure is not obvious, or wiring a form would require
guessing component conventions, STOP here and report** — deliver the backend
mutation (Steps 1–2) and note the admin UI as a follow-up. Do not invent UI
patterns; the backend procedure is the load-bearing deliverable.

## Test plan

- No new automated test is required for the happy path (it depends on DB state
  and the engine). The verification gates are typecheck + lint + the `grep`
  reachability check.
- If you want a guard: a thin unit test asserting `injectEvent` rejects an
  unknown `templateId` (`NOT_FOUND`) and rejects an over-cap broadcast is
  valuable but requires a tRPC caller harness — only add it if one already
  exists in `src/server/api/routers/__tests__/`. Otherwise skip (YAGNI).

## Done criteria

ALL must hold:

- [ ] `injectEvent` mutation exists in `templates.ts`, `adminProcedure`-gated
- [ ] It supports `country` / `region` / `continent` / `all` targets and caps broadcast at `MAX_BROADCAST`
- [ ] Created issues are tagged via `triggerReason` (DM event + label + author)
- [ ] `bun run typecheck:file` passes for `templates.ts` and `index.ts`
- [ ] `grep -n "injectEvent" src/server/api/routers/national-issues/templates.ts` → 1 match
- [ ] `bun run lint` exits 0
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `forceGenerate`'s signature differs from the "Current state" excerpt.
- `adminProcedure` or `ctx.auth!.userId` is not how this file authenticates
  admins (match whatever `createTemplate` does).
- Step 3: the admin page structure is unclear — deliver backend-only and report.
- The `Country` model lacks `continent`/`region` (drift) — region/continent
  targeting can't work; report instead of inventing fields.

## Maintenance notes

- Authorization is currently `adminProcedure` — admins act as the DMs. The
  documented upgrade path is a dedicated "moderator/DM" role; when that exists,
  swap the procedure guard, not the logic.
- DM-injected issues are queryable by `triggerReason` starting with `"DM event:"`
  — useful for an audit view or a "clear this DM arc" admin tool later.
- This is the intended primary issue source once plan 033 turns auto-generation
  off. If both 033 and 034 are live, the loop is: DM authors a template (existing
  `createTemplate`) → DM injects it to a target (this plan) → players see an
  optional prompt → resolving it produces real effects + canon (plan 035/037).
- Reviewer: scrutinize the broadcast cap and the target resolution (a typo in a
  region string should yield "No countries match", not a silent no-op).
