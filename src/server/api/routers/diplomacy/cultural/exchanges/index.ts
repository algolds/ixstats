/**
 * Diplomatic cultural exchanges router — split across files by domain (2026-06-13) and
 * recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * (`api.diplomaticCulturalExchanges.*` / wherever this router is mounted) is byte-identical
 * to the former monolith — no call sites change.
 *
 * Domains:
 *  - core:    cultural exchange read/create/join (queries + mutations)
 *  - missions: linking existing cultural exchanges to embassy missions
 */
import { mergeRouters } from "~/server/api/trpc";
import { diplomaticCulturalExchangesCoreRouter } from "./core";
import { diplomaticCulturalExchangesMissionsRouter } from "./missions";

export const diplomaticCulturalExchangesRouter = mergeRouters(
  diplomaticCulturalExchangesCoreRouter,
  diplomaticCulturalExchangesMissionsRouter
);
