# Cards, Vault, and Admin System Improvement Plan

This document expands the high-level fixes and provides concrete implementation steps, owners, effort estimates, and verification commands so engineers can implement each change with minimal ambiguity.

## Summary

- **Scope**: Cards marketplace, Vault admin UI, WikiOS sidebar, admin wiki tooling, CSP for media, dropdown z-indexes, lorewards scheduler.
- **Goal**: Produce small, isolated changes with clear rollout and test guidance; avoid global refactors or heavy typechecks across the repository.

## Implementation Roadmap (per-change)

---

### 1. Request Lore Card: CSP Sounds Fix
- **Files**: [src/proxy.ts](src/proxy.ts)
- **Owner**: @frontend
- **Priority**: High
- **Effort**: 0.5 - 1 hour
- **Problem**: CSP templates in `buildCSPTemplate` omit `media-src`, causing `.mp3`/.ogg assets loaded from `https://ixwiki.com` to be blocked in some browsers.
- **Implementation Steps**:
  1. Open `src/proxy.ts` and locate `buildCSPTemplate`.
  2. Add `media-src 'self' https://ixwiki.com;` to the CSP string (append to directives block).
  3. Restart dev server and validate header value.
- **Example patch**:

```diff
@@ src/proxy.ts
 - default-src 'self';
 + default-src 'self'; media-src 'self' https://ixwiki.com;
```

- **Verification**:
  - Run the dev server: `bun run dev` and open `/vault`.
  - Confirm console contains no `ERR_BLOCKED_BY_CSP` for sound assets.

---

### 2. Card Marketplace User ID Alignment
- **Files**: [src/server/api/routers/card-market.ts](src/server/api/routers/card-market.ts)
- **Owner**: @backend
- **Priority**: Critical (affects money flows)
- **Effort**: 2 - 4 hours
- **Problem**: tRPC procedures pass Clerk `userId` strings but services expect database CUIDs (`User.id`). Notification sending currently compares incompatible IDs.
- **Implementation Steps**:
  1. Audit `card-market.ts` procedures for usages of `ctx.auth.userId` and replace with `ctx.user?.id` (the DB user object provided by auth middleware). If `ctx.user` is not present, add a helper `getDbUser(ctx.auth.userId)` to map Clerk ID → DB user.
  2. Update `auctionService` functions signatures to accept both `userId` (db) and `clerkId` when necessary, or ensure callers translate to the DB `id` before calling service functions.
  3. Where notifications are sent, call `notificationAPI.sendToClerkId(clerkUserId, payload)` after converting DB IDs to Clerk IDs via a small lookup.
  4. Extend `getAuctionHistory` to accept optional filters `{ clerkId?: string; dbUserId?: string }` and sanitize inputs.

- **Code hints**:

```ts
// helper
async function clerkIdToDbUserId(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
}

// usage in router
const dbUserId = ctx.user?.id ?? (await clerkIdToDbUserId(ctx.auth.userId)).id;
```

- **Verification**:
  - Run the marketplace flow: create auction, place bid, complete buyout; assert `auction.sellerId` and `auction.buyerId` are DB CUIDs and that notifications go to correct Clerk IDs.

---

### 3. Z-Index Depth Sweep
- **Files**:
  - [src/styles/glass-refraction.css](src/styles/glass-refraction.css)
  - [src/components/ui/select.tsx](src/components/ui/select.tsx)
  - [src/components/ui/dropdown-menu.tsx](src/components/ui/dropdown-menu.tsx)
  - [src/components/ui/autocomplete.tsx](src/components/ui/autocomplete.tsx)
- **Owner**: @frontend
- **Priority**: Medium
- **Effort**: 1 - 2 hours
- **Problem**: Overlay components rendered inside dialogs are visually occluded due to inconsistent z-index values and a missing `--z-tooltip` variable.
- **Implementation Steps**:
  1. Add `--z-tooltip: 100020;` to `:root` in `src/styles/glass-refraction.css`.
  2. Update the Tailwind `className`s for overlay content components to use `z-[100020]`.
  3. Ensure Radix portals are mounted at document root where dialogs are also mounted (verify portals/roots in `document` body).

- **Diff example**:

```diff
@@ src/styles/glass-refraction.css
 :root {
-  /* existing vars */
+  --z-tooltip: 100020;
 }
```

- **Verification**:
  - Open "Create Pack" modal and interact with Select / Dropdown / Autocomplete. They should render above the modal surface.

---

