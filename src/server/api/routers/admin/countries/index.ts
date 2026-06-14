/**
 * Admin countries router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.admin.countries.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - import:  roster file analyze + import (parseRosterFile, create/update country rows)
 *  - godMode: system-owner direct country writes, bulk update, audit log, scenarios, announcements, maintenance
 *  - grid:    admin country grid (sort/filter/search) and per-country detail drill-down
 */
import { mergeRouters } from "~/server/api/trpc";
import { adminCountriesImportRouter } from "./import";
import { adminCountriesGodModeRouter } from "./godMode";
import { adminCountriesGridRouter } from "./grid";

export const adminCountriesRouter = mergeRouters(
  adminCountriesImportRouter,
  adminCountriesGodModeRouter,
  adminCountriesGridRouter
);
