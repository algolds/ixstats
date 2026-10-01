/**
 * edit.ts — `action=edit` (plan 410).
 *
 * An edit goes through the same services as the editor's `saveWikitext`: `assertCanEdit` (block,
 * namespace, protection, rights), `detectEditConflict` for `baserevid`/`basetimestamp`, then
 * `saveWikitext` (PostgreSQL, the MediaWiki mirror, the cache purge). This module only turns the
 * request's text parameters (`text`, `appendtext`, `prependtext`, `section`) into the page's new
 * wikitext, and the saved revision into MediaWiki's answer.
 */

import { createHash } from "node:crypto";
import { ApiError, missingOneOf, mixedParams } from "../errors";
import { mwTimestamp, type JsonObject } from "../format";
import type { ApiParams } from "../params";
import type { ApiContext } from "../types";
import { beginWrite, namedPage } from "./write-common";
import { contentModelFor } from "~/lib/wiki-os/xml/content-model";
import { locateSection, replaceSection } from "~/lib/wiki-os/wikitext/section-locator";

/** A reference no revision has, for `detectEditConflict` when the base names a revision that is not there. */
const NO_SUCH_REVISION = "no-such-revision";

const md5 = (text: string) => createHash("md5").update(text, "utf8").digest("hex");

/** MediaWiki's save transform that WikiOS applies: line endings are `\n` and trailing whitespace goes. */
const normalized = (text: string) => text.replace(/\r\n?/g, "\n").trimEnd();

interface TextParams {
  text?: string;
  prepend?: string;
  append?: string;
}

function readTextParams(p: ApiParams): TextParams {
  const params: TextParams = { text: p.string("text"), prepend: p.string("prependtext"), append: p.string("appendtext") };
  if (p.has("undo") || p.has("undoafter")) {
    throw new ApiError("unsupportedparam", "WikiOS does not support the undo parameters yet; send the text instead.");
  }
  if (params.text === undefined && params.prepend === undefined && params.append === undefined) {
    throw missingOneOf(["text", "appendtext", "prependtext", "undo"]);
  }
  if (params.text !== undefined && (params.prepend !== undefined || params.append !== undefined)) {
    throw mixedParams(["text", params.prepend !== undefined ? "prependtext" : "appendtext"]);
  }
  const given = params.text !== undefined ? md5(params.text) : md5((params.prepend ?? "") + (params.append ?? ""));
  const expected = p.string("md5");
  if (expected !== undefined && expected.toLowerCase() !== given) {
    throw new ApiError("badmd5", "The supplied MD5 hash was incorrect.");
  }
  return params;
}

/** The summary MediaWiki gives a new section: the heading in a comment marker, then "new section". */
const newSectionSummary = (heading: string) => (heading ? `/* ${heading} */ new section` : "new section");

interface EditedText {
  wikitext: string;
  /** Replaces the request's summary (a new section writes its own). */
  summary?: string;
}

/** The page's new wikitext: the whole text, a numbered section, or a new section. */
function editedText(p: ApiParams, base: string, params: TextParams): EditedText {
  const section = p.string("section");
  const { text, prepend = "", append = "" } = params;
  if (section === undefined) return { wikitext: text ?? `${prepend}${base}${append}` };

  if (section === "new") {
    if (text === undefined) throw new ApiError("invalidparammix", "A new section needs the text parameter.");
    const heading = p.string("sectiontitle") ?? p.string("summary") ?? "";
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
  const current = base.slice(range.start, range.end);
  const replaced = replaceSection(base, index, `${prepend}${text ?? current}${append}`);
  return { wikitext: replaced ?? base };
}

/**
 * Whether the page has moved on from the revision the request was based on. The page is "the
 * revision `baserevid` names" and/or "the revision that was current at `basetimestamp`"; each is
 * mapped to the revision reference `detectEditConflict` compares against the page's head.
 */
async function baseConflicts(rc: ApiContext, p: ApiParams, title: string, articleId: string): Promise<boolean> {
  const baseRevId = p.optionalInteger("baserevid", 1);
  const baseTime = p.timestamp("basetimestamp", rc.now);
  const { store, services } = rc.deps;
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
  for (const ref of refs) {
    if (ref === NO_SUCH_REVISION || (await services.detectEditConflict(title, ref))) return true;
  }
  return false;
}

export async function runEdit(rc: ApiContext): Promise<JsonObject> {
  beginWrite(rc);
  const p = rc.params.scope("", "edit");
  const { title, row } = await namedPage(rc, p, { title: "title", id: "pageid" });
  const textParams = readTextParams(p);

  const model = contentModelFor(title).model;
  const requestedModel = p.string("contentmodel");
  if (requestedModel !== undefined && requestedModel !== model) {
    throw new ApiError("cantchangecontentmodel", "You don't have permission to change the content model of a page.");
  }
  if (row && p.flag("createonly")) {
    throw new ApiError("articleexists", "The article you tried to create has been created already.");
  }
  if (!row && p.flag("nocreate")) {
    throw new ApiError("missingtitle", "The page you specified doesn't exist.");
  }

  // The permission gate every save passes (block, namespace, protection, rights; a deleted page is refused here).
  await rc.deps.services.assertCanEdit(rc.session.ctx, title);

  const base = row ? ((await rc.deps.store.wikitextByArticle([row.articleId])).get(row.articleId) ?? "") : "";
  const edited = editedText(p, base, textParams);
  const wikitext = normalized(edited.wikitext);
  const hasBase = p.has("baserevid") || p.has("basetimestamp");
  if (row && hasBase && (await baseConflicts(rc, p, title, row.articleId))) {
    throw new ApiError("editconflict", "Edit conflict detected.");
  }

  if (row && wikitext === normalized(base)) {
    return { edit: { result: "Success", nochange: true, title, pageid: row.pageId, contentmodel: model } };
  }

  const { revisionRowId } = await rc.deps.services.saveWikitext(rc.session.ctx, {
    title,
    wikitext,
    summary: edited.summary ?? p.string("summary", ""),
    minor: p.flag("minor") && !p.flag("notminor"),
  });
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
