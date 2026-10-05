# Vexel — Heraldry Studio

**Last updated:** 2026-10-05
**Status:** Labs. The editor, generator, registry, export and attach to country work. Saving a design renders it
to PNG on the server, and that image is what attach writes as the country's coat of arms.
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
| `src/lib/heraldry/shield-scene.ts` | `buildShieldScene` (the drawn shield as data) and `serializeShieldSvg` (standalone SVG). Shared by the editor and the server render |
| `src/lib/heraldry/svg-utils.ts`, `charge-paths.ts` | Shield outlines, division and ordinary paths, template charge paths |
| `src/server/api/routers/heraldry/render.ts` | Server render: stored composition to 256 px and 1024 px PNGs (sharp) in the uploads directory |
| `src/components/maps/vexel/VexelEditor.tsx` | Editor shell with `VexelEditorProvider` |
| `src/components/maps/vexel/panels/` | Layers, Properties, Preview, Blazon, Validation, Charge library, Commons browser |
| `src/components/maps/vexel/renderer/ShieldRenderer.tsx` | SVG shield (`#vexel-shield-canvas`), drawn from `buildShieldScene` |
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

`thumbnailUrl` (256 px) and `largeUrl` (1024 px) are written only by the server render (see
[Rendered images](#rendered-images)).

## 4. Procedures

`api.heraldry.*`:

| Procedure | Auth | What it does |
| :--- | :--- | :--- |
| `getAchievement` | public | One design by id. An unpublished design is returned only to its owner or a system owner |
| `getRegistry` | public | Published designs, newest first, optional `subjectType` filter |
| `getChargeLibrary` | public | Charges, with name/keyword search and category filter |
| `getChargeById` | public | One charge |
| `generateRandom` | public | 1–12 random compositions; optional culture, religion, government type and national colours |
| `getRevisionHistory` | protected | Revisions of a design (owner or system owner only) |
| `saveAchievement` | protected | Create, or update when `id` is given (owner or system owner only). Computes the blazon and warnings, stores the client's serialized SVG in `svgData`, writes a `HeraldryRevision`, then renders the design and stores `thumbnailUrl`/`largeUrl` |
| `renderAchievementImage` | protected | Owner or system owner. Renders the stored design again and stores `thumbnailUrl`/`largeUrl` |
| `publishAchievement`, `unpublishAchievement` | protected | Owner or system owner. Publishing renders the design first if it has no image |
| `importCommonsCharge` | protected | Downloads an SVG from `upload.wikimedia.org` (https only, 512 KB cap), sanitizes it and saves it as a `COMMONS` charge |
| `attachToCountry` | protected | Owner of the design plus `assertCountryWriteAccess` on the country. See below |

### Rendered images

`renderAchievementImages` (`render.ts`) renders from the stored `compositionData`, never from client SVG:

1. Library charges in the composition are loaded from `HeraldryCharge.svgData`. Template charges (`charge-paths.ts`)
   need no lookup.
2. `buildShieldScene` lays out the shield. Each library charge is passed through `sanitizeSvgMarkup` and then loses
   `<image>`/`<feImage>` elements, `href`s that are not `#fragment` links and CSS `@import`, so the SVG has no external
   references.
3. `serializeShieldSvg` writes a standalone SVG framed on the shield (`viewBox` `200 200 600 600`).
4. sharp (already a dependency, bundled librsvg) rasterizes it to PNG at 256 px and 1024 px, transparent background.
5. The files go to the uploads directory (`UPLOAD_DIR`, default `public/images/uploads`, the same place
   `/api/upload/image` writes) as `heraldry_<achievementId>_<hash>_<size>.png`, served at `/images/uploads/…`.

The URLs are built on the server; no procedure accepts an image URL for a design. The editor's `ShieldRenderer`
draws the same `buildShieldScene` output, so the stored image matches the preview (a test compares their paths).

`saveAchievement` renders after every save. If the render fails, the save still succeeds, the error is logged and
both URLs are cleared, so an image of an older version is never attached. Old files are not deleted: a country may
still point at one.

### Attach to country

The **Attach to map** button shows when the subject type is Country, a country is chosen and the design has been
saved. If the saved design has no image yet, the button calls `renderAchievementImage` first ("Rendering..."), then
`attachToCountry`. Attach copies the 256 px `thumbnailUrl` (or `largeUrl`) into `Country.coatOfArms`, invalidates the
`countries.` cache and clears the political map layer cache. It attaches the last saved version, not unsaved edits.

`attachToCountry` still refuses with `BAD_REQUEST` ("This design has no rendered image yet…") when neither URL is a
Vexel render (`RENDERED_IMAGE_URL` in `render.ts`), and leaves the country's coat of arms unchanged. Tests:
`src/tests/server/api/routers/heraldry-attach-guard.test.ts`, `heraldry-render.test.ts`.

### Export

Export happens in the browser. `ExportDialog` serializes `#vexel-shield-canvas` to SVG, and draws it onto a canvas
for PNG at 256 or 1024 px. Downloads are separate from the stored images above.

## 5. Jobs

None.

## 6. Known gaps

- Designs saved before rendering existed have no image until they are saved, published or attached again.
- `saveAchievement` still stores the client's serialized SVG in `svgData` as sent. Nothing reads it.
- Only the shield is drawn. Helm, crest, mantling, supporters, motto and compartment exist in the types, but the
  renderer ignores them (see the PRD status table).
- Saving is manual; there is no autosave.
- The registry has no moderation tools.

## Related documentation

- [Vexel PRD](../specs/2026-07-15-vexel-prd.md) (requirements and status table)
- [Maps](./maps.md): the political map layer whose cache attach clears
