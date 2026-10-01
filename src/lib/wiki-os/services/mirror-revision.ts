/**
 * mirror-revision.ts — a `revision` mirror job: one WikiOS revision becomes a MediaWiki revision.
 *
 * The revision goes out as a one-page, one-revision XML export through `action=import` with
 * `assignknownusers=1`, so MediaWiki credits it to the account that made it (the verified link of the
 * author, else the author's name; an unknown name becomes `wikios>Name`) at the time it was made. The
 * import answers with no revision id, so the result is checked: when MediaWiki's current revision is not this
 * text (someone edited there since, so the imported revision is not the current one), the text is pushed
 * once more as an ordinary `action=edit` by the mirror account. Either way the WikiOS revision is stamped with
 * its MediaWiki revision id, and the inbound sync (plan 406) knows the revision as WikiOS's own.
 *
 * Import errors (no import right, a bad prefix) are failures: the job is retried and ends up dead for an
 * operator; there is no fallback for them.
 */

import { z } from "zod";
import { ConflictError } from "~/lib/app-error";
import { db } from "~/server/db";
import { canonicalizeTitle } from "../core/title";
import {
  executeMediaWikiWrite,
  getMediaWikiAction,
  postMediaWikiAction,
} from "../adapters/mediawiki/write-service";
import { mirrorBotName } from "../adapters/mediawiki/csrf-cache";
import { contentModelFor } from "../xml/content-model";
import { createExportWriter, toXmlTimestamp } from "../xml/export-writer";
import { mwSha1Base36, sha1HexToBase36 } from "../xml/sha1";
import { MIRROR_SOURCE, revisionPayloadSchema, type RevisionPayload } from "./mirror-outbox";
import type { MirrorJob } from "./mirror-queue";

/** MediaWiki's prefix for the names of editors it has no account for: `wikios>Name`. */
const INTERWIKI_PREFIX = "wikios";
const UNKNOWN_AUTHOR = "Community Contributor";
const DEFAULT_SUMMARY = "WikiOS native edit";
const RESTORE_SUMMARY = "Restoring the current WikiOS revision";
const SUMMARY_LIMIT = 480;

const importResultSchema = z.looseObject({
  import: z.array(z.looseObject({ title: z.string(), revisions: z.number() })),
});

const currentRevisionSchema = z.object({
  query: z.object({
    pages: z.array(
      z.looseObject({
        revisions: z
          .array(z.looseObject({ revid: z.number(), sha1: z.string().optional() }))
          .optional(),
      })
    ),
  }),
});

interface MirroredRevision {
  id: string;
  wikitext: string;
  author: string | null;
  authorId: string | null;
  summary: string | null;
  minor: boolean;
  createdAt: Date;
  mwRevId: number | null;
  sha1: string | null;
}

interface CurrentRevision {
  revid: number;
  /** `rev_sha1` in MediaWiki's base 36; null when MediaWiki hides it. */
  sha1: string | null;
}

/** The account the revision is credited to: the mirror itself for a restore, else its author. */
async function contributorOf(revision: MirroredRevision, restore: boolean): Promise<string> {
  if (restore) {
    const bot = mirrorBotName();
    if (!bot) throw new Error("WIKIOS_MEDIAWIKI_BOT_USER is not set: there is no mirror account");
    return bot;
  }
  const link = revision.authorId
    ? await db.wikiAccountLink.findFirst({
        where: { userId: revision.authorId, source: MIRROR_SOURCE, verifiedAt: { not: null } },
        select: { username: true },
      })
    : null;
  return link?.username ?? revision.author ?? UNKNOWN_AUTHOR;
}

/** The export-0.11 document holding `text` as the one revision of `title`. */
async function buildImportXml(params: {
  title: string;
  namespace: number;
  text: string;
  contributor: string;
  timestamp: Date;
  summary: string | null;
  minor: boolean;
}): Promise<string> {
  const chunks: string[] = [];
  const writer = createExportWriter((chunk) => {
    chunks.push(chunk);
  });
  const { model, format } = contentModelFor(params.title);
  await writer.start();
  await writer.page({
    title: params.title,
    ns: params.namespace,
    pageId: null,
    revisions: [
      {
        id: null,
        parentId: null,
        timestamp: toXmlTimestamp(params.timestamp),
        contributor: { username: params.contributor, id: null },
        minor: params.minor,
        comment: params.summary,
        commentDeleted: false,
        model,
        format,
        text: params.text,
        textDeleted: false,
      },
    ],
  });
  await writer.end();
  return chunks.join("");
}

/** MediaWiki's current revision of `title`; null when the page does not exist there. */
async function currentRevision(title: string): Promise<CurrentRevision | null> {
  const data = await getMediaWikiAction(
    {
      action: "query",
      prop: "revisions",
      titles: title,
      rvprop: "ids|sha1|timestamp",
      rvlimit: "1",
    },
    currentRevisionSchema
  );
  const revision = data.query.pages[0]?.revisions?.[0];
  if (!revision) return null;
  return { revid: revision.revid, sha1: revision.sha1 ? sha1HexToBase36(revision.sha1) : null };
}

