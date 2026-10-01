/**
 * registry.ts — every module api.php serves, in one list (plan 410).
 *
 * `action=paraminfo` describes modules; this is where it finds them. The list is built from the same
 * tables the dispatcher and `action=query` run modules from, so a module that is added there is
 * described here with no further step, and each module's parameters come from running it
 * (`introspect.ts`), not from a second table.
 */

import { Continuation } from "./continuation";
import { introspectParams, type IntrospectedParams } from "./introspect";
import { pageStub, type PageEntry, type PageSet } from "./pages";
import type { PageRow } from "./store-types";
import type { ApiContext } from "./types";
import { generatorNames } from "./modules/generator";
import { LIST_MODULES } from "./modules/query-list";
import { META_MODULES, PROP_MODULES } from "./modules/query";

export type ModuleGroup = "action" | "meta" | "list" | "prop";

export interface ModuleInfo {
  name: string;
  group: ModuleGroup;
  /** `query+allpages` for a query submodule, the action's own name otherwise. */
  path: string;
  /** Whether the module can also run as a generator. */
  generator: boolean;
  /** The prefix the module reads its parameters under (`ap` for `list=allpages`; empty when it has none) and the parameters. */
  describe: () => Promise<IntrospectedParams>;
}

/** One existing page, so a prop module runs its single-page path while it is being read. */
function samplePropContext(rc: ApiContext) {
  const row: PageRow = {
    articleId: "introspection",
    pageId: 1,
    title: "Introspection",
    namespace: 0,
    isRedirect: false,
    redirectTitle: null,
    redirectFragment: null,
    touched: new Date(0),
    wordCount: 0,
    headRevId: 1,
    headTimestamp: new Date(0),
    length: 0,
  };
  const entry: PageEntry = { key: 1, title: row.title, ns: 0, state: "exists", row, revisionIds: [] };
  const pageSet: PageSet = { entries: [entry], normalized: [], redirects: [], badRevIds: [], revisions: new Map() };
  return {
    rc,
    pageSet,
    out: new Map([[1, pageStub(entry)]]),
    continuation: new Continuation(),
  };
}

/** The actions, as `{ name, run }`: the dispatcher's table, passed in so this file does not import it. */
export function buildRegistry(
  actions: Readonly<Record<string, { run: (rc: ApiContext) => unknown }>>
): ModuleInfo[] {
  const modules: ModuleInfo[] = [];
  for (const [name, action] of Object.entries(actions)) {
    modules.push({
      name,
      group: "action",
      path: name,
      generator: false,
      describe: () => introspectParams((rc) => action.run(rc)),
    });
  }
  for (const [name, run] of Object.entries(META_MODULES)) {
    modules.push({
      name,
      group: "meta",
      path: `query+${name}`,
      generator: false,
      describe: () => introspectParams((rc) => run(rc)),
    });
  }
  const generators = new Set(generatorNames());
  for (const [name, list] of Object.entries(LIST_MODULES)) {
    modules.push({
      name,
      group: "list",
      path: `query+${name}`,
      generator: generators.has(name),
      describe: async () => {
        const read = await introspectParams((rc) => list.run(rc, rc.params.scope(list.prefix, name)));
        return { ...read, prefix: list.prefix };
      },
    });
  }
  for (const [name, run] of Object.entries(PROP_MODULES)) {
    modules.push({
      name,
      group: "prop",
      path: `query+${name}`,
      generator: generators.has(name),
      describe: () => introspectParams((rc) => run(samplePropContext(rc))),
    });
  }
  return modules;
}
