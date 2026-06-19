/**
 * Geo Features router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.geoFeatures.*` is byte-identical to the former monolith — no call sites change,
 * and root.ts (which imports `./routers/geo/features`) resolves to this index unchanged.
 *
 * Domains:
 *  - cities:       city CRUD (point features)
 *  - subdivisions: subdivision CRUD, batch simplification, painter stats, bulk delete
 *  - pois:         point of interest CRUD (including resource POIs with storyteller effects)
 *  - storyPins:    narrative markers on the map (story pin CRUD + queries)
 *  - storylines:   narrative chains connecting story pins (storyline CRUD + queries)
 *  - labels:       map labels (styled text overlays for regions, ranges, seas, etc.)
 */
import { mergeRouters } from "~/server/api/trpc";
import { geoFeaturesCitiesRouter } from "./cities";
import { geoFeaturesSubdivisionsRouter } from "./subdivisions";
import { geoFeaturesPoisRouter } from "./pois";
import { geoFeaturesStoryPinsRouter } from "./storyPins";
import { geoFeaturesStorylinesRouter } from "./storylines";
import { geoFeaturesLabelsRouter } from "./labels";
import { geoFeaturesNamedFeaturesRouter } from "./namedFeatures";

export const geoFeaturesRouter = mergeRouters(
  geoFeaturesCitiesRouter,
  geoFeaturesSubdivisionsRouter,
  geoFeaturesPoisRouter,
  geoFeaturesStoryPinsRouter,
  geoFeaturesStorylinesRouter,
  geoFeaturesLabelsRouter,
  geoFeaturesNamedFeaturesRouter
);

// Preserve the original public API surface of `geo/features` (now resolves to this
// index.ts). External consumers like `routers/transport.ts` import these helpers from
// `./geo/features` directly, so re-export them here unchanged.
export { syncGeographicDemographics, syncResourcePoolModifiers } from "./pois";
