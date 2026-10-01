/**
 * list-common.ts — what the list modules share (plan 410): reading namespaces and titles, the
 * direction words, and the shape of a page item.
 */

import { ApiError, badInteger, invalidTitle } from "../errors";
import type { JsonObject } from "../format";
import type { ApiParams } from "../params";
import type { PageListRow } from "../store-types";
import { canonicalizeTitle, NAMESPACE_CANONICAL_NAMES } from "~/lib/wiki-os/core/title";

export type Direction = "ascending" | "descending";

/** `{pageid, ns, title}`. */
export const pageItem = (row: PageListRow): JsonObject => ({
  pageid: row.pageId,
  ns: row.namespace,
  title: row.title,
});

/** The namespaces a request names (`*` = all, so undefined); a value that is not a namespace is `badvalue`. */
export function namespacesParam(p: ApiParams, name = "namespace"): number[] | undefined {
  if (!p.has(name)) return undefined;
  const values = p.list(name);
  if (values.includes("*")) return undefined;
  return values.map((value) => {
    if (!/^-?\d+$/.test(value)) throw badInteger(p.fullName(name), value);
    const id = Number(value);
    if (id !== 0 && !Object.hasOwn(NAMESPACE_CANONICAL_NAMES, id)) {
      throw new ApiError("badvalue", `Unrecognized value for parameter "${p.fullName(name)}": ${value}.`);
    }
    return id;
  });
}

/** One namespace (default `fallback`). */
export function namespaceParam(p: ApiParams, fallback = 0, name = "namespace"): number {
  const [first] = namespacesParam(p, name) ?? [fallback];
  return first ?? fallback;
}

/** The canonical full title of `base` inside `namespace` (a page name as bots give it: underscores, any case of the first letter). */
export function titleIn(namespace: number, base: string): string {
  const prefix = namespace === 0 ? "" : `${NAMESPACE_CANONICAL_NAMES[namespace] ?? ""}:`;
  const canon = canonicalizeTitle(`${prefix}${base}`);
  if (!canon || canon.namespaceId !== namespace) throw invalidTitle(base);
  return canon.title;
}

/** A title parameter as a canonical title. */
export function canonicalTitle(raw: string): string {
  const canon = canonicalizeTitle(raw);
  if (!canon) throw invalidTitle(raw);
  return canon.title;
}

/** The part of a canonical title after its namespace prefix. */
export function baseOf(title: string): string {
  return canonicalizeTitle(title)?.base ?? title;
}

const ASCENDING = new Set(["asc", "ascending", "newer"]);

/** The `dir` words modules accept (`newer`/`older`, `asc`/`desc`, `ascending`/`descending`) as one direction. */
export function directionParam(
  p: ApiParams,
  words: readonly string[],
  fallback: string,
  name = "dir"
): Direction {
  return ASCENDING.has(p.oneOf(name, words, fallback)) ? "ascending" : "descending";
}
