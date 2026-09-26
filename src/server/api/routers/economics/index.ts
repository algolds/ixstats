/**
 * Economics router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.economics.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - config:  comprehensive economy configuration save/get (transaction endpoints)
 *  - builder: economy builder live wiring — state save/get + autosave
 *  - sync:    cross-system sync (government components, tax system)
 */
import { mergeRouters } from "~/server/api/trpc";
import { economicsConfigRouter } from "./config";
import { economicsBuilderRouter } from "./builder";
import { economicsSyncRouter } from "./sync";

export const economicsRouter = mergeRouters(
  economicsConfigRouter,
  economicsBuilderRouter,
  economicsSyncRouter
);
