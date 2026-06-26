# WikiOS Extraction Blockers — evidence-based (forcing-function spike)

Result of the read-only dependency spike: every import in the WikiOS Core file set
(`components/wiki-os`, `lib/wiki-os`, `app/(wiki-os)`, `server/api/routers/{wikios,wiki}`) that
crosses into IxStats-specific code — i.e. exactly what would fail to compile in a standalone Core.
This **supersedes the guessed C4/C5/C6 ordering** in `wikios-workstream-c-execution.md`.

Allowed in Core (excluded from the list): `lib/wiki-os/*`, `components/wiki-os/*`, generic `components/ui/*`,
`trpc/*`, `server/db` (Prisma), `env`, `lib/utils`, `lib/base-path`, `lib/cache`, the auth/storage seams.

## Headline finding
**Design/Facet coupling (C5) is the dominant blocker, not the plugin registry (C4).** And a big chunk of
the "blockers" are not coupling at all — they're **portable wiki code living in the wrong directory**,
fixable by relocation with zero behavior change. The country/maps plugin cluster (C4) is small and contained.

## Categorized blockers

### A. Relocate into the WikiOS boundary — ✅ DONE (after blast-radius check)
Blast-radius check changed the plan: **`lib/wiki-bridge` is NOT WikiOS-exclusive** — 34 importers,
**23 outside WikiOS** (country/builder/etc.). It's shared IxStats↔MediaWiki infra → **NOT moved**;
reclassified as *shared Core-infra* (Core depends on it like it depends on Prisma).
| Import | Importers | Action taken |
|--------|-----------|--------------|
| `lib/wiki-bridge` | 34 (23 external) | **Left in place** — shared infra, Core depends on it. |
| `lib/wiki-embed-shared` | 1 (WikiOS only) | ✅ moved → `lib/wiki-os/wiki-embed-shared.ts` |
| `hooks/useWikiSetting` | 1 (WikiOS only) | ✅ moved → `components/wiki-os/shared/useWikiSetting.ts` |
| `components/mediawiki/commons/*` | 3 (2 external) | Left — 2 non-WikiOS importers; moving creates reverse cross-boundary. Revisit at extraction. |
| `lib/buildVersion` | shared | Core ships its own version constant (trivial, at extraction). |

### B. C2 auth residual — ✅ DONE
`lib/wiki-os/auth.ts` now exposes `isWikiAdmin(ctx)` (wraps `isSystemOwner`); `csrf-cache.ts` calls it.
Verified: zero `system-owner-constants` imports in WikiOS outside `auth.ts`. The auth seam is now the
single mapping point for both identity *and* admin/RBAC.

### C. C5 — Design / Facet decoupling (THE big body of work)
| Import | Used by | Action |
|--------|---------|--------|
| `app/builder/components/glass` (DYNAMIC_ISLAND_*) | both editors | WikiOS-owned glass primitive or theme tokens |
| `components/unlumen-ui` (AppleSwitch …) | editors | WikiOS-owned UI primitive |
| `components/dashboard` (DashboardSidebarLayout) | `WikiOSLayout` | WikiOS-owned layout |
| `components/DynamicIsland`, `components/status-indicator` | layout/shell | WikiOS-owned or optional |
| `hooks/useNavigationScroll` (×2) | editors | WikiOS-owned hook |
→ Formalize the `--wikios-*` token contract; replace Facet imports with WikiOS-owned components.
**Human visual sign-off required.**

### D. C4 — IxStats feature plugin (small, contained — country/maps cluster)
| Import | Used by | Action |
|--------|---------|--------|
| `lib/wiki-os/template-resolver` (prisma.country/poi) | getArticleHtml, syncTemplates | the data-template resolver → behind a nullable resolver hook |
| `lib/map-config`, `hooks/useCountryMapEmbed`, `components/maps/widgets/*MapEmbed` | InfoboxWithMap, editor MapEmbed | maps plugin |
| `hooks/useUserCountry`, `components/countries/*`, `components/UnifiedCountryFlag`, `lib/flag-color-extractor` | widgets/reader | country plugin |
→ Register these via a plugin slot; core ships without them (templates render inert, map/flag widgets absent).

## Reprioritized plan
1. **A — relocations** (cheap, safe, non-speculative): move wiki code into the WikiOS boundary. Shrinks the
   blocker list for real with zero risk. **Do first.**
2. **B — fold `isWikiAdmin` into auth seam** (small): closes the last auth residual.
3. **C5 — design decoupling** (the real work): token contract + WikiOS-owned primitives. Human visual gate.
4. **C4 — feature plugin slot** (contained): country/maps/template resolver behind a hook.
5. **C6 config / C7 decision / C8 extract**: as before, last.

A and B are genuine, non-speculative wins available now (just moving code + closing a residual). C5 is the
largest remaining effort and is design/visual-gated. C4 is smaller than C5, contrary to the original guess.
