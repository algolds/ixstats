/**
 * Geo Admin router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.geoAdmin.*` is byte-identical to the former monolith — no call sites change,
 * and root.ts (which imports `./routers/geo/admin`) resolves to this index unchanged.
 *
 * Domains:
 *  - provinces: province import pipeline (parse, validate, commit, preview)
 */
import { mergeRouters } from "~/server/api/trpc";
import { geoAdminProvincesRouter } from "./provinces";

export const geoAdminRouter = mergeRouters(geoAdminProvincesRouter);
