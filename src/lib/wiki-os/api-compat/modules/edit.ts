/**
 * edit.ts — `action=edit` (plan 410).
 *
 * An edit goes through the same services as the editor's `saveWikitext`: `assertCanEdit` (block,
 * namespace, protection, rights), `detectEditConflict` for `baserevid`/`basetimestamp` (the early answer), then
 * `saveWikitext` (PostgreSQL, the MediaWiki mirror, the cache purge), which repeats the base check atomically.
 * This module only turns the request's text parameters (`text`, `appendtext`, `prependtext`, `section`) into the
 * page's new wikitext, and the saved revision into MediaWiki's answer.
 *
 * Every parameter is read first (`readEditRequest`), then checked, then acted on.
 */

import { createHash } from "node:crypto";
import { EditConflictError } from "~/lib/wiki-os/core/edit-conflict-error";
import { ApiError, missingOneOf, mixedParams } from "../errors";
import { mwTimestamp, type JsonObject } from "../format";
import type { ApiParams } from "../params";
import { visibleText } from "../scan";
import type { PageRow } from "../store-types";
import type { ApiContext } from "../types";
import {
  checkToken,
  requireBotSession,
  cleanComment,
  readPageRef,
  resolvePage,
  type PageRef,
} from "./write-common";
import { contentModelFor } from "~/lib/wiki-os/xml/content-model";
import { stripXmlForbiddenControlChars } from "~/lib/wiki-os/xml/control-chars";
import { locateSection, replaceSection, sectionHeadings } from "~/lib/wiki-os/wikitext/section-locator";

/** MediaWiki's page size limit (what `saveWikitext` takes too). */
export const MAX_EDIT_CHARS = 2_000_000;
/** How much of a section's heading goes into the summary marker. */
const SECTION_SUMMARY_HEADING_CHARS = 200;

/** A reference no revision has, for `detectEditConflict` when the base names a revision that is not there. */
const NO_SUCH_REVISION = "no-such-revision";

const md5 = (text: string) => createHash("md5").update(text, "utf8").digest("hex");

/**
 * MediaWiki's save transform that WikiOS applies: line endings are `\n`, trailing whitespace goes, and the
 * control characters XML cannot carry (which MediaWiki never stores, and `saveArticle` strips) are gone,
 * so a page that already has this text is recognised as unchanged.
 */
const normalized = (text: string) => stripXmlForbiddenControlChars(text.replace(/\r\n?/g, "\n")).trimEnd();

/** Everything `action=edit` takes, as the request gave it. */
interface EditRequest {
  page: PageRef;
  text: string | undefined;
  prepend: string | undefined;
  append: string | undefined;
  md5: string | undefined;
  undo: boolean;
  contentModel: string | undefined;
  createOnly: boolean;
  noCreate: boolean;
  section: string | undefined;
  sectionTitle: string | undefined;
  summary: string;
  minor: boolean;
  baseRevId: number | undefined;
  baseTime: Date | undefined;
}

function readEditRequest(rc: ApiContext, p: ApiParams): EditRequest {
  return {
    page: readPageRef(p, { title: "title", id: "pageid" }),
    text: p.string("text"),
    prepend: p.string("prependtext"),
    append: p.string("appendtext"),
    md5: p.string("md5"),
    undo: p.has("undo") || p.has("undoafter"),
    contentModel: p.string("contentmodel"),
    createOnly: p.flag("createonly"),
    noCreate: p.flag("nocreate"),
    section: p.string("section"),
    sectionTitle: p.string("sectiontitle"),
    summary: p.string("summary", ""),
    minor: p.flag("minor") && !p.flag("notminor"),
    baseRevId: p.optionalInteger("baserevid", 1),
    baseTime: p.timestamp("basetimestamp", rc.now),
  };
}

/** A text parameter that is too long, or holds a NUL (which PostgreSQL text cannot), is refused cleanly. */
export function checkedText(name: string, value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value.length > MAX_EDIT_CHARS) {
    throw new ApiError("toobig", `${name} is longer than ${MAX_EDIT_CHARS} characters.`);
  }
  if (value.includes("\u0000")) throw new ApiError("invalidtext", `${name} contains a NUL character.`);
  return value;
}

