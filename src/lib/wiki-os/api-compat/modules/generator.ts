/**
 * generator.ts — `action=query&generator=...` (plan 410).
 *
 * A generator produces the titles of the page set. The list modules that list pages (allpages,
 * categorymembers, backlinks, search, recentchanges, random) run as generators with their
 * parameters prefixed `g` (`gaplimit`); `links` lists what the named pages link to.
 */

import { badValues } from "../errors";
import { encodeCursor, optionalCursor } from "../continuation";
import type { PageSet } from "../pages";
import type { LinkRow, PerPageQuery, PerPageResult } from "../store-types";
import type { ApiContext } from "../types";
import { LIST_MODULES } from "./query-list";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";

export interface GeneratorResult {
  titles: string[];
  /** The generator's continuation parameter (`gapcontinue`). */
  continueParam: string;
  /** Where the next batch starts, or null when this was the last. */
  next: string | null;
}

type GeneratorRun = (rc: ApiContext, base: PageSet) => Promise<GeneratorResult>;

/** What the "what the named pages link to, transclude or use" generators read from the store. */
type PerPageFetch = (rc: ApiContext, query: PerPageQuery) => Promise<PerPageResult<LinkRow>>;

/** `generator=links|templates|images`: the titles the named pages link to, transclude or use (`gpl`, `gtl`, `gim`). */
function perPageGenerator(prefix: string, module: string, fetch: PerPageFetch): GeneratorRun {
  return async (rc, base) => {
    const p = rc.params.scope(prefix, module);
    const pages = base.entries.filter((entry) => entry.state === "exists" && entry.row);
    const limit = p.limit("limit", { fallback: 10, high: rc.highLimits });
    const cursor = optionalCursor(p.raw("continue"), ["n", "s"] as const);
    const namespaces = p.has("namespace") ? p.list("namespace").map(Number).filter(Number.isInteger) : undefined;
    const { rows, next } = await fetch(rc, {
      articleIds: pages.map((entry) => entry.row!.articleId),
      namespaces,
      dir: "ascending",
      limit,
      cursor: cursor ? { pageId: cursor[0], key: cursor[1] } : undefined,
    });
    return {
      titles: [...new Set(rows.map((row) => row.title))],
      continueParam: p.fullName("continue"),
      next: next ? encodeCursor([next.pageId, next.key]) : null,
    };
  };
}

function listGenerator(name: string): GeneratorRun {
  return async (rc) => {
    const listModule = LIST_MODULES[name]!;
    const p = rc.params.scope(`g${listModule.prefix}`, name);
    const { items, next } = await listModule.run(rc, p);
    return {
      titles: items.flatMap((item) =>
        typeof item.title === "string" ? [canonicalizeTitle(item.title)?.title ?? item.title] : []
      ),
      continueParam: p.fullName(listModule.continueParam ?? "continue"),
      next,
    };
  };
}

const GENERATOR_LIST_NAMES = (): string[] =>
  Object.entries(LIST_MODULES)
    .filter(([, listModule]) => listModule.generator)
    .map(([name]) => name);

export const GENERATORS: Readonly<Record<string, GeneratorRun>> = {
  links: perPageGenerator("gpl", "links", (rc, query) => rc.deps.store.linksFrom(query)),
  templates: perPageGenerator("gtl", "templates", (rc, query) => rc.deps.store.templatesOf(query)),
  images: perPageGenerator("gim", "images", (rc, query) => rc.deps.store.imagesOf(query)),
};

/** Names a request may give as `generator`. */
export function generatorNames(): string[] {
  return [...new Set([...Object.keys(GENERATORS), ...GENERATOR_LIST_NAMES()])];
}

export function generatorFor(name: string): GeneratorRun {
  const direct = Object.hasOwn(GENERATORS, name) ? GENERATORS[name] : undefined;
  if (direct) return direct;
  if (GENERATOR_LIST_NAMES().includes(name)) return listGenerator(name);
  throw badValues("generator", [name]);
}
