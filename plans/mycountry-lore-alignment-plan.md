# MyCountry Lore-Alignment — Implementation Plan

Date: 2026-06-23 · branch v2. Companion to `plans/mycountry-lore-alignment.md` (the audit). This is the
*how*: ordered tickets for the six current gaps (G1–G6) plus one durable guardrail so the gap *class*
can't silently come back.

## Goal

Make MyCountry exec/diplomacy/politics surface each nation's **actual canon**, not a generic
parliamentary template. Success = a Faneria player sees "Unitary Quaternalist Republic / four branches /
Taesteach / eight Offices"; an importer run on any wiki page preserves its `government_type` string
verbatim.

## Status (2026-06-23)

**PR 1 (no-migration) — DONE.** T1, T2, T3, Guardrail shipped; T4 was already satisfied in-code
(department `ministerTitle` is free text + read dynamically, "Office" already selectable). Files: `wiki-infobox-mapper.ts`
(+`deriveGovCategory`), `wiki-infobox-mapper.test.ts` (8 tests green), `types/government.ts`,
`GovernmentStructureForm.tsx`, `governmentTemplates.ts`. Also confirmed `wiki-builder-assembler.ts`
`normalizeGovernmentType` is lore-safe (preserves words, only title-cases).

**PR 2 (T5/T6) — DONE.**
- **T5** (no migration after all): `selectionMethod` rides the existing per-chamber serialized
  `chamberType` blob (4th positional, like `electoralSystem`). Updated BOTH `parseChambers` copies
  (`routers/elections/legislature.ts` + `lib/election-simulation.ts` — they're duplicated), the
  `LegislatureConfig` editor (per-chamber dropdown: elected/appointed/sortition/hereditary/ex-officio/
  corporatist), and a read-only badge in `LegislaturePanel` (shown only when ≠ elected). Represent,
  not simulate — no Borda/lottery engine.
- **T6** (migration, additive): new `GovernmentBranch` model + `branches` relation on
  `GovernmentStructure` (legacy 3 name fields kept). Diff was CREATE TABLE + index + FK only —
  applied via `bunx prisma db push` + `generate`. Backfill `scripts/backfill-government-branches.ts`
  (dry-run default, idempotent) seeded **45 rows across 15 structures** from the legacy fields —
  includes real lore like Caphiria's "Corcillum" and a "National Audit Council" (4th branch).
  `government/crud.ts` queries now `include` branches; `GovernmentTab` renders non-standard branches
  (Audit/Fiscal/bespoke) and a dynamic branch count.

## The one principle (this is the future-proofing)

> **Carry the verbatim lore as the source of truth. Derive coarse categories *next to* it for the sim —
> never *over* it.** Free text / child rows for what the wiki says; enums only for what the engine
> computes on.

Every current gap is one violation of this. Future-proofing isn't a framework — it's this sentence,
enforced at the one boundary that matters (import) by one test. See "Guardrail" below.

---

## Current issues — ordered tickets

Sequenced cheapest→structural. 1–4 are no-migration, ship-this-week. 5–6 need a migration (coordinate
with prod: `db push`, not `migrate dev`; ~82 nations live).

### T1 — Stop the importer flattening `government_type` (fixes G1) · no migration
- **Change:** delete the bucket-collapsing `transform` at
  `src/lib/wiki-infobox-mapper.ts:120-133`; store the wiki string verbatim into
  `NationalIdentity.governmentType` (already `String?`, free text — confirmed `core.prisma`).
- If/when the sim or a filter genuinely needs a coarse class, add the derived category as a **separate**
  helper (`deriveGovCategory(str)`) read at call-site — do **not** add a column until something filters
  on it (YAGNI). The old transform logic becomes that helper, used additively.
- **Touches:** `wiki-infobox-mapper.ts`; verify pass-through in `wikiImporter/mapping.ts` + `deep.ts`.
- **Test:** the Guardrail test below (round-trips bespoke strings unchanged).

### T2 — Free-text combobox for government type (fixes G3) · no migration
- **Change:** `src/components/government/atoms/GovernmentStructureForm.tsx:41-53` — turn the fixed
  11-item `governmentTypes` enum dropdown into a **combobox**: the list becomes *suggestions*, free
  input allowed. DB column already free `String`; only the UI constrains it.
- **Touches:** that form (and any other `<Select>` bound to `governmentType` — grep the readers list in
  the audit; most are display-only and need no change).

### T3 — Fix or genericize the lore-wrong templates (fixes G2) · data only
- **Change:** `src/components/government/templates/governmentTemplates.ts:16` types Caphiria as
  "Constitutional Monarchy" — it's a republic with an Imperator. Either correct each named-nation
  template against its wiki page, or rename templates to generic roles ("Imperial administration") and
  let import fill the canon. Don't ship named templates that contradict the wiki.
- **Decision needed:** correct-in-place vs genericize. Recommend **genericize** — curated per-nation
  templates are a maintenance liability that re-drifts from canon; import is the lore-first path anyway.

### T4 — UI honors a nation's own vocabulary (fixes G6) · copy only
- **Change:** anywhere the UI hardcodes "Minister"/"Ministry", read
  `GovernmentDepartment.organizationalLevel` / `ministerTitle` (both already exist, free text). Faneria
  shows "Office", Caphiria its bureaus, etc.
- **Touches:** government tab + department cards; grep `"Minister"` / `"Ministry"` literals in
  `src/components/government` + `src/components/mycountry/tabs/GovernmentTab.tsx`.

### T5 — Represent how seats are filled (fixes G4) · migration
- **Change:** add `selectionMethod` to the chamber/seat level — `elected | appointed | sortition |
  hereditary | ex-officio | corporatist`. Render honestly: a sortition (Drasenia) or appointed
  (Caphiria Senate) chamber stops being forced into fake "parties".
- **Scope discipline (ponytail):** *represent, don't simulate.* No Borda-count / lottery engine — just a
  truthful label + party-optional rendering. The lore-first bar is faithful display, not electoral
  simulation.
- **Schema:** likely on `LegislativeSeat` (per-seat) and/or a new per-chamber descriptor; `chamberType`
  already supports up to tetracameral (`LegislatureConfig.tsx:69`), so Daxia/Faneria chamber *counts*
  already fit.
- **Migration:** additive nullable column → safe `db push`. Default existing rows to `elected`
  (current behavior).

### T6 — N-branch / bespoke-branch states (fixes G5) · migration
- **Change:** the fixed `executiveName/legislativeName/judicialName` on `GovernmentStructure` can't hold
  Faneria's **four** branches (Exec/Legislative/Audit/Fiscal) or bespoke branch names (Caphiria
  "triumirs", Daxia's National Inquisitor's Office). Add a `GovernmentBranch` child table
  (`name, type, description, order`).
