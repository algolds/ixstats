# Workstream C — Full Execution Workflow

Sequenced plan to finish decoupling WikiOS from IxStats. Companion to
`wikios-workstream-c-packaging.md` (scope) and `wikios-core-boundary.md` (boundary).

## Why phased, not all-parallel
The C2 backlog parallelized cleanly (disjoint file halves). The rest does **not**: C3/C4/C7 all touch
the same routers (`editing.ts`, `page-content.ts`) and components, and two steps need **human**
judgment, not autonomous agents:
- **C5 (theming)** — visual; an agent can't verify the UI still looks right. Human/staging gate.
- **C7 (Lorewards/Blurbs core vs plugin)** — a product decision. User decides.
- **C8 (extract + license)** — deferred until a real second deployer exists (YAGNI).

So: one phase at a time, agent where mechanical+verifiable, human where judgment is required.

## Status legend: ✅ done · 🔄 in progress · ⏳ queued · 🚦 human gate · 🧊 deferred

---

### Phase 1 — C3 Storage / identity seam ✅ DONE
**Verified:** the only `User.clerkUserId` lookup now lives in `lib/wiki-os/storage.ts`
(`resolveActiveCountryId` / `findWikiUserByAuthId`); 11 router files migrated. Lint clean, tests pass.
Residuals (out of seam scope, documented): `blurbs/browse.ts` `clerkUserId: true` response SELECT;
`blurbs/respond.ts` `thinkpagesAccount.clerkUserId` (a different table). `ActiveCountryUnifiedWidget`
`useUserCountry` is a country *feature* → C4.

<details><summary>original Phase 1 plan</summary>
**Goal:** the IxStats-specific `User.clerkUserId` column + User↔Country lookup live in ONE file.
**Seam (built):** `lib/wiki-os/storage.ts` — `resolveActiveCountryId(ctx)`, `findWikiUserByAuthId(authId)`.
**Reference (done):** `editing.ts` `syncCustomTemplates` now calls `resolveActiveCountryId(ctx)`.
**Backlog (agent):** ~12 remaining `clerkUserId` lookup sites (all marked `// C3:` by the C2 agents) →
`resolveActiveCountryId` / `findWikiUserByAuthId`. Files: `wikios/{page-content,templates,
watchlist-annotations,stash,search-categories,user-talk}`, `wiki/{data,media,articles,discovery}`,
`blurbs/respond`. **Residuals:** `blurbs/browse.ts` exposes `clerkUserId` as a response *column*
(not a lookup) — assess; `ActiveCountryUnifiedWidget` uses `useUserCountry` (a country *feature* → C4).
**Verify:** zero `clerkUserId` outside `storage.ts` (except documented residuals); lint; tests.
**Parallelism:** single agent (sites share the byte-identical helper block — keep consistent). Sequential
before C4 (same files).

</details>

### Phase 2 — C4 Plugin boundary ⏳ (after C3)
**Goal:** core ships with NO IxStats templates; IxStats registers them. Formalize the existing
`MyCountry:`/`CountryData:`/`BusinessData:`/`MapEmbed:`/`Coords:` prefix seam into a
`WikiTemplatePlugin` registry; replace the ~6 hard map/country component imports with plugin slots.
**Files:** `lib/wiki-os/template-resolver.ts` + prefix-check sites in routers & reader/editor components.
**Agent/human:** I scope the registry API (design call); agent does the mechanical wiring + verify.
**Sequential after C3** (overlaps `editing.ts`/`page-content.ts`/components).

### Phase 3 — C6 Config surface ⏳ (can follow C4; small)
**Goal:** everything site-specific behind config — `basePath` (`/projects/ixstats`), MediaWiki endpoints
(`WIKIOS_*`, done), feature flags (which plugins on), branding. One config file a deployer edits.
**Files:** `lib/base-path` consumers, a new `wiki-os.config.ts`. Mostly mechanical → agent.

### Phase 4 — C5 Theming contract 🚦 (human visual gate)
**Goal:** `--wikios-*` CSS vars become the public theme contract; hard `glass-*`/`unlumen-ui` usages move
behind WikiOS-owned components/tokens so a deployer reskins via variables. Facet = optional IxStats theme.
**Files:** `styles/wiki-os/*`, ~18 components. **Agent does token extraction; HUMAN verifies visuals on a
running app before merge** — no blind visual refactor.

### Decision gate — C7 Lorewards / Blurbs / Stash 🚦
Stash = core. **Lorewards + Blurbs:** generic concepts but entangled with country galleries, ThinkPages
cross-post, Discord. **User decides:** ship as optional plugins (recommended) vs drop from core vs keep
IxStats-only. Blocks final core/plugin packaging. Ask when Phase 2 lands.

### C8 — Extract + license 🧊 deferred
Only when a real second community exists: extract Core to its own package/repo, pick a license, write
Docker-compose deploy docs (WikiOS + headless MediaWiki + Postgres). Extraction without a consumer rots.

---

## Execution order
1. **C3** (now) — seam built, agent clears backlog → verify.
2. **C4** — scope registry → agent wires → verify.
3. **C6** — config surface → agent → verify.
4. **C5** — agent extracts tokens → **human visual sign-off**.
5. **C7** — user decision → wire plugins.
6. **C8** — only on a real deployer.

Each phase: agent runs on branch `v2`, lint + targeted tests, **no commit / no schema push**; human
reviews, pushes any additive schema, advances to the next phase.
