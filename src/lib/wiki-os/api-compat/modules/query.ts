/**
 * query.ts — `action=query`: meta, list and prop modules, generators and page selectors (plan 410).
 *
 * The orchestrator runs the requested modules in MediaWiki's order: meta modules, list modules, then
 * (when pages are named or generated) the page set and the prop modules over it. Each module family
 * lives in its own file and registers here.
 */

import { Continuation } from "../continuation";
import { unavailable } from "../errors";
import type { JsonObject, JsonValue } from "../format";
import { buildPageSet, pageStub, type PageSelectors, type PageSet } from "../pages";
import { HIGH_VALUE_LIMIT, NORMAL_VALUE_LIMIT } from "../params";
import type { ApiContext } from "../types";
import { DEFERRED_REASON } from "./deferred";
import { generatorFor, generatorNames, type GeneratorResult } from "./generator";
import { LIST_MODULES } from "./query-list";
import { metaSiteinfo, metaTokens, metaUserinfo } from "./query-meta";
import {
  propCategories,
  propInfo,
  propLinks,
  propPageprops,
  propRevisions,
  type PropContext,
  type PropModule,
} from "./query-prop";

type MetaModule = (rc: ApiContext) => JsonObject | Promise<JsonObject>;

const META_MODULES: Readonly<Record<string, MetaModule>> = {
  siteinfo: metaSiteinfo,
  userinfo: metaUserinfo,
  tokens: metaTokens,
};

const deferredProp =
  (name: string): PropModule =>
  async () => {
    throw unavailable("prop", name, DEFERRED_REASON);
  };

const PROP_MODULES: Readonly<Record<string, PropModule>> = {
  info: propInfo,
  revisions: propRevisions,
  categories: propCategories,
  links: propLinks,
  pageprops: propPageprops,
  templates: deferredProp("templates"),
  images: deferredProp("images"),
};

function pageSelectors(rc: ApiContext): PageSelectors {
  const p = rc.params;
  const max = rc.highLimits ? HIGH_VALUE_LIMIT : NORMAL_VALUE_LIMIT;
  return {
    titles: p.list("titles", max),
    pageIds: p.integerList("pageids", max),
    revIds: p.integerList("revids", max),
    resolveRedirects: p.flag("redirects"),
  };
}

const hasSelectors = (selectors: PageSelectors) =>
  selectors.titles.length + selectors.pageIds.length + selectors.revIds.length > 0;

/**
 * The page set a request works on: the named pages, or what its generator produced (then `produced`
 * is set, for `finishGenerator`).
 */
async function resolvePageSet(
  rc: ApiContext,
  selectors: PageSelectors,
  generator: string | undefined
): Promise<{ pageSet: PageSet; produced: GeneratorResult | null }> {
  const { store } = rc.deps;
  if (!generator) return { pageSet: await buildPageSet(store, selectors), produced: null };
  const base = await buildPageSet(store, { ...selectors, resolveRedirects: false });
  const produced = await generatorFor(generator)(rc, base);
  const pageSet = await buildPageSet(store, {
    titles: produced.titles,
    pageIds: [],
    revIds: [],
    resolveRedirects: selectors.resolveRedirects,
  });
  return { pageSet, produced };
}

/**
 * The generator moves on only once every prop has finished the current batch: while a prop has
 * more for these pages the response asks for the same batch again (the generator's continue value
 * stays where the request had it).
 */
function finishGenerator(
  rc: ApiContext,
  continuation: Continuation,
  produced: GeneratorResult
): void {
  if (continuation.batchComplete) {
    if (produced.next !== null) continuation.addGenerator(produced.continueParam, produced.next);
    return;
  }
  continuation.addGenerator(produced.continueParam, rc.params.raw(produced.continueParam) ?? "");
}

function assemblePages(rc: ApiContext, pageSet: PageSet, out: Map<number, JsonObject>): JsonObject {
  const result: JsonObject = {};
  if (pageSet.normalized.length > 0) {
    result.normalized = pageSet.normalized.map((change) => ({ fromencoded: false, ...change }));
  }
  if (pageSet.redirects.length > 0) result.redirects = pageSet.redirects.map((change) => ({ ...change }));
  if (pageSet.badRevIds.length > 0) {
    result.badrevids = Object.fromEntries(
      pageSet.badRevIds.map((id) => [String(id), { revid: id }])
    );
  }
  if (pageSet.entries.length > 0) {
    const pages = pageSet.entries.map((entry) => out.get(entry.key) ?? pageStub(entry));
    result.pages =
      rc.version === 1
        ? Object.fromEntries(
            pageSet.entries.map((entry, index) => [String(entry.key), pages[index] as JsonValue])
          )
        : pages;
    if (rc.params.flag("indexpageids")) result.pageids = pageSet.entries.map((e) => String(e.key));
  }
  return result;
}

export async function runQuery(rc: ApiContext): Promise<JsonObject> {
  const p = rc.params;
  const metas = p.listOf("meta", Object.keys(META_MODULES));
  const lists = p.listOf("list", Object.keys(LIST_MODULES));
  const props = p.listOf("prop", Object.keys(PROP_MODULES));
  const generator = p.oneOf("generator", generatorNames());
  const selectors = pageSelectors(rc);
  const continuation = new Continuation();
  const query: JsonObject = {};

  for (const name of metas) Object.assign(query, await META_MODULES[name]!(rc));

  for (const name of lists) {
    const listModule = LIST_MODULES[name]!;
    const scoped = p.scope(listModule.prefix, name);
    const { items, next, extra } = await listModule.run(rc, scoped);
    query[listModule.resultKey] = items;
    Object.assign(query, extra);
    if (next !== null) continuation.add(scoped.fullName(listModule.continueParam ?? "continue"), next);
  }

  if (generator || props.length > 0 || hasSelectors(selectors)) {
    const { pageSet, produced } = await resolvePageSet(rc, selectors, generator);
    const out = new Map(pageSet.entries.map((entry) => [entry.key, pageStub(entry)]));
    const pc: PropContext = { rc, pageSet, out, continuation };
    for (const name of props) await PROP_MODULES[name]!(pc);
    if (produced) finishGenerator(rc, continuation, produced);
    Object.assign(query, assemblePages(rc, pageSet, out));
  }

  return {
    ...continuation.toResult(),
    ...(Object.keys(query).length > 0 ? { query } : {}),
  };
}
