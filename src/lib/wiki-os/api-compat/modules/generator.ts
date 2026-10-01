/**
 * generator.ts — `action=query&generator=...` (plan 410).
 *
 * A generator produces the titles of the page set. The list modules that list pages (allpages,
 * categorymembers, backlinks, search, recentchanges, random) run as generators with their
 * parameters prefixed `g` (`gaplimit`); `links` lists what the named pages link to.
 */

import { badValues, unavailable } from "../errors";
import { encodeCursor, optionalCursor } from "../continuation";
import type { PageSet } from "../pages";
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

/** What the deferred modules wait for: plan 406's template and image link tables. */
export const DEFERRED_REASON =
  "WikiOS has no template or image link tables yet (plan 406), so this module is not available.";

const deferred =
  (name: string): GeneratorRun =>
  async () => {
    throw unavailable("generator", name, DEFERRED_REASON);
  };

async function linksGenerator(rc: ApiContext, base: PageSet): Promise<GeneratorResult> {
  const p = rc.params.scope("gpl", "links");
  const pages = base.entries.filter((entry) => entry.state === "exists" && entry.row);
  const limit = p.limit("limit", { fallback: 10, high: rc.highLimits });
  const cursor = optionalCursor(p.raw("continue"), ["n", "s"] as const);
  const namespaces = p.has("namespace") ? p.list("namespace").map(Number).filter(Number.isInteger) : undefined;
  const { rows, next } = await rc.deps.store.linksFrom({
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
      continueParam: p.fullName("continue"),
      next,
    };
  };
}

const GENERATOR_LIST_NAMES = (): string[] =>
  Object.entries(LIST_MODULES)
    .filter(([, listModule]) => listModule.generator)
    .map(([name]) => name);

export const GENERATORS: Readonly<Record<string, GeneratorRun>> = {
  links: linksGenerator,
  templates: deferred("templates"),
  images: deferred("images"),
  embeddedin: deferred("embeddedin"),
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
