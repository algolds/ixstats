# Vexel — Heraldry Studio

**Last updated:** 2026-10-05
**Status:** Labs. The editor, generator, registry and export work. Attaching a design to a country only works for a
design that has a rendered image URL, and nothing renders one yet.
**Routes:** `/labs/vexel` (new design) · `/labs/vexel/[id]` (edit) · `/labs/vexel/generate` (gallery) ·
`/labs/vexel/registry` · `/labs/vexel/registry/[id]`
**Code:** `src/server/api/routers/heraldry/` (`queries.ts`, `mutations.ts`), `src/lib/heraldry/`,
`src/components/maps/vexel/`, `prisma/schema/heraldry.prisma`
**Product spec:** [Vexel PRD](../specs/2026-07-15-vexel-prd.md)

Vexel designs coats of arms as structured data. A design (a "heraldic achievement") is a JSON composition: field,
divisions, ordinaries, charges and tinctures. Vexel draws it as SVG and writes its blazon (the formal text
description) from the same data.

---

## 1. Routes and navigation

| Route | Page | What it shows |
| :--- | :--- | :--- |
| `/labs/vexel` | `VexelEditor` | Empty editor |
| `/labs/vexel/[id]` | `VexelEditor achievementId` | Editor loaded with a saved design (`getAchievement`) |
| `/labs/vexel/generate` | `GalleryMode` | Random designs from `generateRandom` |
| `/labs/vexel/registry` | `RegistryBrowser` | Published designs (`getRegistry`) |
| `/labs/vexel/registry/[id]` | `AchievementDetail` | One design |

Vexel is listed in the Labs app of the sidebar (`src/lib/navigation/app-sections.ts`). Labs requires sign-in and is
hidden when admins switch off `showLabsTab`, except for admins and holders of the `labs.access` permission. The Halo
command palette also lists it (`halo-registry.ts`). The pages themselves are client components with no auth guard,
but saving needs a session.

## 2. Key files

| Path | Role |
| :--- | :--- |
| `src/lib/heraldry/composition-schema.ts` | Zod `compositionSchema` for a design |
| `src/lib/heraldry/blazon.ts` | `generateBlazon(composition)` |
| `src/lib/heraldry/validation.ts` | `validateComposition`: tincture rule warnings |
| `src/lib/heraldry/generator.ts` | `generateRandomComposition(options)` |
| `src/lib/heraldry/layout.ts`, `types.ts`, `constants.ts` | Layout and shared types |
| `src/components/maps/vexel/VexelEditor.tsx` | Editor shell with `VexelEditorProvider` |
| `src/components/maps/vexel/panels/` | Layers, Properties, Preview, Blazon, Validation, Charge library, Commons browser |
| `src/components/maps/vexel/renderer/ShieldRenderer.tsx` | SVG shield (`#vexel-shield-canvas`) |
| `src/components/maps/vexel/SaveControls.tsx` | Title, subject, Save, Publish, Attach to map, Export |
| `src/components/maps/vexel/ExportDialog.tsx` | SVG and PNG (256 px, 1024 px) downloads |
| `src/components/maps/vexel/RevisionHistory.tsx` | Revision list and restore |

## 3. Data model

`prisma/schema/heraldry.prisma`:

| Model | Fields of note |
| :--- | :--- |
| `HeraldryAchievement` | `ownerId` (Clerk id), `subjectType` (`COUNTRY`, `CHARACTER`, `INSTITUTION`, `DYNASTY`), `subjectId`, `title`, `compositionData` (JSON), `generatedBlazon`, `svgData`, `thumbnailUrl`, `largeUrl`, `validationWarnings`, `isPublished`, `publishedAt` |
| `HeraldryRevision` | Snapshot of `compositionData` and `generatedBlazon` per save |
| `HeraldryCharge` | Charge library: `name`, `category` (`ChargeCategory`), `keywords`, `svgData`, `source`, `sourceUrl`, `author`, `license` |

`thumbnailUrl` and `largeUrl` exist on the model but no code writes them.

## 4. Procedures

`api.heraldry.*`:

| Procedure | Auth | What it does |
| :--- | :--- | :--- |
| `getAchievement` | public | One design by id, published or not |
| `getRegistry` | public | Published designs, newest first, optional `subjectType` filter |
| `getChargeLibrary` | public | Charges, with name/keyword search and category filter |
| `getChargeById` | public | One charge |
| `generateRandom` | public | 1–12 random compositions; optional culture, religion, government type and national colours |
| `getRevisionHistory` | protected | Revisions of a design |
| `saveAchievement` | protected | Create, or update when `id` is given (owner or system owner only). Computes the blazon and warnings, stores the client's serialized SVG in `svgData`, and writes a `HeraldryRevision` |
| `publishAchievement`, `unpublishAchievement` | protected | Owner or system owner |
| `importCommonsCharge` | protected | Downloads an SVG from `input.url` on the server and saves it as a `COMMONS` charge |
| `attachToCountry` | protected | Owner of the design plus `assertCountryWriteAccess` on the country. See below |

### Attach to country

The **Attach to map** button shows when the subject type is Country, a country is chosen and the design has been
saved. `attachToCountry` copies `thumbnailUrl ?? largeUrl` into `Country.coatOfArms`, invalidates the
`countries.` cache and clears the political map layer cache.

Because nothing fills `thumbnailUrl` or `largeUrl`, the call fails with `BAD_REQUEST` ("This design has no rendered
image yet…") and the country's coat of arms is left unchanged. The guard is tested in
`src/tests/server/api/routers/heraldry-attach-guard.test.ts`. Before the guard, the attach wrote an empty string.

### Export

Export happens in the browser. `ExportDialog` serializes `#vexel-shield-canvas` to SVG, and draws it onto a canvas
for PNG at 256 or 1024 px. There is no server-side PNG rendering and no stored image, which is why attach cannot
work yet.

## 5. Jobs

None.

## 6. Known gaps

- **Server-side PNG rendering is not built**, so `thumbnailUrl`/`largeUrl` stay empty and attach to country always
  fails. Players set their coat of arms in the Country Editor (national identity) and their flag there or in
  Settings instead.
- **`importCommonsCharge` fetches any URL the caller sends** (`mutations.ts:164`). It is not limited to Wikimedia
  Commons. The response is stored unsanitized as a shared charge, and `ChargeLibraryPanel` and `ShieldRenderer` inject
  charge SVG with `dangerouslySetInnerHTML`. Any signed-in user can therefore add markup that runs for everyone who
  opens the charge library.
- `getAchievement` is public and returns unpublished designs to anyone with the id. `getRevisionHistory` has no
  ownership check.
- Only the shield is drawn. Helm, crest, mantling, supporters, motto and compartment exist in the types, but the
  renderer ignores them (see the PRD status table).
- Saving is manual; there is no autosave.
- The registry has no moderation tools.

## Related documentation

- [Vexel PRD](../specs/2026-07-15-vexel-prd.md) (requirements and status table)
- [Maps](./maps.md): the political map layer whose cache attach clears
