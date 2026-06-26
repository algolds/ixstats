# WikiOS Core vs Plugin Boundary (Workstream C1)

The line between **WikiOS Core** (portable, ships to any community) and **IxStats Plugins**
(stay in IxStats, registered via a seam). Companion to `wikios-workstream-c-packaging.md`.

## Core — portable wiki product
Reader · dual-mode editor (visual + source) · search · categories · history/diff ·
MediaWiki bridge (config-driven endpoints) · Postgres shadow store + local revisions (2b) ·
Lore Stash · talk pages · template registry · the `--wikios-*` theme contract.

Core may depend only on: the **three seams** below, the `WIKIOS_*` config, and its own
Prisma models (`prisma/schema/wiki.prisma`).

## Plugins — IxStats-specific, registered into Core
- **Dynamic-data templates** — `MyCountry:` / `CountryData:` / `BusinessData:` (country economy → wiki).
- **Maps** — `MapEmbed:` / `Coords:`, `CountryMapEmbed`/`CoordinatesMapEmbed`, `map-config`, flag extractor (~6 imports).
- **IxTime** — timeline/time displays.
- **Lorewards / Blurbs** — generic *concepts*, but entangled with country galleries, ThinkPages cross-post,
  Discord bot → ship as optional plugins with the IxStats bits behind the plugin seam (decision: C7).

## The three seams

| Seam | Status | File(s) |
|------|--------|---------|
| **Auth** (C2) | ✅ realized | `lib/wiki-os/auth.ts` (server), `lib/wiki-os/use-wiki-auth.ts` (client) |
| **Storage** (C3) | ⏳ models isolated in `wiki.prisma`; repository layer not built | `prisma/schema/wiki.prisma` |
| **Plugins** (C4) | ⏳ exists informally as the `MyCountry:`/`CountryData:`/`BusinessData:`/`MapEmbed:`/`Coords:` prefix checks | `lib/wiki-os/template-resolver.ts` + prefix checks across ~16 files |

## Auth seam (C2) — DONE this round

**Client:** all 4 WikiOS files that imported `@clerk` directly now consume `useWikiAuth()`
(`WikiOSProfileWidget`, `WikiOSLayout`, `useWikiOSShortcuts`, `BlurbPromptDetail`). **Zero `@clerk`
imports remain in WikiOS client code.** Swap providers by rewriting `use-wiki-auth.ts` alone.

**Server:** `lib/wiki-os/auth.ts` exposes `getWikiAuth(ctx)` → `{ userId, wikiUsername }`,
`requireWikiUserId(ctx)`, `getWikiActorLabel(ctx)`. `editing.ts` is fully migrated as the reference
(no raw `ctx.auth`/`ctx.user` reads left). A new deployer maps their provider into these helpers.

**Backlog — ✅ CLEARED.** All 12 server router files migrated per-site (protected → `requireWikiUserId`,
public/optional → `getWikiAuth`): `wikios/{user-talk,page-content,stash,templates,search-categories,
watchlist-annotations}`, `wiki/{data,media,articles,discovery}`, `blurbs/{moderate,respond}`. Plus
`csrf-cache.ts` (session/CSRF resolver) and `ArticleRenderer.tsx` (off `~/context/auth-context` → seam).
**Verified: zero raw `ctx.auth`/`ctx.user` reads remain anywhere in WikiOS server code, and zero
`@clerk` imports outside `use-wiki-auth.ts`.** Lint clean, tests 10/10. A new deployer swaps the auth
provider by rewriting `auth.ts` + `use-wiki-auth.ts` only.

> Migration gotcha for future seams: a grep of `ctx\.(auth|user)` misses `(ctx as any).auth` casts —
> sweep `\(?ctx( as any)?\)?\.(auth|user)` to catch cast forms (one slipped through in page-content.ts).

## Known deeper couplings surfaced (future seams)
- **`User.clerkUserId` column** — WikiOS resolves the active user/country via `db.user.findFirst({ where:{ clerkUserId } })`. The column name is IxStats-specific → **C3 (storage seam)**, flagged in `editing.ts`.
- **Absolute `ixwiki.com` asset URLs** in served HTML (`html-transformer`, `fix-editor-images`, `wiki-image-url`) → assets must be servable under the deployer's own origin (also a Stage 3 hazard).
- **`basePath`** `/projects/ixstats` → must be config (C6).
