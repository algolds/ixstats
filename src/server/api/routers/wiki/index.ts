/**
 * Wiki router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.wiki.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - articles:  article content access (intro/wikitext/infobox/sections/coords/section content/search)
 *  - media:     files, images, downloads, categories (search/list/subcategories/autocomplete)
 *  - discovery: province-map heuristics, country map markers, recent changes, forum thread preview
 *  - data:      dynamic placeholder resolution (countries/businesses) and approved-business search
 *
 * NOTE: `resolveWikiPlaceholdersInternal` is a module-level helper consumed by 7 wikios
 * sub-router files via `import { resolveWikiPlaceholdersInternal } from "../wiki"`. It is
 * re-exported here from ./data (its canonical home — the procedure that calls it lives in
 * the `data` group) so the existing import path continues to resolve.
 */
import { mergeRouters } from "~/server/api/trpc";
import { wikiArticlesRouter } from "./articles";
import { wikiMediaRouter } from "./media";
import { wikiDiscoveryRouter } from "./discovery";
import { wikiDataRouter } from "./data";

export const wikiRouter = mergeRouters(
  wikiArticlesRouter,
  wikiMediaRouter,
  wikiDiscoveryRouter,
  wikiDataRouter
);

export { resolveWikiPlaceholdersInternal } from "./data";
