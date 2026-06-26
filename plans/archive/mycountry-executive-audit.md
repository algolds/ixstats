# MyCountry Executive — Live-Wiring Audit & Remediation

> Canonical copy will be saved to `plans/mycountry-executive-audit.md` (untracked) on execution.

## Context

The user asked to audit all MyCountry **executive** features/systems/schemas and make
everything 100% live-wired and ready. Prompted by a Prisma bug in `addAgendaItem`
(`estimatedDuration`/`priority` weren't real columns), now fixed. The audit (UI + API +
schema) found the executive UI is **~95% live** against real tRPC/DB; the gaps are a
cluster of latent schema-mismatch bugs in `meetings.ts` plus two minor UI items.

**User decisions:** (1) **fix the broken endpoints in place** to the schema (no DB
migration); (2) also **implement the ActivityPlanner month view**, **wire the
QuickActionsPanel policy buttons**, and **normalize seed enum vocab**.

## Workstream 1 — Fix `meetings.ts` schema mismatches (in place, no DB change)

These endpoints spread raw `input`/`data` into Prisma with non-existent columns (they
throw at runtime, same class as the agenda bug). **None are called by the UI** (it uses
the correct `quickActions.*`), but fix them for correctness. Replace each raw spread
with an explicit `data` object referencing only real columns — the pattern already used
in the shipped `addAgendaItem`/`updateAgendaItem` fix; canonical mappings live in
`quickactions.ts` `createDecision` (~1280) / `createActionItems` (~1334).

| Endpoint (line) | Fix |
|---|---|
| `updateMeeting` (83) | `data: { title, duration, status, ...(date && { scheduledDate: date }) }`; drop `location`/`purpose` |
| `recordDecision` (303) | `{ meetingId, agendaItemId, title, description, decisionType, implementationStatus: "pending" }`; pack votes into `votingResult` JSON; drop `outcome` |
| `updateDecision` (335) | `data: { title, description }`; drop `outcome`/`notes` |
| `createActionItem` (355) | map `assignedToId` → `assignedTo`; keep `priority`, `dueDate`, `decisionId`, `agendaItemId` |
| `updateActionItem` (397) | map `notes` → `completionNotes` |
| `getActionItems` (374) | `where.assignedTo = input.officialId` (was `assignedToId`) |
| `updateDepartment` (573) | drop `budget` (no column; `BudgetAllocation` relation) |

File: `src/server/api/routers/meetings.ts`. Keep input schemas intact (no client/type
break); only the Prisma `data`/`where` objects change.

## Workstream 2 — ActivityPlanner month view

`src/components/quickactions/ActivityPlanner.tsx`. The month `dateRange` (L87-90),
`activitiesByDay` map (L147), nav handlers (L129-139), and the `getActivitySchedule`
query already support `"month"` — **only the render is a "coming soon" stub** (L428-435).
Replace it with a month calendar grid:
- Add a `monthDays` memo: `startOfWeek(startOfMonth(selectedDate),{weekStartsOn:1})` →
  `endOfWeek(endOfMonth(selectedDate),{weekStartsOn:1})` (import `startOfMonth`,
  `endOfMonth`, `eachDayOfInterval`, `isSameMonth` from `date-fns`).
- Render Mon-Sun weekday headers + a 7-col grid of day cells; each cell shows the day
  number and that day's activities from `activitiesByDay.get(format(day,"yyyy-MM-dd"))`
  using the existing `ActivityCard` (compact). Dim out-of-month days (`isSameMonth`),
  highlight today (`isSameDay`), reuse the week-view cell styling.
- (Bonus) enable the disabled "Create Policy" button at L255 via Workstream 3's pattern.

## Workstream 3 — Wire QuickActionsPanel policy buttons

`src/components/quickactions/QuickActionsPanel.tsx`. Two "Create Policy" buttons
(L132, L165) currently `notify.info(...)` redirect. Mirror the existing modal pattern
(it already has `showMeetingScheduler` state + renders `<MeetingScheduler>`):
- Add `const [showPolicyCreator, setShowPolicyCreator] = useState(false)`.
- Change both buttons' `onClick` to `setShowPolicyCreator(true)`.
- Render `<PolicyCreatorSheet countryId={countryId} open={showPolicyCreator}
  onOpenChange={setShowPolicyCreator} ... />` near the `<MeetingScheduler>` at the
  bottom — copy the exact prop set from the working usage in
  `src/components/executive/ExecutiveWarRoom.tsx:381` (refetch overview on success).
- `PolicyCreatorSheet` is in `src/components/executive/PolicyCreatorSheet.tsx`
  (props: `countryId, open, onOpenChange, …`).

## Workstream 4 — Normalize seed enum vocab (meeting domain only)

`src/lib/demo-seed/seed-fallbacks.ts`. Scope **tightly** to the meeting/cabinet domain
(agenda/decision/action-item/attendance) so values match the router input enums + UI
lookups; **leave unrelated models alone** (policies/notifications/crises priorities are
intentional and use plain String columns — no runtime impact). At implementation:
- Verify the exact `attendanceStatus`/`priority` strings seeded for meeting models.
- Map any out-of-range value to the canonical router enum (e.g. attendance →
  `invited|confirmed|attended|declined|absent`). Note: action-item priority `urgent`/
  `normal` are already supported by the UI's `PRIORITY_COLORS`, so prefer widening the
  `meetings.ts` action-item priority enum to include them over rewriting seed data —
  decide per value during implementation, favoring the value the UI already renders.

## Verification

- `bun run lint` on the four touched files.
- Dev server (already running): Executive → schedule a meeting + add agenda item (no
  Prisma errors); ActivityPlanner → switch to Month tab (calendar renders with seeded
  activities, prev/next/today navigate); QuickActions → "Create Policy" opens the
  creator sheet and a created policy appears in the Policies panel.
- For the `meetings.ts` fixes (UI-unused), rely on `bun run typecheck:trpc`/`:server`
  (user runs these) to confirm the explicit `data` objects type-check against the Prisma
  client. **Do NOT run global typecheck.**
- Re-grep `meetings.ts` for any remaining `data: input` / `...data` raw spreads.