/** The text parameters, checked: sizes, NUL, which of them may go together, and the md5 of what was sent. */
function checkTextParams(request: EditRequest): { text?: string; prepend: string; append: string } {
  const text = checkedText("text", request.text);
  const prepend = checkedText("prependtext", request.prepend);
  const append = checkedText("appendtext", request.append);
  if (request.undo) {
    throw new ApiError("unsupportedparam", "WikiOS does not support the undo parameters yet; send the text instead.");
  }
  if (text === undefined && prepend === undefined && append === undefined) {
    throw missingOneOf(["text", "appendtext", "prependtext", "undo"]);
  }
  if (text !== undefined && (prepend !== undefined || append !== undefined)) {
    throw mixedParams(["text", prepend !== undefined ? "prependtext" : "appendtext"]);
  }
  const given = text !== undefined ? md5(text) : md5((prepend ?? "") + (append ?? ""));
  if (request.md5 !== undefined && request.md5.toLowerCase() !== given) {
    throw new ApiError("badmd5", "The supplied MD5 hash was incorrect.");
  }
  return { text, prepend: prepend ?? "", append: append ?? "" };
}

/** The summary MediaWiki gives a new section: the heading in a comment marker, then "new section". */
const newSectionSummary = (heading: string) => (heading ? `/* ${heading} */ new section` : "new section");

interface EditedText {
  wikitext: string;
  /** Replaces the request's summary (a new section writes its own). */
  summary?: string;
  /** Goes in front of the request's summary: the heading of the edited section in a comment marker. */
  summaryPrefix?: string;
}

/** The comment marker MediaWiki puts in front of the summary of a section edit, from the heading of section `index`. */
function sectionSummaryPrefix(base: string, index: number): string | undefined {
  const heading = sectionHeadings(base)[index - 1];
  if (!heading) return undefined;
  const text = visibleText(heading.text.slice(0, SECTION_SUMMARY_HEADING_CHARS));
  return text ? `/* ${text} */` : undefined;
}

/** The page's new wikitext: the whole text, a numbered section, or a new section. */
function editedText(
  request: EditRequest,
  base: string,
  { text, prepend, append }: { text?: string; prepend: string; append: string }
): EditedText {
  const { section } = request;
  if (section === undefined) return { wikitext: text ?? `${prepend}${base}${append}` };

  if (section === "new") {
    if (text === undefined) throw new ApiError("invalidparammix", "A new section needs the text parameter.");
    const heading =
      checkedText("sectiontitle", request.sectionTitle) ?? checkedText("summary", request.summary) ?? "";
    const body = `${heading ? `== ${heading} ==\n\n` : ""}${text}`;
    return {
      wikitext: base.trim() ? `${base}\n\n${body}` : body,
      summary: newSectionSummary(heading),
    };
  }
  if (!/^\d+$/.test(section)) {
    throw new ApiError("invalidsection", 'The section parameter must be a valid section ID or "new".');
  }
  const index = Number(section);
  const range = locateSection(base, index);
  if (!range) throw new ApiError("nosuchsection", `There is no section ${index}.`);
  // MediaWiki's section text has no trailing whitespace; keeping it would add a blank line on append.
  const current = base.slice(range.start, range.end).trimEnd();
  const replaced = replaceSection(base, index, `${prepend}${text ?? current}${append}`);
  return {
    wikitext: replaced ?? base,
    summaryPrefix: index > 0 ? sectionSummaryPrefix(base, index) : undefined,
  };
}

/**
 * The revision references the request's base names: the revision `baserevid` names and/or the revision that was
 * current at `basetimestamp` (each mapped to the reference `detectEditConflict` compares against the page's head),
 * NO_SUCH_REVISION for a base that names no revision of this page. Empty when the request gave no base.
 */
async function baseRefs(rc: ApiContext, request: EditRequest, title: string, articleId: string): Promise<string[]> {
  const { baseRevId, baseTime } = request;
  const { store } = rc.deps;
  const refs: string[] = [];

  if (baseRevId !== undefined) {
    const [rev] = await store.revisionsById([baseRevId], false);
    refs.push(rev && rev.title === title ? rev.ref : NO_SUCH_REVISION);
  }
  if (baseTime) {
    // The revision current at the end of that second (MediaWiki's timestamps have no fractions).
    const [rev] = await store.findRevisions({
      articleId,
      dir: "older",
      from: { timestamp: new Date(baseTime.getTime() + 999) },
      limit: 1,
      withContent: false,
    });
    refs.push(rev && mwTimestamp(rev.timestamp) === mwTimestamp(baseTime) ? rev.ref : NO_SUCH_REVISION);
  }
  return refs;
}

/**
 * Whether the page has moved on from the revisions the request was based on (every base must be the page's head).
 * This is the early answer; the save repeats the check for one of them atomically (`expectedHeadRef`), which is what
 * stops two edits made at the same time on the same base.
 */
