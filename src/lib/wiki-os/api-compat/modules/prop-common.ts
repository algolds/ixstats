/**
 * prop-common.ts — what the prop modules of `action=query` share (plan 410): the context a prop
 * module runs in and the helpers to reach a page's output object.
 */

import type { Continuation } from "../continuation";
import type { JsonObject } from "../format";
import type { PageEntry, PageSet } from "../pages";
import type { ApiContext } from "../types";

export interface PropContext {
  rc: ApiContext;
  pageSet: PageSet;
  /** `query.pages` objects by page key; a prop module adds its fields. */
  out: Map<number, JsonObject>;
  continuation: Continuation;
}

export type PropModule = (pc: PropContext) => Promise<void>;

export const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const existingEntries = (pageSet: PageSet): PageEntry[] =>
  pageSet.entries.filter((entry) => entry.state === "exists" && entry.row);

export const fieldsOf = (pc: PropContext, entry: PageEntry): JsonObject => {
  const fields = pc.out.get(entry.key);
  if (!fields) throw new Error(`no output slot for page ${entry.key}`);
  return fields;
};
