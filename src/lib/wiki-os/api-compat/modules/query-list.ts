/**
 * query-list.ts — `action=query&list=...` modules (plan 410).
 *
 * A list module returns one page of items and the continuation value for the next. The same module
 * runs as a generator (`generator=allpages`, parameters prefixed with `g`): its items' titles become
 * the page set that the prop modules decorate.
 */

import type { JsonObject } from "../format";
import type { ApiParams } from "../params";
import type { ApiContext } from "../types";

export interface ListResult {
  /** Each item has a `title` when the module can run as a generator. */
  items: JsonObject[];
  /** The value of the next page's `<prefix>continue`, or null when this was the last page. */
  next: string | null;
}

export interface ListModule {
  /** `ap` for `list=allpages`: its parameters are `aplimit`, `apfrom`, ... */
  prefix: string;
  /** The key the items go under in `query` (`allpages`). */
  resultKey: string;
  /** Whether the module's items are pages, so it may also be a generator. */
  generator: boolean;
  /** `p` reads the module's parameters without their prefix. */
  run(rc: ApiContext, p: ApiParams): Promise<ListResult>;
}

export const LIST_MODULES: Readonly<Record<string, ListModule>> = {};
