/**
 * Tax system router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.taxSystem.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - crud:         tax-system persistence (create, update, delete, getByCountryId, autosave)
 *  - calculations: heavy tax computation — live tax, unified effectiveness, tier recommendations
 *  - analysis:     effectiveness scoring, conflict detection, and economic-data parsing
 */
import { mergeRouters } from "~/server/api/trpc";
import { taxSystemCrudRouter } from "./crud";
import { taxSystemCalculationsRouter } from "./calculations";
import { taxSystemAnalysisRouter } from "./analysis";

export const taxSystemRouter = mergeRouters(
  taxSystemCrudRouter,
  taxSystemCalculationsRouter,
  taxSystemAnalysisRouter
);
