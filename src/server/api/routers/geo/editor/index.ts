/**
 * Geo Editor router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.geoEditor.*` is byte-identical to the former monolith — no call sites change,
 * and root.ts (which imports `./routers/geo/editor`) resolves to this index unchanged.
 *
 * Domains:
 *  - linkage:    feature ↔ country linking, feature properties, linkage validation/repair
 *  - queue:      edit-request review queue (approve/reject) and per-country edit history
 *  - borders:    border editor sessions, drafts, submit, split/merge
 *  - procedural: procedural world generation and the SVG/import map pipeline
 */
import { mergeRouters } from "~/server/api/trpc";
import { geoEditorLinkageRouter } from "./linkage";
import { geoEditorQueueRouter } from "./queue";
import { geoEditorBordersRouter } from "./borders";
import { geoEditorProceduralRouter } from "./procedural";

export const geoEditorRouter = mergeRouters(
  geoEditorLinkageRouter,
  geoEditorQueueRouter,
  geoEditorBordersRouter,
  geoEditorProceduralRouter
);
