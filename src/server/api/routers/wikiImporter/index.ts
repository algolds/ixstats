/**
 * Wiki Importer router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.wikiImporter.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - mapping:   infobox parse/preview + comprehensive country import (creates 9 DB tables)
 *  - deep:      full-article semantic extraction with IxWorld geographic matching
 *  - discovery: multi-source page fetch, cross-wiki search, and source listing
 */
import { mergeRouters } from "~/server/api/trpc";
import { wikiImporterMappingRouter } from "./mapping";
import { wikiImporterDeepRouter } from "./deep";
import { wikiImporterDiscoveryRouter } from "./discovery";

export const wikiImporterRouter = mergeRouters(
  wikiImporterMappingRouter,
  wikiImporterDeepRouter,
  wikiImporterDiscoveryRouter
);
