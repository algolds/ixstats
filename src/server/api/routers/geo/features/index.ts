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
 *  - storylines:   ordered chains of story pins (storyline CRUD, add/remove pins)
 *  - labels:       map labels (styled text overlays for regions, ranges, seas, etc.)
 *  - realmLabels:  a realm's own labels (oceans, seas, regions, continents), for its map editors
 */
import { mergeRouters } from "~/server/api/trpc";
import { geoFeaturesCitiesRouter } from "./cities";
import { geoFeaturesSubdivisionsRouter } from "./subdivisions";
import { geoFeaturesPoisRouter } from "./pois";
import { geoFeaturesStoryPinsRouter } from "./storyPins";
import { geoFeaturesStorylinesRouter } from "./storylines";
import { geoFeaturesLabelsRouter } from "./labels";
import { geoFeaturesRealmLabelsRouter } from "./realm-labels";
import { geoFeaturesNamedFeaturesRouter } from "./namedFeatures";

export const geoFeaturesRouter = mergeRouters(
  geoFeaturesCitiesRouter,
  geoFeaturesSubdivisionsRouter,
  geoFeaturesPoisRouter,
  geoFeaturesStoryPinsRouter,
  geoFeaturesStorylinesRouter,
  geoFeaturesLabelsRouter,
  geoFeaturesRealmLabelsRouter,
  geoFeaturesNamedFeaturesRouter
);
