/**
 * Geo Features Subdivisions Router — split across domain subrouters and recombined here via mergeRouters.
 */
import { mergeRouters } from "~/server/api/trpc";
import { geoFeaturesSubdivisionsCrudRouter } from "./crud";
import { geoFeaturesSubdivisionsGenerationRouter } from "./generation";

export const geoFeaturesSubdivisionsRouter = mergeRouters(
  geoFeaturesSubdivisionsCrudRouter,
  geoFeaturesSubdivisionsGenerationRouter
);
