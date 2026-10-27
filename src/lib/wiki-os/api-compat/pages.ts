/**
 * pages.ts — the page set of a query (plan 410): which pages `titles`, `pageids`, `revids` or a
 * generator name, how titles were normalized, which redirects were followed, and which pages are
 * missing, invalid or special.
 *
 * Existing pages come out in page-id order, then missing, invalid and special titles in the order
 * they were given, each with a negative key (`-1`, `-2`, ...) as MediaWiki numbers them.
 */

import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import type { JsonObject } from "./format";
import type { PageRow, ApiStore, RevisionRow } from "./store-types";

export type PageState = "exists" | "missing" | "invalid" | "special" | "missingid";

export interface PageEntry {
  /** The page id for an existing page, a negative number for the others (a requested unknown id keeps its own). */
  key: number;
  title: string;
  /** Absent for an invalid title. */
  ns: number | null;
  state: PageState;
  row: PageRow | null;
  invalidReason?: string;
  /** Revisions asked for by `revids` (only these are listed for the page). */
  revisionIds: number[];
}

export interface TitleChange {
  from: string;
  to: string;
  tofragment?: string;
}

export interface PageSet {
  entries: PageEntry[];
  normalized: TitleChange[];
  redirects: TitleChange[];
  badRevIds: number[];
  /** Revisions named by `revids`, by revision id. */
  revisions: Map<number, RevisionRow>;
}

export interface PageSelectors {
  titles: readonly string[];
  pageIds: readonly number[];
  revIds: readonly number[];
  resolveRedirects: boolean;
}

/** Redirects followed per page before giving up on a loop. */
const MAX_REDIRECT_HOPS = 10;

const ILLEGAL_TITLE_CHARS = /[[\]{}|<>]/;

function invalidReason(raw: string): string {
  const illegal = ILLEGAL_TITLE_CHARS.exec(raw)?.[0];
  if (illegal) return `The requested page title contains invalid characters: "${illegal}".`;
  if (raw.trim() === "") {
    return "The requested page title is empty or contains only the name of a namespace.";
  }
  return "The requested page title is invalid.";
}

const entryOf = (partial: Pick<PageEntry, "key" | "title" | "ns" | "state"> & Partial<PageEntry>): PageEntry => ({
  row: null,
  revisionIds: [],
  ...partial,
});

const existing = (row: PageRow): PageEntry =>
  entryOf({ key: row.pageId, title: row.title, ns: row.namespace, state: "exists", row });

/** Titles in the order given, with how each was normalized and which are invalid or special. */
function classifyTitles(raws: readonly string[]) {
  const normalized: TitleChange[] = [];
  const canonical: Array<{ title: string; namespace: number }> = [];
  const others: PageEntry[] = [];
  const seen = new Set<string>();
  for (const raw of raws) {
    const canon = canonicalizeTitle(raw);
    if (!canon) {
      others.push(
        entryOf({ key: 0, title: raw, ns: null, state: "invalid", invalidReason: invalidReason(raw) })
      );
      continue;
    }
    if (canon.title !== raw) normalized.push({ from: raw, to: canon.title });
    if (seen.has(canon.title)) continue;
    seen.add(canon.title);
    if (canon.namespaceId < 0) {
      others.push(entryOf({ key: 0, title: canon.title, ns: canon.namespaceId, state: "special" }));
    } else {
      canonical.push({ title: canon.title, namespace: canon.namespaceId });
    }
  }
  return { normalized, canonical, others };
}

