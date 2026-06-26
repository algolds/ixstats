# Workstream C — Decoupling WikiOS from IxStats (packaging / licensing)

**Goal:** WikiOS becomes a product other worldbuilding wiki communities can deploy and license, backed
by a small headless MediaWiki core (Stages 2b/3). This is the **larger** packaging blocker — bigger
than the MediaWiki axis — because every WikiOS file currently assumes the IxStats platform.

## Coupling audit (June 22 2026 — measured, 92 WikiOS .ts/.tsx files)

| Coupling | Files | Nature | Extraction difficulty |
|----------|-------|--------|-----------------------|
| **Auth (Clerk)** | 21 | `@clerk`, `ctx.auth`, `clerkUserId`, `useUser` | **Hard** — pervasive, needs an adapter |
| **Database (IxStats Postgres)** | 17 | `~/server/db` (shared Prisma w/ 200+ models) | **Hard** — needs own schema/repo seam |
| **Design (Facet/glass/unlumen)** | 18 | `builder/components/glass`, `glass-*`, `unlumen-ui` | **Medium** — already partly tokenized (`--wikios-*` CSS vars) |
| **IxStats domain (maps/country/IxTime)** | ~6 | `CountryMapEmbed`, `map-config`, `CountryActionsMenu`, flag extractor | **Easy** — small, isolatable |
| **Dynamic-data templates** | 16 (mostly prefix checks) | `MyCountry:`/`CountryData:`/`BusinessData:`/`MapEmbed:`/`Coords:` | **Easy-medium** — already behind a prefix seam |

**Key finding:** the IxStats *features* (country stats, maps, IxTime) are already fairly isolated
behind the template-prefix seam and a handful of imports — detangling them is the *small* part. The
*platform* couplings — **auth, DB, theme** — are what every file touches and what actually gates
packaging. Scope C around platform adapters first, features second.

## Strategy: adapters in place, extract last (avoid big-bang)

Do **not** start by lifting WikiOS into a separate package — that's the classic extraction that
stalls. Instead define seams *inside the current repo*, prove WikiOS runs through them, and only then
physically extract. Each phase is independently shippable and leaves IxStats working.

### C1 — Inventory + seam definition ✅ DONE
- Boundary doc written: `plans/wikios-core-boundary.md` (Core vs Plugin list + the three seams).

### C2 — Auth adapter ✅ DONE (server seam adopted as reference; full server migration is mechanical backlog)
- **Client:** `lib/wiki-os/use-wiki-auth.ts` (`useWikiAuth()`); all 4 `@clerk`-importing WikiOS files
  rewired. **Zero `@clerk` imports remain in WikiOS client code.**
- **Server:** `lib/wiki-os/auth.ts` (`getWikiAuth`/`requireWikiUserId`/`getWikiActorLabel`); `editing.ts`
  fully migrated as the reference. A deployer swaps provider by rewriting these two files.
- **Backlog ✅ cleared:** all 12 server router files migrated (+ `csrf-cache.ts`, `ArticleRenderer.tsx`).
  Verified zero raw `ctx.auth`/`ctx.user` and zero `@clerk` outside `use-wiki-auth.ts`. **C2 fully done.**

### C3 — Storage seam (17 files)
- WikiOS-owned models already live in `prisma/schema/wiki.prisma` (WikiArticle, WikiRevision,
  WikiCache, WikiTemplate, LoreStash, Lorewards, Blurbs, WikiArticleAward). Step 1: confirm WikiOS code
  only touches *these* models, not IxStats ones (audit the 17 `~/server/db` files). Step 2: front them
  with a thin repository module so the Prisma client is injected, not imported. Extraction to a separate
  schema/db becomes a config change later.
- Risk: medium. Lazy first cut: just verify + isolate the model set; defer the repository layer until
  a second community actually needs a separate DB.

### C4 — Plugin boundary for IxStats features (small)
- Formalize the existing prefix seam: a `WikiTemplatePlugin` registry where `MyCountry:`/`CountryData:`/
  `BusinessData:`/`MapEmbed:`/`Coords:` resolvers register. Core WikiOS ships with none; IxStats
  registers its set. Same pattern for the ~6 map/country component imports (render via a slot/plugin,
  not a hard import).
- Risk: low — the seam mostly exists; this makes it explicit and removes the hard imports.

### C5 — Theming contract (18 files)
- The `--wikios-*` CSS variables are already the theme surface. Formalize them as the public theme
  contract; move any hard `glass-*`/`unlumen-ui` usages behind WikiOS-owned components or tokens so a
  community can reskin via variables without forking. Facet stays an *optional* IxStats theme.
- Risk: low-medium, mostly mechanical.

### C6 — Config & deploy surface
- Everything site-specific behind config/env: MediaWiki endpoints (`WIKIOS_*`, already done), base path
  (currently `/projects/ixstats`), feature flags (which plugins/features on), branding. One config file
  a community edits — never fork-and-edit source (workflow portability rule #4).

### C7 — Decide core vs plugin for Lorewards / Blurbs / Stash
- Lore Stash = generic, keep **core**. Lorewards (gamified awards) + Blurbs (Topic Tuesday) are generic
  *concepts* but currently entangled with IxStats (country galleries, ThinkPages cross-post, Discord
  bot). Decision: ship as **optional plugins** with the IxStats-specific bits (Discord/ThinkPages)
  behind C4's plugin boundary.

### C8 — Packaging & licensing mechanics (last)
- Only after C1–C7: extract Core into its own package/repo, pick a license, write deploy docs
  (Docker-compose: WikiOS + headless MediaWiki + Postgres), publish. Do this when there's a real second
  deployer — not before (YAGNI; extraction without a consumer rots).

## Recommended order & honest read
1. **C1** (inventory/boundary) — cheap, unblocks everything, do first.
2. **C2** (auth) then **C3** (storage) — the two hard platform adapters; biggest packaging payoff.
3. **C4 + C5** (plugins + theming) — make IxStats features and Facet optional.
4. **C6/C7** — config + feature decisions, fold in along the way.
5. **C8** — extract + license **only when a second community is real.**

**Effort:** this is the largest of the three workstreams — months, not the days 2b/3 took. **Sequence
it behind a finished Stage 2b/3** so WikiOS is feature-stable on the MediaWiki axis before you start
moving its platform seams. **Lazy guardrail:** every phase keeps IxStats fully working; never extract
ahead of a real consumer. The smallest valuable first step is **C1 + the C2 auth interface** — that
alone proves the seam model and de-risks the rest.
