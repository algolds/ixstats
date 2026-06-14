/**
 * Geo Admin router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.geoAdmin.*` is byte-identical to the former monolith — no call sites change,
 * and root.ts (which imports `./routers/geo/admin`) resolves to this index unchanged.
 *
 * Domains:
 *  - uploads:   SVG intake (upload, server-side process, pre-commit preview)
 *  - commits:   SVG commit / rollback / history / delete (heavy DB writes + management)
 *  - templates: world template / clone system (export, download, import, list, delete)
 *  - provinces: province import pipeline (parse, validate, commit, preview)
 */
import { mergeRouters } from "~/server/api/trpc";
import { geoAdminUploadsRouter } from "./uploads";
import { geoAdminCommitsRouter } from "./commits";
import { geoAdminTemplatesRouter } from "./templates";
import { geoAdminProvincesRouter } from "./provinces";

export const geoAdminRouter = mergeRouters(
  geoAdminUploadsRouter,
  geoAdminCommitsRouter,
  geoAdminTemplatesRouter,
  geoAdminProvincesRouter
);
