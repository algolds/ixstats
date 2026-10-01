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
import { DiffTooLarge } from "~/lib/wiki-os/transformers/wikitext-diff";

/** Characters of `fromtext` / `totext` a request may send. */
export const MAX_COMPARE_TEXT_CHARS = 200_000;
/** The diff table's size limit: a comparison of two big texts answers `toobig` instead of building a huge page. */
export const MAX_DIFF_CHARS = 2 * 1024 * 1024;

/** Unchanged lines shown on each side of a change, as MediaWiki's diff table shows. */
const MAX_CONTEXT_LINES = 2;

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

/** What a request names as one side of the comparison. */
interface SideRef {
  revId: number | undefined;
  text: string | undefined;
  title: string | undefined;
  pageId: number | undefined;
  /** The parameter name of `text`, for its error message. */
  textParam: string;
}

function readSide(p: ApiParams, side: "from" | "to"): SideRef {
  return {
    revId: p.optionalInteger(`${side}rev`, 1),
    text: p.string(`${side}text`),
    title: p.string(`${side}title`),
    pageId: p.optionalInteger(`${side}id`, 1),
    textParam: p.fullName(`${side}text`),
  };
}

/** A side named by `<side>rev`, `<side>title` (its newest revision), `<side>id` (a page id) or `<side>text`. */
async function resolveSide(rc: ApiContext, ref: SideRef): Promise<Side | null> {
  if (ref.revId !== undefined) return sideOfRevision(await withText(rc, ref.revId));
  if (ref.text !== undefined) {
    if (ref.text.length > MAX_COMPARE_TEXT_CHARS) {
      throw new ApiError("toobig", `${ref.textParam} is longer than ${MAX_COMPARE_TEXT_CHARS} characters.`);
    }
    return { text: ref.text, revision: null };
  }
  if (ref.title === undefined && ref.pageId === undefined) return null;
  const canon = ref.title === undefined ? null : canonicalizeTitle(ref.title);
  if (ref.title !== undefined && !canon) throw new ApiError("invalidtitle", `Bad title "${ref.title}".`);
  const [row] = ref.pageId !== undefined ? await rc.deps.store.pagesById([ref.pageId]) : await rc.deps.store.pagesByTitle([canon!.title]);
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

function boundedDiff(rc: ApiContext, from: string, to: string): string {
  try {
    return rc.deps.services.diff(from, to, { maxOutputChars: MAX_DIFF_CHARS, contextLines: MAX_CONTEXT_LINES });
  } catch (error) {
    if (error instanceof DiffTooLarge) throw new ApiError("toobig", "The diff is larger than 2 MB.");
    throw error;
  }
}

export async function runCompare(rc: ApiContext): Promise<JsonObject> {
  const p = rc.params.scope("", "compare");
  const props = new Set<CompareProp>(p.listOf("prop", COMPARE_PROPS, ["diff", "ids", "title"]));
  const fromRef = readSide(p, "from");
  const toRef = readSide(p, "to");
  const relative = p.oneOf("torelative", RELATIVE);
  const from = await resolveSide(rc, fromRef);
  if (!from) throw missingOneOf(["fromtitle", "fromid", "fromrev", "fromtext"]);
  const to = (await resolveSide(rc, toRef)) ?? (relative && from.revision ? await relativeSide(rc, from.revision, relative) : null);
  if (!to) throw missingOneOf(["totitle", "toid", "torev", "torelative", "totext"]);

  const diff = props.has("diff") || props.has("diffsize") ? boundedDiff(rc, from.text, to.text) : "";
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
