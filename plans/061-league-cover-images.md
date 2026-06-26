# Plan 061: Stop league cover images 404-ing — local sources + graceful fallback

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> STOP condition occurs, stop and report. Update the status row in
> `plans/README.md` when done — unless a reviewer maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat 3a4e3324..HEAD -- src/app/myleague/page.tsx src/app/myclub/page.tsx`
> Compare the "Current state" excerpts against the live code before proceeding.
>
> **Revised 2026-06-17** after an execution attempt found the original file
> inventory wrong: `myleague/[id]/page.tsx` has **no** cover (only a logo); the
> covers live in the **hub** `myleague/page.tsx` and in `myclub/page.tsx`; the
> map is named **`SPORT_FALLBACK_IMAGES`** (not `SPORT_COVER`); and `myclub`
> renders its cover through a `<CarouselCard>` that requires a string `src`
> (not a swappable `<img>`). Scope below reflects the real code.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3a4e3324`, 2026-06-17 (revised same day)

## Why this matters

Every league/team cover image 404s. Two sports pages hardcode cover URLs
resolved at runtime through the live MediaWiki Commons proxy
(`/api/mediawiki/commons/Special:Filepath/<file>`), which returns 404. (CSP is
not the cause — `img-src` already allows `https:`.) Player photos work because
they're local `/public` assets. Do the same for covers: a shared local cover
source, plus a reusable `<LeagueCover>` `<img>` component with an `onError`
gradient+emoji fallback (used where the markup is a plain `<img>`), and a plain
local-path swap where the markup is a carousel that owns its own rendering. Also
de-duplicate the cover map (copy-pasted in the two pages).

## Current state (verified)

**`src/app/myleague/page.tsx`** (the hub) — map `SPORT_FALLBACK_IMAGES` at lines
53-61 (proxy URLs). Two real, swappable cover `<img>` elements:

- Featured cover (~lines 171-179), inside `<div className="absolute inset-0 z-0">`:
  ```tsx
  <img
    src={withBasePath(
      (featuredLeague as any).coverImage ||
        SPORT_FALLBACK_IMAGES[featuredLeague.sportPreset] ||
        "/api/mediawiki/commons/Special:Filepath/Stade_V%C3%A9lodrome_interior_2018.jpg"
    )}
    alt=""
    className="h-full w-full object-cover opacity-25 blur-[1px] transition-transform duration-700 group-hover:scale-105"
  />
  ```
- Per-league card cover (~lines 352-361) — note it also falls back to `league.logo`:
  ```tsx
  <img
    src={withBasePath(
      (league as any).coverImage ||
        (league as any).logo ||
        SPORT_FALLBACK_IMAGES[league.sportPreset] ||
        "/api/mediawiki/commons/Special:Filepath/Stadion_Luzhniki_Moskva_July_2018.jpg"
    )}
    alt={league.name}
    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
  />
  ```

**`src/app/myclub/page.tsx`** — map `SPORT_FALLBACK_IMAGES` at lines 26-34. The
cover is **not** an `<img>`; it's a string `card.src` passed into
`<CarouselCard>` (from `~/components/ui/apple-cards-carousel`, which renders the
image itself and requires a non-optional `src: string`), built ~lines 70-76:
```tsx
src: withBasePath(
  team.coverImage ||
    team.logo ||
    SPORT_FALLBACK_IMAGES[team.league?.sportPreset ?? ""] ||
    "/api/mediawiki/commons/Special:Filepath/Stadion_Luzhniki_Moskva_July_2018.jpg"
),
```

**`src/app/myleague/[id]/page.tsx`** — **NO cover image** (only `ARCHETYPE_LABELS`,
`SPORT_EMOJIS`, and a `league.logo` `<img>`). **Out of scope.**

Conventions: local assets like player photos use `/images/...` paths with
`withBasePath(...)` (`~/lib/base-path`, already imported). Gradient+emoji fallback
precedent: `LeagueBrandCard` in `LeagueSidebarNav.tsx:344-353` uses
`getSportEmoji(sportPreset)` (from `~/lib/sports/presets`) in a `bg-muted` square.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Lint | `bun run lint` | exit 0 (no new error in touched files) |
| Grep gate | `grep -rn "Special:Filepath" src/app/myleague src/app/myclub` | no matches |

(`typecheck:file` here runs bare `tsc` with no project tsconfig → spurious
`TS2307`/`TS17004`/`TS2802`; treat those as environmental noise. Lint + grep are
the real gates.)

## Scope

**In scope**:
- `src/lib/sports/league-covers.ts` (create)
- `src/components/sports/LeagueCover.tsx` (create)
- `public/images/sports/league-covers/.gitkeep` (create)
- `src/app/myleague/page.tsx` (swap 2 `<img>` → `<LeagueCover>`, delete local map)
- `src/app/myclub/page.tsx` (point cover at the shared local map, delete local map)

