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
 */
import { mergeRouters } from "~/server/api/trpc";
import { diplomaticCulturalExchangesCoreRouter } from "./core";

export const diplomaticCulturalExchangesRouter = mergeRouters(
  diplomaticCulturalExchangesCoreRouter
);
