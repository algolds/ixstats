# Atlas ship plan — finishing the geography engine for realm founders

**Last updated:** 2026-10-11 · **Status:** decided, not built · **Specs:**
[Release 0 — performance](2026-10-11-atlas-release-0-performance-design.md) ·
[Release A — world creation](2026-10-11-atlas-release-a-world-creation-design.md)

Atlas is the spatial engine (`VERSIONS.engines.atlas`): world generation, the map viewer, the world editor, map
import, terrain/climate/hydrology data and the geography the simulation reads. This plan records what "shipping
Atlas" means and every scope decision the owner made on 2026-10-11, so each release can be specced and built on
its own. Background: the [Atlas audit](../history/roadmap/platform-audit/atlas.md) (2026-09-30) and the 2026-10-11
worldgen audit and performance audits (summarised in the Release 0 spec).

## Who it is finished for

**Realm founders.** A founder creates their realm's world (generate, import, sketch or draw), shapes it, and opens
it for nations; players then live on a geography that matters to their nation. Standalone worldbuilders
(maps.ixwiki.com as its own product) are out of scope.

## Releases

Each release gets its own spec → plan → PR. Order is fixed: 0 → A → B → C → D.

| Release                             | Goal                                                                                                                                                                                                         | Depends on  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| **0 — Performance**                 | Fast tiles and layers, real `Country` geometry, a non-janky editor, three editor correctness bugs                                                                                                            | —           |
| **A — World creation**              | A founder generates a world from presets, or generates terrain, rivers and climate to fit their imported map, in the world editor, and opens it with claimable nation slots; hillshade relief on every realm | 0           |
| **B — Shaping & open land**         | Terrain brushes with local re-simulation and "reroll this area" on unclaimed land; **sketch-then-generate** and **start-blank** creation (both feed the generate-to-fit mask from A); open-land founding     | A           |
| **C — Geography drives the nation** | Exact profiles feed the economy; generated resources and a resources game                                                                                                                                    | A (heights) |
| **D — Formats & planet**            | GeoJSON/PNG/SVG export; Azgaar `.map` and heightmap import; per-realm currents/winds and climate knobs                                                                                                       | A           |

## Decisions (2026-10-11)

| Topic                      | Decision                                                                                                                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Creation sources (overall) | All four: **generate from presets**, **import own map** (generator fills missing layers to fit), **sketch then generate**, **start blank and draw**. One core: a land/ocean mask in, the generator fills terrain, rivers, climate and borders |
| Political start            | **Founder chooses per world:** claimable nation slots, or open land                                                                                                                                                                           |
| Open-land territory        | **Mix:** claim pre-cut parcels, then refine borders through the review queue. Parcels are generator claim units, **not provinces** (see below)                                                                                                |
| Provinces                  | **Player-made.** The generator never creates `Subdivision` rows                                                                                                                                                                               |
| Named features             | **None generated.** No cities, named rivers/lakes, peaks or labels; players and founders make those. Nation slots get generated _suggested_ names the claimant can keep                                                                       |
| Physical editing           | **Brushes + regen** (raise/lower, paint coast/mountains/climate; rivers, lakes and biomes re-simulate; reroll an area) — Release B                                                                                                            |
| Claimed land               | **Locked to founder brushes.** Owners propose physical edits to their own land through the review queue                                                                                                                                       |
| Geography → simulation     | **Yes, plus a resources game** — Release C                                                                                                                                                                                                    |
| Map look                   | **Hillshade under the elevation bands**, per realm (Release A); no 3D, no painted style                                                                                                                                                       |
| Formats                    | **GeoJSON in/out, PNG/SVG export, Azgaar `.map` import, heightmap PNG import** (GeoJSON political import already exists) — Release D                                                                                                          |
| Per-realm planet           | **Currents & winds** derived from the realm's geography and **climate knobs** for founders — Release D. Planet radius per realm already exists (`MapSection`); per-realm map styles are out of scope                                          |
| Shipping                   | **Phased**, founder MVP first, with a performance pass (Release 0) before it                                                                                                                                                                  |

Release A's own decisions (who creates, slot tools, baseline, lock, UI placement, relief) are in its spec.

## Open questions for later releases

- **B:** the parcel grid for open-land claims (size, shape, how parcels relate to player provinces drawn later);
  how a "reroll this area" respects nearby claimed borders.
- **C:** resource model and how the resources game plugs into trade and the economy tick.
- **D:** Azgaar `.map` versions supported; export bundle layout.
- **Versioning:** whether each release bumps `VERSIONS.engines.atlas` (now 5) and how the changelog names them
  (asked at each merge, per `docs/reference/revision.md`).
