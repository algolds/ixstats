# MyCountry × Wiki Lore Alignment — Executive / Diplomacy / Politics

Date: 2026-06-23 · branch v2 · for the community governance/aesthetics debate (see
`plans/ixstates-community-feedback-analysis.md`).

**Question this answers:** does the MyCountry exec/diplomacy/politics system faithfully surface the
worldbuilding on the wiki, or does it flatten it into a generic parliamentary template? The platform
vision is **lore-first** (wiki = truth → maps → mycountry → thinkpages). This doc grades the systems
against the *actual* lore and lists the changes that make every angle lore-first.

Method: surveyed `Category:Politics` + `Category:Countries` and the `Government of X` / `Politics of X`
corpus on the live wiki (MediaWiki API), then read the current data model
(`prisma/schema/government.prisma`, `diplomacy.prisma`, `enums.prisma`) and the builder/import code.

---

## 1. What the lore actually is — radical heterogeneity

The single most important finding: **no two canon governments share a shape, and almost none fit a
generic "head of state + cabinet + party-elected parliament" mold.** Each is named in bespoke in-world
terminology, and the *structure itself* (number of branches, how the legislature is composed, how
leaders are selected) is part of the worldbuilding — not decoration on a standard chassis.

| Nation | Form (verbatim from wiki) | Structural facts that break the generic model |
|---|---|---|
| **Caphiria** | "Unitary constitutional republic… functionally autocratic" — branches called **triumirs**; Imperator, Corcillum, Supreme Court | Republic *not monarchy*; Senate is appointed/by-class, not party-elected; Magistrates, Military Assembly, Tribunal Assembly |
| **Urcea** | "Dual federalist hierarchy and dual-sovereignty"; **Apostolic King-Elector**; people are "subjects" | Bicameral **Conshilía Daoni** + **Gildertach**; legitimacy = Catholic social teaching + Crown Liberalism; overseas possessions |
| **Daxia** | "Unitary Republic"; Chancellor (head of state *and* government); **quadricameral** legislature | People's Assembly + **Chamber of Productive Sectors** (corporatist) + Delegated Committee + **Council of Applied Sciences**; magistracy incl. **National Inquisitor's Office** |
| **Faneria** | "Unitary **Quaternalist** Republic" — **four** branches | Exec / Legislative / **Audit** / **Fiscal**; Director of the Republic + **Taesteach**; eight "Offices" not "ministries"; three-chambered legislature whose upper house = sitting government members |
| **Drasenia** | "Federal **demarchy**" | Officials chosen **by lot**, not elected; **Modified Borda Count** voting; semi-parliamentary; consensus-first |
| **Burgundie** | Maritime constitutional order; constituent countries | **Antivasileis-Lord Admiralcy**, First Sea Lord, Maritime Prefecture; constituent countries (Ile Burgundie, Nostrestran, Faramount, Equatorial Ostiecia); deep ministry tree |
| **Pelaxia** | Federal | Federal Chancellor **and** Prime Minister; autonomous communities + overseas territories |
| **Tierrador** | "The **Woqalate**" | Premier + **Administrative Tribune**; bespoke legal terminology |
| **Yonderre** | Parliamentary | **9 parties** in parliament, each with a distinct ideology page |

Cross-nation canon that already exists as a registry: **`List of heads of state and government`** and
**`Electoral systems of the world`** — i.e. the wiki already maintains the exact tables MyCountry wants
to own. Lore-first means MyCountry *sources from / reconciles with* these, not re-invents them.

---

## 2. What the current system models

Two parallel representations of "government" coexist:

**A. Atomic components** (`enum ComponentType`, ~90 atoms in `prisma/schema/enums.prisma`;
catalog in `src/lib/atomic-government-data.ts`). Abstract building blocks across power distribution
(centralized / federal / confederate / unitary), decision process (democratic / autocratic /
technocratic / consensus / oligarchic), legitimacy (electoral / traditional / performance / charismatic
/ religious / institutional), bureaucracy, economy, welfare, etc. These drive the **sim** (effectiveness,
synergies, conflicts). This layer is genuinely good for lore-first — it's compositional, so it can
*approximate* unusual forms by mixing atoms.