/** Follow redirects from the existing pages in `entries`, one hop for every page at a time. */
async function followRedirects(
  store: ApiStore,
  entries: Map<string, PageEntry>
): Promise<TitleChange[]> {
  const changes: TitleChange[] = [];
  const visited = new Map<string, Set<string>>();
  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    const redirecting = [...entries.values()].filter(
      (entry) => entry.row?.isRedirect && entry.row.redirectTitle
    );
    if (redirecting.length === 0) break;
    const targets = await store.pagesByTitle(
      [...new Set(redirecting.flatMap((entry) => entry.row?.redirectTitle ?? []))]
    );
    const byTitle = new Map(targets.map((row) => [row.title, row]));
    for (const entry of redirecting) {
      const row = entry.row!;
      const target = row.redirectTitle!;
      const trail = visited.get(row.title) ?? new Set([row.title]);
      entries.delete(row.title);
      changes.push({
        from: row.title,
        to: target,
        ...(row.redirectFragment ? { tofragment: row.redirectFragment } : {}),
      });
      if (trail.has(target)) continue; // a redirect loop: the page drops out, as in MediaWiki
      trail.add(target);
      const found = byTitle.get(target);
      const canon = canonicalizeTitle(target);
      const next = found
        ? existing(found)
        : entryOf({ key: 0, title: target, ns: canon?.namespaceId ?? 0, state: "missing" });
      entries.set(next.title, next);
      visited.set(next.title, trail);
    }
  }
  return changes;
}

/** Number the pages that are not (existing) pages: -1, -2, ... in the order they were met. */
function number(entries: PageEntry[]): PageEntry[] {
  const good = entries
    .filter((entry) => entry.state === "exists")
    .sort((a, b) => a.key - b.key);
  const rest = entries.filter((entry) => entry.state !== "exists");
  let fake = -1;
  const order: Array<PageState> = ["missing", "invalid", "special", "missingid"];
  const numbered = order.flatMap((state) =>
    rest
      .filter((entry) => entry.state === state)
      .map((entry) => (entry.state === "missingid" ? entry : { ...entry, key: fake-- }))
  );
  return [...good, ...numbered];
}

export async function buildPageSet(store: ApiStore, selectors: PageSelectors): Promise<PageSet> {
  const { normalized, canonical, others } = classifyTitles(selectors.titles);
  const [rows, byIds, revisions] = await Promise.all([
    store.pagesByTitle(canonical.map((c) => c.title)),
    selectors.pageIds.length > 0 ? store.pagesById(selectors.pageIds) : [],
    selectors.revIds.length > 0 ? store.revisionsById(selectors.revIds, false) : [],
  ]);

  const entries = new Map<string, PageEntry>();
  const found = new Map(rows.map((row) => [row.title, row]));
  for (const { title, namespace } of canonical) {
    const row = found.get(title);
    entries.set(
      title,
      row ? existing(row) : entryOf({ key: 0, title, ns: namespace, state: "missing" })
    );
  }

  const missingIds: PageEntry[] = [];
  const foundIds = new Set(byIds.map((row) => row.pageId));
  for (const row of byIds) if (!entries.has(row.title)) entries.set(row.title, existing(row));
  for (const id of selectors.pageIds) {
    if (!foundIds.has(id)) {
      missingIds.push(entryOf({ key: id, title: "", ns: null, state: "missingid" }));
    }
  }

  const known = new Set(revisions.map((revision) => revision.revId));
  const badRevIds = selectors.revIds.filter((id) => !known.has(id));
  const revisionMap = new Map(revisions.map((revision) => [revision.revId, revision]));
  const revisionPages = await store.pagesById([...new Set(revisions.map((r) => r.pageId))]);
  for (const row of revisionPages) if (!entries.has(row.title)) entries.set(row.title, existing(row));
  for (const revision of revisions) {
    const entry = entries.get(revision.title);
    entry?.revisionIds.push(revision.revId);
  }

  const redirects = selectors.resolveRedirects ? await followRedirects(store, entries) : [];

  return {
    entries: number([...entries.values(), ...others, ...missingIds]),
    normalized,
    redirects,
    badRevIds,
    revisions: revisionMap,
  };
}

/** The base object of a page in `query.pages`. */
export function pageStub(entry: PageEntry): JsonObject {
  switch (entry.state) {
    case "exists":
      return { pageid: entry.key, ns: entry.ns, title: entry.title };
    case "missing":
      return { ns: entry.ns, title: entry.title, missing: true };
    case "invalid":
      return { title: entry.title, invalidreason: entry.invalidReason, invalid: true };
    case "special":
      return { ns: entry.ns, title: entry.title, special: true };
    case "missingid":
      return { pageid: entry.key, missing: true };
  }
}