/** Push `text` as an ordinary edit on top of MediaWiki's current revision; resolves to the revision it made. */
async function pushAsEdit(
  title: string,
  revision: MirroredRevision,
  summary: string,
  current: CurrentRevision | null
): Promise<number> {
  const result = await executeMediaWikiWrite({
    action: "edit",
    title,
    text: revision.wikitext,
    summary: `${summary} (WikiOS)`,
    bot: 1,
    ...(revision.minor ? { minor: 1 } : {}),
    ...(current ? { baserevid: current.revid } : {}),
  });
  const edit = result.result.edit;
  if (!result.success) throw new Error(`MediaWiki did not save the edit of "${title}"`);
  // `nochange`: the page already had this text, and `oldrevid` is the revision that holds it.
  const revid = edit?.newrevid ?? edit?.oldrevid;
  if (revid === undefined) throw new Error(`MediaWiki saved "${title}" but gave no revision id`);
  return revid;
}

/** Give the WikiOS revision its MediaWiki id, and the article the id of the MediaWiki revision that holds its text. */
async function stamp(job: MirrorJob, revision: MirroredRevision, mwRevId: number): Promise<void> {
  try {
    await db.wikiRevision.updateMany({
      where: { id: revision.id, mwRevId: null },
      data: { mwRevId, ...(revision.sha1 ? {} : { sha1: mwSha1Base36(revision.wikitext) }) },
    });
  } catch (error) {
    // The inbound sync recorded this very MediaWiki revision as an echo row first: it is already known.
    // (`db` turns the database's unique-constraint error into a ConflictError, see ~/lib/prisma-error.)
    if (!(error instanceof ConflictError)) throw error;
  }
  if (job.articleId) {
    await db.wikiArticle.updateMany({
      where: { id: job.articleId },
      data: { mwLatestRevId: mwRevId, lastMwSyncAt: new Date() },
    });
  }
}

/** The summary the import log and an edit fallback carry. */
function summaryOf(revision: MirroredRevision, payload: RevisionPayload): string {
  const own = payload.restore ? payload.summary || RESTORE_SUMMARY : revision.summary;
  return (own?.trim() || DEFAULT_SUMMARY).slice(0, SUMMARY_LIMIT);
}

/** The revision a job mirrors; null when it is gone with its page. */
function loadRevision(revisionId: string | null): Promise<MirroredRevision | null> {
  if (!revisionId) return Promise.resolve(null);
  return db.wikiRevision.findUnique({
    where: { id: revisionId },
    select: {
      id: true,
      wikitext: true,
      author: true,
      authorId: true,
      summary: true,
      minor: true,
      createdAt: true,
      mwRevId: true,
      sha1: true,
    },
  });
}

/** Send the revision to MediaWiki as a one-page, one-revision XML import. */
async function importRevision(
  job: MirrorJob,
  revision: MirroredRevision,
  payload: RevisionPayload,
  summary: string
): Promise<void> {
  const xml = await buildImportXml({
    title: job.title,
    namespace: canonicalizeTitle(job.title, { source: job.source })?.namespaceId ?? 0,
    text: revision.wikitext,
    contributor: await contributorOf(revision, payload.restore),
    timestamp: payload.restore ? new Date() : revision.createdAt,
    summary: payload.restore ? summary : revision.summary,
    minor: payload.restore ? false : revision.minor,
  });
  await postMediaWikiAction(
    { action: "import", interwikiprefix: INTERWIKI_PREFIX, assignknownusers: "1", summary },
    importResultSchema,
    { field: "xml", filename: "wikios.xml", contentType: "application/xml", content: xml }
  );
}

/**
 * Mirror the job's revision. Resolves to the MediaWiki revision id that now holds its text, or null when
 * there is nothing to mirror (the revision went with its page). Throws on any failure, for the retry.
 */
export async function runRevisionJob(job: MirrorJob): Promise<number | null> {
  const payload = revisionPayloadSchema.parse(job.payload ?? {});
  const revision = await loadRevision(job.revisionId);
  if (!revision) return null;
  // An echo of this very text is already in MediaWiki's history (the inbound sync stamped the revision).
  if (!payload.restore && revision.mwRevId !== null) return revision.mwRevId;

  const wanted = mwSha1Base36(revision.wikitext);
  if (payload.restore) {
    // MediaWiki already holds the head's text (the edit that conflicted was superseded since): nothing to restore.
    // An edit (the fallback below) saves the text without its trailing whitespace, so that counts as the same text.
    const holder = await currentRevision(job.title);
    if (holder?.sha1 === wanted || holder?.sha1 === mwSha1Base36(revision.wikitext.trimEnd())) {
      await stamp(job, revision, holder.revid);
      return holder.revid;
    }
  }

  const summary = summaryOf(revision, payload);
  await importRevision(job, revision, payload, summary);
  // The import is the current revision only when nothing newer is in MediaWiki's history.
  const current = await currentRevision(job.title);
  const holdsText = current !== null && current.sha1 === wanted;
  const revid = holdsText ? current.revid : await pushAsEdit(job.title, revision, summary, current);
  await stamp(job, revision, revid);
  return revid;
}