**Out of scope**:
- `src/app/myleague/[id]/page.tsx` — no cover; do NOT touch.
- The `/api/mediawiki/commons` proxy route; player photos; `apple-cards-carousel`
  internals (do not modify the carousel — just feed it a local string).

## Steps

### Step 1: Shared cover-source map
Create `src/lib/sports/league-covers.ts`:
```ts
/** Local cover image per sport preset. Files live in /public/images/sports/league-covers/.
 *  Missing files fall back to a gradient+emoji placeholder via <LeagueCover>. */
export const SPORT_COVER: Record<string, string> = {
  soccer: "/images/sports/league-covers/soccer.jpg",
  football: "/images/sports/league-covers/football.jpg",
  hockey: "/images/sports/league-covers/hockey.jpg",
  basketball: "/images/sports/league-covers/basketball.jpg",
  baseball: "/images/sports/league-covers/baseball.jpg",
  f1: "/images/sports/league-covers/f1.jpg",
  boxing: "/images/sports/league-covers/boxing.jpg",
};
export function sportCover(sportPreset: string | undefined): string | undefined {
  if (!sportPreset) return undefined;
  return SPORT_COVER[sportPreset];
}
```
Create `public/images/sports/league-covers/.gitkeep` (empty).

### Step 2: `<LeagueCover>` component (for `<img>` sites)
Create `src/components/sports/LeagueCover.tsx`:
```tsx
"use client";
import { useState } from "react";
import { getSportEmoji } from "~/lib/sports/presets";
import { sportCover } from "~/lib/sports/league-covers";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";

export function LeagueCover({ sportPreset, coverImage, className, alt = "" }: {
  sportPreset: string; coverImage?: string | null; className?: string; alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = coverImage || sportCover(sportPreset);
  if (!src || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-4xl", className)} aria-label={alt}>
        <span>{getSportEmoji(sportPreset)}</span>
      </div>
    );
  }
  return <img src={withBasePath(src)} alt={alt} onError={() => setFailed(true)} className={className} />;
}
```

### Step 3: Swap the two `<img>` covers in `myleague/page.tsx`
Delete the local `SPORT_FALLBACK_IMAGES` map. Replace:
- Featured cover →
  `<LeagueCover sportPreset={featuredLeague.sportPreset} coverImage={(featuredLeague as any).coverImage} alt="" className="h-full w-full object-cover opacity-25 blur-[1px] transition-transform duration-700 group-hover:scale-105" />`
- Per-league cover (preserve the `logo` fallback via coverImage) →
  `<LeagueCover sportPreset={league.sportPreset} coverImage={(league as any).coverImage || (league as any).logo} alt={league.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />`
Remove the proxy fallback string literals.

### Step 4: Local string source in `myclub/page.tsx` (no component — carousel needs a string)
Add `import { SPORT_COVER } from "~/lib/sports/league-covers";`. Delete the local
`SPORT_FALLBACK_IMAGES` map. Change the `card.src` construction to use the shared
local map and a **local** final fallback (no proxy):
```tsx
src: withBasePath(
  team.coverImage ||
    team.logo ||
    SPORT_COVER[team.league?.sportPreset ?? ""] ||
    SPORT_COVER.soccer
),
```

### Step 5: Lint
`bun run lint` → exit 0 (no new errors in touched files).

## Done criteria (ALL)
- [ ] `grep -rn "Special:Filepath" src/app/myleague src/app/myclub` → no matches
- [ ] `grep -rn "SPORT_FALLBACK_IMAGES" src/app/myleague src/app/myclub` → no matches
- [ ] `bun run lint` exits 0 with no new error in touched files
- [ ] `src/app/myleague/[id]/page.tsx` is NOT modified
- [ ] Only the in-scope files are modified/created (`git status`)
- [ ] `plans/README.md` row updated (reviewer may do this)

## STOP conditions
- Any cover `<img>` in `myleague/page.tsx` is actually a CSS `background-image`
  (it is not, per Current state — but verify) — report instead of forcing.
- `getSportEmoji` / `withBasePath` / `cn` not importable from the cited paths.
- A third sports page also builds a `Special:Filepath` cover map — note it; only
  centralize if it's a sports cover.

## Maintenance notes
- **Human follow-up (not executor)**: drop real cover photos at
  `public/images/sports/league-covers/{soccer,football,hockey,basketball,baseball,f1,boxing}.jpg`.
  Until then, `myleague/page.tsx` shows the gradient+emoji placeholder (via
  `<LeagueCover>` onError); `myclub`'s carousel will show a broken thumbnail for
  missing files because the carousel owns rendering and has no onError — teaching
  the carousel a fallback (or pre-shipping default art) is a deferred follow-up.
- **Reviewer**: confirm no cover path routes through the runtime wiki proxy, and
  that the `<LeagueCover>` classNames match the old `<img>` classes (layout-stable).