async function baseConflicts(rc: ApiContext, refs: readonly string[], title: string): Promise<boolean> {
  for (const ref of refs) {
    if (ref === NO_SUCH_REVISION || (await rc.deps.services.detectEditConflict(title, ref))) return true;
  }
  return false;
}

const editConflict = () => new ApiError("editconflict", "Edit conflict detected.");
const articleExists = () =>
  new ApiError("articleexists", "The article you tried to create has been created already.");

/**
 * The head the save must still find (`expectedHeadRef`): the revision the new text was made from.
 *   - The page did not exist: null (nobody may have created it since).
 *   - The request named a base (`baserevid`/`basetimestamp`): that base.
 *   - No base, but the new text is built from the stored page (`appendtext`, `prependtext`, `section`): the head the
 *     page row was read at, which is before the text was read, so an edit that lands in between reads as a conflict
 *     (the safe direction), never as a lost update.
 *   - No base and a whole new text: undefined, no check (the last write wins, as in MediaWiki).
 */
async function expectedHeadOf(
  rc: ApiContext,
  request: EditRequest,
  texts: { text?: string },
  row: PageRow | null,
  bases: readonly string[]
): Promise<string | null | undefined> {
  if (!row) return null;
  if (bases.length > 0) return bases[0];
  if (request.section === undefined && texts.text !== undefined) return undefined;
  if (row.headRevId === null) return null;
  const [head] = await rc.deps.store.revisionsById([row.headRevId], false);
  return head?.ref ?? NO_SUCH_REVISION;
}

/** The refusals that need no permission check: the model, createonly and nocreate. */
function checkEditPreconditions(request: EditRequest, row: PageRow | null, model: string): void {
  if (request.contentModel !== undefined && request.contentModel !== model) {
    throw new ApiError("cantchangecontentmodel", "You don't have permission to change the content model of a page.");
  }
  if (row && request.createOnly) throw articleExists();
  if (!row && request.noCreate) {
    throw new ApiError("missingtitle", "The page you specified doesn't exist.");
  }
}

/** The edit summary: a new section's own, a section edit's marker in front of the caller's, else the caller's. */
function summaryOf(edited: EditedText, given: string): string {
  if (edited.summary !== undefined) return edited.summary;
  return edited.summaryPrefix ? `${edited.summaryPrefix} ${given}`.trim() : given;
}

export async function runEdit(rc: ApiContext): Promise<JsonObject> {
  requireBotSession(rc);
  const p = rc.params.scope("", "edit");
  const request = readEditRequest(rc, p);
  checkToken(rc);
  const { title, row } = await resolvePage(rc, request.page);
  const texts = checkTextParams(request);
  const model = contentModelFor(title).model;
  checkEditPreconditions(request, row, model);

  // The permission gate every save passes (block, namespace, protection, rights; a deleted page is refused here).
  await rc.deps.services.assertCanEdit(rc.session.ctx, title);

  const base = row ? ((await rc.deps.store.wikitextByArticle([row.articleId])).get(row.articleId) ?? "") : "";
  const edited = editedText(request, base, texts);
  const wikitext = normalized(edited.wikitext);
  if (wikitext.length > MAX_EDIT_CHARS) {
    throw new ApiError("toobig", `The page would be longer than ${MAX_EDIT_CHARS} characters.`);
  }
  const bases = row ? await baseRefs(rc, request, title, row.articleId) : [];
  if (await baseConflicts(rc, bases, title)) throw editConflict();
  if (row && wikitext === normalized(base)) {
    return { edit: { result: "Success", nochange: true, title, pageid: row.pageId, contentmodel: model } };
  }

  // The save checks, atomically, that the page is still at the revision the text was made from (see expectedHeadOf).
  let revisionRowId: string;
  try {
    ({ revisionRowId } = await rc.deps.services.saveWikitext(rc.session.ctx, {
      title,
      wikitext,
      summary: cleanComment(summaryOf(edited, request.summary)),
      minor: request.minor,
      expectedHeadRef: await expectedHeadOf(rc, request, texts, row, bases),
    }));
  } catch (error) {
    if (!(error instanceof EditConflictError)) throw error;
    // a page that did not exist and was created meanwhile: for `createonly` that is what it refuses
    throw !row && request.createOnly ? articleExists() : editConflict();
  }
  const saved = await rc.deps.store.revisionByRowId(revisionRowId);
  return {
    edit: {
      result: "Success",
      ...(row ? {} : { new: true }),
      pageid: saved?.pageId ?? 0,
      title,
      contentmodel: model,
      oldrevid: row?.headRevId ?? 0,
      newrevid: saved?.revId ?? 0,
      newtimestamp: mwTimestamp(saved?.timestamp ?? rc.now),
    },
  };
}