**B. Concrete structure** (`GovernmentStructure`, `GovernmentDepartment`, `PoliticalParty`,
`Legislature`, `Election`, `LegislativeSeat`, `GovernmentOfficial`). This is what the UI renders.
`GovernmentStructure` is mostly **free-text** (`governmentName`, `governmentType`, `headOfState`,
`headOfGovernment`, `legislatureName/executiveName/judicialName`) — also good, free text holds bespoke
names. But the surrounding models bake in assumptions (below).

Diplomacy is rich and not the problem: `DiplomaticRelation`, `Treaty`, `Embassy`, `Alliance`,
`ForeignPolicyAction`, `BilateralTrade`, `CulturalExchange` — plenty to surface lore from.

---

## 3. Alignment gaps — ranked by how badly they flatten lore

### G1. The wiki importer destroys the government type — **the worst offender**
`src/lib/wiki-infobox-mapper.ts:120-133` takes the infobox `government_type` (where the lore lives —
"Unitary Quaternalist Republic", "Federal demarchy", "Apostolic elective monarchy") and **collapses it
to one of six buckets** (`republic / kingdom / empire / sultanate / emirate`), defaulting to
`"republic"`. This is lore-first run exactly backwards: the canonical string is parsed and *thrown
away* at the ingestion boundary. Faneria becomes "republic", Drasenia becomes "republic", Caphiria's
careful "republic, functionally autocratic" becomes "republic".

→ **Fix:** keep the verbatim wiki string as the display value; derive a coarse `category` *alongside*
it for sim/filtering, never *instead of* it. One extra field, zero lore loss.

### G2. A hardcoded template mislabels canon
`src/components/government/templates/governmentTemplates.ts:16` ships a "Caphirian Imperial
Administration" template typed **`governmentType: "Constitutional Monarchy"`** — Caphiria is a
*constitutional republic with an Imperator*, explicitly **not** a monarchy per its own page. A curated
template that contradicts the wiki is worse than none.

→ **Fix:** either correct the handful of named-nation templates against their wiki pages, or make
templates generic ("Imperial administration") and let import fill the canon. Don't ship lore-wrong
named templates.

### G3. The fixed `governmentType` dropdown can't express the canon
`src/components/government/atoms/GovernmentStructureForm.tsx:41-53` offers 11 fixed options
(Constitutional Monarchy, Federal Republic, … Empire, City-State, Other). None of the surveyed nations'
actual forms (Quaternalist Republic, demarchy, dual federalist hierarchy, Woqalate) are selectable —
they all fall to "Other", erasing the distinction.

→ **Fix:** make it a free-text field with the list as *suggestions* (combobox), not an enum. The DB
column is already a free `String`; only the UI constrains it.

### G4. The legislature model assumes party-elected hemicycle seats
`Legislature` + `LegislativeSeat` + `Election` + `PoliticalParty` model a chamber as **parties winning
seats by election**. That's correct for Yonderre — and wrong for most of the canon:
- Caphiria's Senate: appointed / by class.
- Drasenia: seats filled **by lot** (demarchy); winner decided by **Modified Borda Count**.
- Faneria's upper chamber: **sitting government members**, not separately elected.
- Daxia's **Chamber of Productive Sectors**: corporatist/sectoral representation.
`chamberType` was already widened to support up to tetracameral
(`src/components/executive/politics/LegislatureConfig.tsx:69` — covers Daxia's quadricameral, Faneria's
tricameral), which is the right instinct. But "how a seat is filled" is still hardwired to
party-election.

→ **Fix (incremental):** add a `selectionMethod` on the chamber/seat (`elected | appointed | sortition
| hereditary | ex-officio | corporatist`). Sortition and appointment then render honestly instead of
forcing fake "parties". Don't try to *simulate* Borda/lot mechanics — just *represent* them truthfully
(the lore-first bar is faithful surfacing, not full electoral simulation).

