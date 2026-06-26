---
name: project_lore_alignment
description: MyCountry exec/diplomacy/politics lore-fidelity initiative — make the system surface bespoke wiki canon instead of flattening it into a generic parliamentary template
metadata: 
  node_type: memory
  type: project
  originSessionId: 37bb762d-f4ad-4847-89cd-7ee56524465a
---

MyCountry × wiki lore-alignment initiative (June 2026, v2). Two docs in `plans/`:
`mycountry-lore-alignment.md` (audit) + `mycountry-lore-alignment-plan.md` (implementation tickets).
Distinct from [[project_mycountry_core_loops]] — that's action→narrative *loops*; this is *fidelity of
representation*. They compose.

**Core finding:** canon governments are radically heterogeneous (Caphiria triumirs/Imperator = republic
NOT monarchy; Faneria 4-branch "Quaternalist"; Daxia quadricameral + Chamber of Productive Sectors;
Drasenia demarchy / selection by lot; Urcea Apostolic King-Elector). The system keeps normalizing canon
into its own taxonomy at the boundary. **Smoking gun:** `src/lib/wiki-infobox-mapper.ts:120-133`
collapses the wiki `government_type` string into 6 buckets (default "republic"), discarding canon at
import.

**The principle (future-proofing):** carry verbatim lore as truth; derive coarse categories *alongside*
it for the sim, never *over* it. Free text/child rows for what the wiki says; enums only for what the
engine computes on.

**6 gaps, ordered cheapest→structural:** T1 stop import flatten (no migration, highest payoff), T2
governmentType free-text combobox (`GovernmentStructureForm.tsx:41`), T3 fix/genericize lore-wrong
templates (`governmentTemplates.ts:16` mislabels Caphiria "Constitutional Monarchy"), T4 UI honors
`organizationalLevel`/`ministerTitle` (Faneria=Offices), T5 add `selectionMethod` to seats
(elected/appointed/sortition/ex-officio/corporatist — represent don't simulate; migration), T6
`GovernmentBranch` child table for N-branch states (migration). `NationalIdentity.governmentType` is
already free `String?` (core.prisma) — T1 needs no migration. Guardrail = one boundary test that
round-trips bespoke strings unchanged. Wiki already has `List of heads of state and government` +
`Electoral systems of the world` registries to reconcile against.

**SHIPPED 2026-06-23 (v2, uncommitted working tree):** All of T1–T6 done. PR1 (no migration): T1 importer
verbatim + `deriveGovCategory` + guardrail test (8 green), T2 governmentType free-text combobox
(`GovernmentType` += `(string & {})`), T3 template Caphiria fix. PR2: T5 `selectionMethod` per chamber via
the existing serialized `chamberType` 4th-positional (NO migration; updated BOTH duplicated `parseChambers`
in `routers/elections/legislature.ts` + `lib/election-simulation.ts`) + editor dropdown + LegislaturePanel
badge. T6 = `GovernmentBranch` table (additive `db push` applied to the 82-nation DB) + idempotent
`scripts/backfill-government-branches.ts` (45 rows/15 structures applied) + `government/crud.ts` includes
branches + GovernmentTab renders non-standard branches. GOTCHA: two `parseChambers` copies; gov fields are
`legislatureName` (not legislativeName), `executiveName`, `judicialName`.

Wiki access: WebFetch is 403'd by bot defense; use `curl -A` against `https://ixwiki.com/api.php` (on-server).
