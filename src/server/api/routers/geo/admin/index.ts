/**
 * Geo Admin router: the province import pipeline (parse, validate, commit, preview). `root.ts` merges the cities
 * router in beside it, so the public API path `api.geoAdmin.*` is unchanged.
 */
export { geoAdminProvincesRouter as geoAdminRouter } from "./provinces";
