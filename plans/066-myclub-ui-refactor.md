# Plan 066: Refactor MyClub Team Page UI (Tactile Clubhouse + Embedded Tablet)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0c488008..HEAD -- src/app/myclub/[teamId]/page.tsx`
> If the page file has changed, compare the "Current state" references against the live file before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `0c488008`, 2026-06-30

## Why this matters

The current MyClub team dashboard uses generic cards and layouts, which can feel sterile and typical of AI-generated dashboards. To bring "soul" and emotional connection to the club management loop, this plan refactors the UI to represent an interactive **Manager's Desk**. It wraps the dashboard sections in a tactile dark-green leather blotter with wood-grain backgrounds and brass accents, embedding a sleek "Tablet UI" display inside it. This tactile clubhouse theme makes roster building, tactics selection, and transfer management feel authentic to a real sporting franchise.

## Current state

- `src/app/myclub/[teamId]/page.tsx` — The monolith page rendering all sections (`overview`, `roster`, `tactics`, `transfers`, `management`).
- Layout style is currently standard Next.js + Tailwind CSS with a standard `MyLeagueSidebarLayout`.

Conventions: Utilize Tailwind CSS styling inside `page.tsx` and custom inline style structures or Tailwind utility classes. Make sure all styling is fully responsive.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Dev Run   | `bun run dev`            | server starts       |
| Typecheck | `bun run typecheck:ui`   | exit 0, no errors   |
| Format    | `bun run format:write`   | files formatted     |

## Scope

**In scope**:
- `src/app/myclub/[teamId]/page.tsx`

**Out of scope**:
- Modifying any of the underlying backend tRPC APIs or mutation queries (keep data fetching and state identical).
- Modifying the sub-pages like `src/app/myclub/[teamId]/season/` (only the main dashboard is refactored).

## Steps

### Step 1: Design the Clubhouse Frame & Desk Blotter Container

Refactor `MyClubTeamDetailPage`'s outer container in `src/app/myclub/[teamId]/page.tsx` to establish the desk blotter workspace:
1. Wrap the entire page in a wood-grain backdrop:
   ```css
   background: radial-gradient(ellipse at center, #2c1406 0%, #150800 100%);
   ```
2. Wrap the core sidebar layout in a tactile desk blotter:
   - Base color: `bg-[#0c2417]` (deep green leather/felt).
   - Border stitching: `border-2 border-dashed border-amber-800/40`.
   - Box shadow: `shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.05)]`.
   - Rounded corners: `rounded-[2.5rem]`.
3. Add brass corner brackets or brass rivets to the blotter framing:
   - Use custom gold/brass gradient backgrounds (`from-amber-600 via-yellow-500 to-amber-700`) on the page header and accents.

**Verify**: Run `bun run typecheck:ui` → exits 0.

### Step 2: Implement the Embedded Tablet Display

Within the green blotter workspace, render the main content sections inside a simulated "Tablet screen":
1. The tablet frame should use a sleek dark-slate bezel:
   ```className
   border-[12px] border-slate-900 rounded-[2rem] bg-slate-950/90 shadow-inner overflow-hidden
   ```
2. The tab views (`overview`, `roster`, `tactics`, etc.) should use deep glassmorphism:
   - Background: `bg-slate-950/80` or `bg-[#040805]/95`.
   - Subtle green/emerald neon borders: `box-shadow: 0 0 20px rgba(16, 185, 129, 0.08)`.
3. Make sure the navigation tabs are styled to look like physical toggles or buttons on the side of the tablet/desk.

**Verify**: Run `bun run dev` and review the page layout.

### Step 3: Refactor Detail Cards and UI Polish

Make the inner component cards feel less AI-like by introducing custom clubhouse details:
- **Roster view**: Style the player grid items to look like polaroid dossiers or physical folder cards pinned onto the workspace.
- **Tactics view**: Style the radial dials to look like authentic dials on a vintage dashboard.
- **Header**: Replace the flat cover image with a framed club badge and a metallic plaque with the team name and season championships engraved.

**Verify**: Run `bun run typecheck:ui` → exits 0.

## Done criteria

- [ ] `bun run typecheck:ui` exits 0.
- [ ] UI displays correctly on desktop and mobile screens.
- [ ] No changes made to any out-of-scope files or backend routines.
- [ ] `plans/README.md` status row updated.