### 4. Admin Wiki Management Wiring
- **Files**: [src/app/admin/wiki/page.tsx](src/app/admin/wiki/page.tsx)
- **Owner**: @backend-frontend
- **Priority**: Medium
- **Effort**: 1 - 2 hours
- **Problem**: Save callbacks are stubbed with `console.log` and do not persist edits.
- **Implementation Steps**:
  1. Import `useNotify` from `~/hooks/useNotify` and `api` utils from `~/utils/api`.
  2. Replace `console.log` in `handleSave` with `api.admin.setWikiLink.useMutation()` and call `notify.success()` on success.
  3. In `handleLinkSelected`, call `api.admin.bulkSetWikiLinks.useMutation()` and invalidate `utils.countries.getAll`.
  4. Add loading and error states to the form buttons.

- **Verification**:
  - Use the manual link editor to map a page and confirm the country record updates in the UI and DB.

---

### 5. Expandable WikiOS Sidebar
- **Files**:
  - [src/components/wikios/shared/WikiOSLayout.tsx](src/components/wikios/shared/WikiOSLayout.tsx)
  - [src/styles/wikios.css](src/styles/wikios.css)
- **Owner**: @frontend
- **Priority**: Low
- **Effort**: 2 - 3 hours
- **Implementation Steps**:
  1. Add a `useState<boolean>` `expanded` with initial value from `localStorage.getItem('wikios-sidebar-expanded') === 'true'`.
  2. Toggle rendering to show labels when `expanded`.
  3. Add an accessible chevron toggle button at the bottom of the sidebar.
  4. Update `wikios.css` with `.wikios-sidebar.expanded { width: 220px; }` and transition rules.

- **Verification**:
  - Toggle the sidebar and reload page; ensure state persisted and labels shown when expanded.

---

### 6. Daily Lorewards Sync Scheduler
- **Files**: [server.mjs](server.mjs), [src/lib/lorewards-sync.ts](src/lib/lorewards-sync.ts)
- **Owner**: @infra
- **Priority**: Low
- **Effort**: 30 - 60 minutes
- **Implementation Steps**:
  1. Add `node-cron` import in `server.mjs` (install with `bun add node-cron` if missing).
  2. Schedule a job: `cron.schedule('0 6 * * *', () => fullSync())` (UTC 06:00).
  3. Ensure `fullSync` is idempotent and guarded to avoid overlap (use a mutex flag or short TTL lock in Redis).

- **Verification**:
  - Manually trigger the cron function in dev and validate winners list updated.

---

### 7. Vault Admin Panel Enhancements
- **Files**:
  - [src/server/api/routers/vault.ts](src/server/api/routers/vault.ts)
  - [src/app/admin/cards/VaultAdmin.tsx](src/app/admin/cards/VaultAdmin.tsx)
- **Owner**: @backend-frontend
- **Priority**: Medium
- **Effort**: 3 - 6 hours
- **Implementation Steps**:
  1. Add tRPC protected admin endpoints:
     - `adminAdjustStreak({ userId: string, delta: number })`
     - `adminListUserTransactions({ userId: string, limit?: number })`
  2. Implement DB-side transaction query with date filters and pagination.
  3. Add dialogs in `VaultAdmin.tsx`: `AdjustStreakDialog` and `TransactionHistoryDialog` that call the new endpoints.

- **Verification**:
  - Use admin UI to search a user, open history and streak dialogs; perform adjustments and confirm DB reflects changes.

## PR & Rollout Checklist

- **Before PR**:
  - Limit scope to the smallest subset of files that fix the problem.
  - Add unit tests for helper functions when appropriate (e.g., Clerk→DB ID mapping).
  - Run focused typecheck for changed files only, example:

```bash
bun run typecheck:file src/server/api/routers/card-market.ts
bun run typecheck:components
```

- **PR Description**:
  - Explain root cause, list modified files, testing steps, and rollback steps.

- **After Merge / Deploy**:
  - Monitor logs for errors and user reports for 24 hours.
  - If a change causes regressions, revert the PR and open an incident with a short postmortem.

## Verification Commands (quick)

 - Start dev server: `bun run dev`
 - Run focused typecheck on server router: `bun run typecheck:file src/server/api/routers/card-market.ts`
 - Run Jest tests (single test): `bun run test -- src/lib/some.test.ts`

## Notes and Risks

- Avoid running global `tsc --noEmit` (project memory limits). Use per-file typechecks as above.
- When adding scheduled jobs in `server.mjs`, ensure they are safe to run in multiple instances or guarded by a distributed lock.

---

If you want, I can now implement one of the changes (CSP, z-index, or marketplace ID mapping). Tell me which to do first and I'll apply a patch and run focused checks.
