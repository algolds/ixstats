/**
 * compare.ts — `action=compare` (plan 410): a diff between two revisions (or two texts) in
 * MediaWiki's diff table format (the `<tr>` rows), computed by the server diff WikiOS already has.
 */

import { ApiError, missingOneOf } from "../errors";
import { mwTimestamp, type JsonObject } from "../format";
import type { ApiParams } from "../params";
import type { RevisionRow } from "../store-types";
import type { ApiContext } from "../types";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";

const COMPARE_PROPS = ["diff", "diffsize", "rel", "ids", "title", "user", "comment", "parsedcomment", "size", "timestamp"] as const;
type CompareProp = (typeof COMPARE_PROPS)[number];
const RELATIVE = ["prev", "next", "cur"] as const;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One side of the comparison: a revision, or bare text. */
interface Side {
  text: string;
  revision: RevisionRow | null;
}

async function withText(rc: ApiContext, revId: number): Promise<RevisionRow> {
  const [rev] = await rc.deps.store.revisionsById([revId], true);
  if (!rev) throw new ApiError("nosuchrevid", `There is no revision with ID ${revId}.`);
  if (rev.content === null) throw new ApiError("missingcontent", "The text of that revision is hidden.");
  return rev;
}

/** A side named by `<side>rev`, `<side>title` (its newest revision), `<side>id` (a page id) or `<side>text`. */
async function sideOf(rc: ApiContext, p: ApiParams, side: "from" | "to"): Promise<Side | null> {
  const revId = p.optionalInteger(`${side}rev`, 1);
  if (revId !== undefined) return sideOfRevision(await withText(rc, revId));
  const text = p.string(`${side}text`);
  if (text !== undefined) return { text, revision: null };

  const title = p.string(`${side}title`);
  const pageId = p.optionalInteger(`${side}id`, 1);
  if (title === undefined && pageId === undefined) return null;
  const canon = title === undefined ? null : canonicalizeTitle(title);
  if (title !== undefined && !canon) throw new ApiError("invalidtitle", `Bad title "${title}".`);
  const [row] = pageId !== undefined ? await rc.deps.store.pagesById([pageId]) : await rc.deps.store.pagesByTitle([canon!.title]);
  if (!row?.headRevId) throw new ApiError("missingtitle", "The page you specified doesn't exist.");
  return sideOfRevision(await withText(rc, row.headRevId));
}

const sideOfRevision = (revision: RevisionRow): Side => ({ text: revision.content ?? "", revision });

/** The revision `relative` says, from `from`: its parent, the next one, or the page's newest. */
async function relativeSide(rc: ApiContext, from: RevisionRow, relative: (typeof RELATIVE)[number]): Promise<Side> {
  const { store } = rc.deps;
  if (relative === "prev") {
    if (from.parentId === 0) throw new ApiError("nosuchrevid", "The revision has no previous revision.");
    return sideOfRevision(await withText(rc, from.parentId));
  }
  const [page] = await store.pagesByTitle([from.title]);
  if (relative === "cur") return sideOfRevision(await withText(rc, page?.headRevId ?? from.revId));
  const [, next] = await store.findRevisions({
    articleId: page?.articleId,
    dir: "newer",
    from: { timestamp: from.timestamp, revId: from.revId },
    limit: 1,
    withContent: false,
  });
  if (!next) throw new ApiError("nosuchrevid", "The revision has no next revision.");
  return sideOfRevision(await withText(rc, next.revId));
}

function revisionFields(label: "from" | "to", side: Side, props: ReadonlySet<CompareProp>): JsonObject {
  const rev = side.revision;
  if (!rev) return {};
  return {
    ...(props.has("ids") ? { [`${label}id`]: rev.pageId, [`${label}revid`]: rev.revId } : {}),
    ...(props.has("title") ? { [`${label}ns`]: rev.namespace, [`${label}title`]: rev.title } : {}),
    ...(props.has("user") && !rev.userHidden ? { [`${label}user`]: rev.user ?? "", [`${label}userid`]: rev.userId } : {}),
    ...(props.has("comment") && !rev.commentHidden ? { [`${label}comment`]: rev.comment ?? "" } : {}),
    ...(props.has("parsedcomment") && !rev.commentHidden ? { [`${label}parsedcomment`]: escapeHtml(rev.comment ?? "") } : {}),
    ...(props.has("size") ? { [`${label}size`]: rev.size } : {}),
    ...(props.has("timestamp") ? { [`${label}timestamp`]: mwTimestamp(rev.timestamp) } : {}),
  };
}

export async function runCompare(rc: ApiContext): Promise<JsonObject> {
  const p = rc.params.scope("", "compare");
  const props = new Set<CompareProp>(p.listOf("prop", COMPARE_PROPS, ["diff", "ids", "title"]));
  const from = await sideOf(rc, p, "from");
  if (!from) throw missingOneOf(["fromtitle", "fromid", "fromrev", "fromtext"]);
  const relative = p.oneOf("torelative", RELATIVE);
  const to = (await sideOf(rc, p, "to")) ?? (relative && from.revision ? await relativeSide(rc, from.revision, relative) : null);
  if (!to) throw missingOneOf(["totitle", "toid", "torev", "torelative", "totext"]);

  const diff = props.has("diff") || props.has("diffsize") ? rc.deps.services.diff(from.text, to.text) : "";
  return {
    compare: {
      ...revisionFields("from", from, props),
      ...revisionFields("to", to, props),
      ...(props.has("diffsize") ? { diffsize: Buffer.byteLength(diff, "utf8") } : {}),
      // MediaWiki's diff body is `*` in formatversion=1 and `body` in formatversion=2.
      ...(props.has("diff") ? { [rc.version === 1 ? "*" : "body"]: diff } : {}),
    },
  };
}
