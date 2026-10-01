/**
 * query.ts — `action=query`: meta, list and prop modules, generators and page selectors (plan 410).
 *
 * The orchestrator runs the requested modules in MediaWiki's order: meta modules, list modules, then
 * (when pages are named or generated) the page set and the prop modules over it. Each module family
 * lives in its own file and registers here.
 */

import { Continuation } from "../continuation";
import { badValues } from "../errors";
import type { JsonObject } from "../format";
import type { ApiContext } from "../types";
import { metaSiteinfo, metaTokens, metaUserinfo } from "./query-meta";

type MetaModule = (rc: ApiContext) => JsonObject | Promise<JsonObject>;

const META_MODULES: Readonly<Record<string, MetaModule>> = {
  siteinfo: metaSiteinfo,
  userinfo: metaUserinfo,
  tokens: metaTokens,
};

export async function runQuery(rc: ApiContext): Promise<JsonObject> {
  const p = rc.params;
  const metas = p.listOf("meta", Object.keys(META_MODULES));
  const continuation = new Continuation();

  const query: JsonObject = {};
  for (const name of metas) {
    const handler = META_MODULES[name];
    if (!handler) throw badValues("meta", [name]);
    Object.assign(query, await handler(rc));
  }

  return {
    ...continuation.toResult(),
    ...(Object.keys(query).length > 0 ? { query } : {}),
  };
}