- **Compat:** keep the three legacy fields populated from the first three branches for now (no
  call-site break); migrate readers incrementally. Backfill = create 3 branch rows per existing
  structure from the legacy fields.
- **Migration:** new table + backfill script; additive, safe `db push`. **Confirm against live DB
  before writing** (drifted history, prod data).

---

## Guardrail — keep the gap class from returning (the "future issues" part)

Not a framework — three small, durable things:

1. **One boundary comment + one test.** At `wiki-infobox-mapper.ts` add a `// ponytail:` note: *infobox
   strings are canon — preserve verbatim; derive categories additively, never replace.* Back it with a
   single Jest test (`wiki-infobox-mapper.test.ts`) asserting a table of bespoke real strings round-trip
   unchanged: `"Unitary Quaternalist Republic"`, `"Federal demarchy"`, `"Apostolic elective monarchy"`,
   `"Unitary constitutional republic"`. This test *is* the regression net — if anyone re-adds a
   collapsing transform, it goes red. (Satisfies the ponytail "one runnable check at the money boundary"
   rule.)
2. **Enums earn their place.** Convention for reviewers: a new enum on a lore-derived field is a smell —
   default to free text + a derived helper. Only enumerate fields the **engine computes on**
   (sim inputs), never fields that merely *describe* a nation.
3. **Reconcile with the wiki's own registries instead of re-inventing.** The wiki already maintains
   `List of heads of state and government` and `Electoral systems of the world`. Lore-first = MyCountry
   *sources from / diffs against* these (a periodic importer or a "this disagrees with the wiki" flag),
   so canon and data can't silently diverge — which is exactly Burg's stat-wanking worry answered
   structurally (see audit §4).

---

## Effort / sequencing

| Ticket | Gap | Migration | Size | When |
|---|---|---|---|---|
| T1 | G1 import flatten | no | S | now |
| T2 | G3 type dropdown | no | S | now |
| T3 | G2 wrong template | no | S | now (needs genericize-vs-fix call) |
| T4 | G6 vocabulary | no | S | now |
| Guardrail | future | no | S | with T1 |
| T5 | G4 seat selection | yes (additive) | M | after T1–T4, confirm DB |
| T6 | G5 N branches | yes (new table) | M | after T5, confirm DB |

T1–T4 + Guardrail are a single low-risk PR (no schema change). T5/T6 are a second PR gated on a live-DB
check. Out of scope (separate doc): action→effect→narrative loops = `plans/mycountry-core-loops-design.md`.
This plan is fidelity-of-representation only; the two compose.
