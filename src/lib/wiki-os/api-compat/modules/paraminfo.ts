/**
 * paraminfo.ts — `action=paraminfo` (plan 410): what each module is called, where it lives and
 * which parameters it takes. Pywikibot's QueryGenerator asks for it before every list or prop
 * query (the allowed submodule names, the `limit` parameter and its maximum).
 *
 * The parameters are not kept here: each module is run over empty parameters that record what it
 * reads (`introspect.ts`), so the answer is the module's own code, never a second table.
 */

import type { JsonObject } from "../format";
import { introspectParams, type IntrospectedParams } from "../introspect";
import {
  HIGH_LIMIT,
  HIGH_VALUE_LIMIT,
  MAX_MODULE_VALUES,
  NORMAL_LIMIT,
  NORMAL_VALUE_LIMIT,
  type ParamDefinition,
} from "../params";
import { readMainParams } from "../main-params";
import type { ModuleInfo } from "../registry";
import type { ApiContext } from "../types";

/** One parameter in MediaWiki's `paraminfo` shape. */
function parameterEntry(definition: ParamDefinition): JsonObject {
  const { name, type, multi, required } = definition;
  const kind = definition.loose ? "string" : type;
  const entry: JsonObject = { name, type: typeof kind === "string" ? kind : [...kind] };
  if (definition.default !== undefined) entry.default = String(definition.default);
  if (required) entry.required = true;
  if (multi) {
    entry.multi = true;
    const limit = definition.limit ?? MAX_MODULE_VALUES;
    entry.limit = limit;
    entry.highlimit = limit === NORMAL_VALUE_LIMIT ? HIGH_VALUE_LIMIT : Math.max(limit, HIGH_VALUE_LIMIT);
  }
  if (kind === "limit") {
    entry.min = 1;
    entry.max = NORMAL_LIMIT;
    entry.highmax = HIGH_LIMIT;
  } else if (kind === "integer") {
    if (definition.min !== undefined) entry.min = definition.min;
    if (definition.max !== undefined) entry.max = definition.max;
  }
  return entry;
}

const described = new Map<string, IntrospectedParams>();

/** A module's parameters, read once per process (a module's parameters do not change). */
async function describeOnce(module: ModuleInfo): Promise<IntrospectedParams> {
  const known = described.get(module.path);
  if (known) return known;
  const read = await module.describe();
  described.set(module.path, read);
  return read;
}

async function moduleEntry(module: ModuleInfo): Promise<JsonObject> {
  const { prefix, parameters } = await describeOnce(module);
  return {
    name: module.name,
    classname: `Api${module.group === "action" ? "" : "Query"}${module.name.charAt(0).toUpperCase()}${module.name.slice(1)}`,
    path: module.path,
    group: module.group,
    prefix,
    source: "MediaWiki",
    sourcename: "MediaWiki",
    licensetag: "GPL-2.0-or-later",
    helpurls: [],
    examples: [],
    parameters: parameters.map(parameterEntry),
    ...(module.generator ? { generator: true } : {}),
  };
}

/** The main module: read through `readMainParams`, so its list is the one the dispatcher reads. */
async function mainEntry(actionNames: readonly string[]): Promise<JsonObject> {
  const read = await introspectParams((rc: ApiContext) => {
    readMainParams(rc.params, actionNames, { version: 1, errorFormat: "bc" });
  });
  return {
    name: "main",
    classname: "ApiMain",
    path: "main",
    prefix: "",
    source: "MediaWiki",
    sourcename: "MediaWiki",
    licensetag: "GPL-2.0-or-later",
    helpurls: [],
    examples: [],
    parameters: read.parameters.map(parameterEntry),
  };
}

const missing = (path: string): JsonObject => ({ name: path.split("+").pop() ?? path, path, missing: true });

const HELP_FORMATS = ["none", "wikitext", "html", "raw"] as const;

/** Looks a module up by `query+allpages`, or by an action's name. */
const byPath = (modules: readonly ModuleInfo[], path: string) =>
  modules.find((module) => module.path === path) ?? modules.find((module) => module.group === "action" && module.name === path);

/** Looks a query submodule up by its bare name (`allpages`) or its path, in any group. */
const bySubmodule = (modules: readonly ModuleInfo[], name: string) =>
  modules.find((module) => module.group !== "action" && (module.name === name || module.path === name || module.path === `query+${name}`));

export async function runParamInfo(
  rc: ApiContext,
  registry: () => readonly ModuleInfo[],
  actionNames: readonly string[]
): Promise<JsonObject> {
  const p = rc.params.scope("", "paraminfo");
  const wanted = p.list("modules");
  const querySubmodules = p.list("querymodules");
  const withMain = p.flag("mainmodule");
  p.list("formatmodules");
  p.oneOf("helpformat", HELP_FORMATS, "none");

  const modules = registry();
  const entries: JsonObject[] = [];
  const seen = new Set<string>();
  const add = async (key: string, entry: () => Promise<JsonObject>): Promise<void> => {
    if (seen.has(key)) return;
    seen.add(key);
    entries.push(await entry());
  };
  for (const path of withMain ? ["main", ...wanted] : wanted) {
    const found = path === "main" ? undefined : byPath(modules, path);
    await add(path, () => (path === "main" ? mainEntry(actionNames) : found ? moduleEntry(found) : Promise.resolve(missing(path))));
  }
  for (const name of querySubmodules) {
    const found = bySubmodule(modules, name);
    await add(found?.path ?? `query+${name}`, () => (found ? moduleEntry(found) : Promise.resolve(missing(`query+${name}`))));
  }
  return { paraminfo: { modules: entries, helpformat: "none" } };
}
