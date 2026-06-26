# Plan 041: Stability resolution → canon news

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7b4bbf73..HEAD -- src/server/api/routers/security/stability.ts src/lib/diplomatic-news-generator.ts src/server/api/routers/security/__tests__/stability.test.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `7b4bbf73`, 2026-06-16
- **Issue**: (none)

## Why this matters

The security/stability subsystem already creates and resolves internal security events (`securityEvent` table), but resolving an event currently only sends a private notification. Turning the resolution into an auto-generated ThinkPages post makes stability management part of the shared canon, consistent with how diplomacy, elections, and military conflicts already produce public news.

## Current state

- `src/server/api/routers/security/stability.ts` — stability router. `resolveSecurityEvent` (lines ~440–499) updates a `securityEvent` row to `status: "resolved"` and sends a `notificationAPI.create` call, but it does not generate public canon news.
- `src/lib/diplomatic-news-generator.ts` — shared news template engine. It has templates for `military_deployed`, `operation_ended`, `election_result`, and conflict events. There is no template for security/stability events yet.
- Existing news calls use the fire-and-forget pattern: `void generateDiplomaticNews(ctx.db as any, countryId, eventType, context)`.
- Existing security router tests (if any) are in `src/server/api/routers/security/__tests__/`. The Plan 040 executor created `operations.test.ts` there; model new tests after that file.

## Commands you will need

| Purpose   | Command                                                         | Expected on success        |
|-----------|-----------------------------------------------------------------|----------------------------|
| Test      | `bun run test -- src/server/api/routers/security/__tests__/stability.test.ts` | all pass                   |
| Lint      | `bun run lint`                                                  | exit 0, no new errors      |
| Typecheck | `bun run typecheck:file src/server/api/routers/security/stability.ts`        | exit 0                     |
| Typecheck | `bun run typecheck:file src/lib/diplomatic-news-generator.ts`                | exit 0                     |

## Scope

**In scope**:
- `src/lib/diplomatic-news-generator.ts` — add `security_event_resolved` event type + template.
- `src/server/api/routers/security/stability.ts` — fire the news call in `resolveSecurityEvent` after the event is resolved.
- `src/server/api/routers/security/__tests__/stability.test.ts` — create this test file covering the news call.

**Out of scope**:
- Do not change the `generateStabilityEvent` mutation or add a "declared" template unless the resolution template is trivial and already done.
- Do not change the public response shape of `resolveSecurityEvent`.
- Do not modify notification behavior; keep the existing notification call.

## Git workflow

- Branch: `advisor/041-stability-resolution-canon-news`
- Commit style: conventional commits, e.g. `feat(news): add security_event_resolved template`, `feat(security): fire canon news on security event resolution`, `test(security): cover stability resolution news`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add the security-event-resolved news template

Open `src/lib/diplomatic-news-generator.ts`.

1. Add `"security_event_resolved"` to the `NewsEventType` union (around line 33).
2. Add a `security_event_resolved` entry to `NEWS_TEMPLATES` that produces content like:
   ```ts
   security_event_resolved: (ctx) => ({
     content: `${ctx.countryName} has resolved a ${ctx.severity ?? "security"} incident: ${ctx.eventType ?? "security event"}. ${ctx.notes ? `Official statement: "${ctx.notes}"` : "Stability operations concluded successfully."}`,
     hashtags: ["Security", "Stability", "DomesticAffairs"],
   }),
   ```
   Use the existing templates' style for truncation; the generator already truncates to 280 chars.

**Verify**: `bun run typecheck:file src/lib/diplomatic-news-generator.ts` → exit 0.

### Step 2: Fire the news call when a security event is resolved

Open `src/server/api/routers/security/stability.ts`.

1. Ensure `generateDiplomaticNews` is imported from `~/lib/diplomatic-news-generator`.
2. In `resolveSecurityEvent`, after the existing `notificationAPI.create` block and before `return resolved`, add:
   ```ts
   // Canon news: security/stability event resolved
   void generateDiplomaticNews(ctx.db as any, event.countryId, "security_event_resolved", {
     countryName: country?.name ?? "A nation",
     eventType: resolved.eventType,
     severity: resolved.severity,
     notes: input.resolutionNotes,
   });
   ```
   To obtain `country.name`, fetch the country in the existing `event` lookup by changing the `select` to `include: { country: { select: { name: true } } }` or add a separate `ctx.db.country.findUnique` call. Prefer the smallest change that gives you `countryName`.

**Verify**: `bun run typecheck:file src/server/api/routers/security/stability.ts` → exit 0.

### Step 3: Add tests

Create `src/server/api/routers/security/__tests__/stability.test.ts`.

Mock `~/lib/diplomatic-news-generator` and `~/lib/notification-api` the same way `operations.test.ts` (from Plan 040) does. Use `securityOperationsRouter.createCaller`? No — this plan is in `securityStabilityRouter`, so use that router's `createCaller` with a mock context that includes `db` and `auth.userId`.

Write one test: "fires security_event_resolved news when resolving a security event". Assert `generateDiplomaticNews` is called once with:
- countryId = the event's countryId
- eventType = `"security_event_resolved"`
- context containing `countryName`, `eventType`, `severity`.

**Verify**: `bun run test -- src/server/api/routers/security/__tests__/stability.test.ts` → all pass.

### Step 4: Lint

Run `bun run lint` and fix any errors you introduced.

## Done criteria

- [ ] `bun run typecheck:file src/lib/diplomatic-news-generator.ts` exits 0.
- [ ] `bun run typecheck:file src/server/api/routers/security/stability.ts` exits 0.
- [ ] `bun run test -- src/server/api/routers/security/__tests__/stability.test.ts` passes.
- [ ] `bun run lint` exits 0 with no new errors.
- [ ] `git diff --stat` shows only in-scope files changed.
- [ ] `plans/README.md` status row for Plan 041 updated to DONE.

## STOP conditions

Stop and report if:
- The `resolveSecurityEvent` procedure does not exist at the location described, or its shape differs materially (e.g., no `notificationAPI.create` block).
- `diplomatic-news-generator.ts` does not contain the `NewsEventType` union or `NEWS_TEMPLATES` record.
- Adding the news call requires changing an out-of-scope file.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Future stability event types (protest, crime_wave, riot, civil_unrest) will automatically flow through the `eventType` context field.
- If severity-based tone is added later, the template is the single place to adjust.
- Reviewers should check that the news call is fire-and-forget (`void`) so a ThinkPages-account miss cannot break event resolution.