### G5. Branch count is hardwired to three
`GovernmentStructure` exposes exactly `executiveName / legislativeName / judicialName`. Faneria has
**four** branches (the "Quaternalist" identity — adds Audit + Fiscal); Caphiria calls them *triumirs*;
Daxia spins out a National Inquisitor's Office. Three named slots can't hold a four-branch state or
bespoke branch names.

→ **Fix:** a small `GovernmentBranch` child table (name, type, description, order) replacing/augmenting
the three fixed fields. Lets the structure match the wiki's own diagram for each nation.

### G6. "Ministries" vs "Offices" and other vocabulary
`GovernmentDepartment.organizationalLevel` defaults to `"Ministry"`. Faneria has **Offices**, Burgundie
has **Ministries**, Caphiria has Imperial bureaus. The field exists and is free-text — so this is a
UI-copy gap more than a schema gap: the UI should display the nation's own word, sourced from lore.

→ **Fix:** surface `organizationalLevel` / `ministerTitle` everywhere the UI currently hardcodes
"Minister"/"Ministry".

---

## 4. The lore-first principle to adopt (the through-line)

Every gap above is the same mistake in different clothes: **the system normalizes canon into its own
taxonomy at the boundary, instead of carrying the canon and deriving its taxonomy alongside.** The fix
pattern is identical each time:

> **Carry the verbatim lore as the source of truth; derive coarse categories *next to* it for the sim,
> never *over* it.** Free text / child rows for what the wiki says; enums only for what the engine needs
> to compute on.

This directly answers the community debate (`ixstates-community-feedback-analysis.md`):
- **Burg (stat-wanking / governance):** when import preserves the wiki string and the structure mirrors
  the wiki's own branches, a player can't quietly "become a generic superpower template" — the system
  *shows their actual canon*, and `CountryChangeLog` (already in `government.prisma`) makes drift from it
  visible.
- **Urcea (systems should serve the story):** a Faneria player seeing **Quaternalist Republic**, four
  branches, a Taesteach and eight Offices — *their* lore, not "Republic / unicameral / Prime Minister" —
  is the system serving the story instead of asking them to manage a generic one.

---

## 5. Recommended sequence (cheapest → structural)

1. **G1** — stop discarding `government_type` on import (carry verbatim + add derived category). *Small,
   highest payoff, pure boundary fix.*
2. **G3** — `governmentType` UI to free-text combobox. *Small.*
3. **G2** — fix or genericize the named templates. *Small, data-only.*
4. **G6** — UI honors `organizationalLevel` / `ministerTitle`. *Small, copy.*
5. **G4** — add `selectionMethod` to chambers/seats (represent, don't simulate). *Medium, migration.*
6. **G5** — `GovernmentBranch` child table for N-branch / bespoke-branch states. *Medium, migration.*

Items 5–6 need a migration — confirm against live DB before writing it (drifted history; ~82 nations of
prod data — use `db push`, not `migrate dev`, per project convention).

**Not in scope here (separate doc):** closing the action→effect→narrative loops — that's
`plans/mycountry-core-loops-design.md`. This doc is specifically about *fidelity of representation*; the
two are complementary (loops make actions matter; alignment makes the thing acted-upon match canon).

---

## Appendix — corpus surveyed

`Government of`: Alexandria, Alstin, Arcerion, Burgundie, Canespa, Caphiria, Cartadania, Corumm, Daxia,
Faneria, Fiannria, Kiravia, Maresia, Metzetta, Nasastan, Pelaxia, Porta Bianca, Stenza, Tierrador,
Timbia, Urcea, Verona, Zaclaria, the United Republic.
`Politics of`: Canespa, Castadilla, Drasenia, Faneria, Galata, Rumahoki, Yonderre.
Plus `Category:Politics` subcats (Legislatures, Elections, Political parties, Political ideologies,
Public offices, Federalism, Spheres of influence) and the cross-nation registries `List of heads of
state and government`, `Electoral systems of the world`. Read in depth: Caphiria, Urcea, Daxia, Faneria,
Drasenia, Burgundie, Pelaxia, Tierrador, Yonderre.
