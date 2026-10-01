/**
 * mirror-upload.ts — `upload` mirror jobs: the bytes of a file WikiOS holds become a version of the same file in MediaWiki (plan 411).
 *
 * The file was staged by the upload service (upload-staging.ts); the job sends it as `action=upload` (a multipart POST, the
 * bot account), after which MediaWiki holds the file in `images/<a>/<ab>/<Name>` with its own database row and
 * generates its thumbnails on request. WikiOS then serves the file from that path instead of its staging copy, and
 * releases the copy once nothing else needs it.
 *
 * A retry must not turn into a second version, so the job is idempotent in what MediaWiki has, not in what it was
 * told: before sending, it asks for the file's SHA-1 (`prop=imageinfo`), and a file MediaWiki already holds with these
 * very bytes is as good as uploaded; when the upload is refused as "no change" or as a duplicate, the same
 * question decides whether that is a failure. The uploader's name is in the version's comment (the version belongs to the mirror
 * account: MediaWiki cannot import an author for a file). The job shares its title with the `File:` page's revision
 * jobs, so the per-title order (mirror-queue.ts) puts the page in MediaWiki before its file.
 *
 * The description page's current text goes along as `text`: MediaWiki uses it only when it has no page for the file yet.
 */

import { z } from "zod";
import { db } from "~/server/db";
import { MediaAssetService } from "../core/media-asset-service";
import { sha1Base36ToHex } from "../core/file-hash";
import { sniffFile } from "../core/file-sniff";
import { canonicalizeTitle } from "../core/title";
import {
  getMediaWikiAction,
  MediaWikiApiError,
  postMediaWikiAction,
} from "../adapters/mediawiki/write-service";
import { MIRROR_SOURCE, uploadPayloadSchema } from "./mirror-outbox";
import type { MirrorJob } from "./mirror-queue";
import { releaseStagedFileUnlessNeeded } from "./staged-uploads";
import { readStaged } from "./upload-staging";

/** MediaWiki's comment limit; the uploader's name is appended to the comment inside it. */
const COMMENT_LIMIT = 500;

/** Codes `action=upload` answers with when the bytes are what MediaWiki holds already: not a failure when `imageinfo` agrees. */
const NO_CHANGE_CODES: ReadonlySet<string> = new Set([
  "fileexists-no-change",
  "duplicate",
  "duplicate-archive",
]);

const imageInfoSchema = z.object({
  query: z.object({
    pages: z.array(
      z.looseObject({
        imageinfo: z.array(z.looseObject({ sha1: z.string().optional() })).optional(),
      })
    ),
  }),
});

const uploadAnswerSchema = z.looseObject({
  upload: z.looseObject({ result: z.string() }),
});

/** Whether MediaWiki holds a file called `title` whose current version has the SHA-1 `hex`. */
async function mediaWikiHolds(title: string, hex: string): Promise<boolean> {
  const data = await getMediaWikiAction(
    { action: "query", prop: "imageinfo", iiprop: "sha1", titles: title },
    imageInfoSchema
  );
  return data.query.pages[0]?.imageinfo?.[0]?.sha1?.toLowerCase() === hex;
}

/** The comment of the version in MediaWiki: the uploader's own, and who uploaded it (the version is the mirror account's). */
async function versionComment(job: MirrorJob, comment: string): Promise<string> {
  const log = job.logId
    ? await db.wikiLog.findUnique({ where: { id: job.logId }, select: { actorName: true } })
    : null;
  const credited = log ? `${comment} (uploaded in WikiOS by ${log.actorName})` : comment;
  return credited.slice(0, COMMENT_LIMIT);
}

/** The text of the file's description page in WikiOS, for the page MediaWiki creates if it has none; undefined when there is none to send. */
async function descriptionText(job: MirrorJob): Promise<string | undefined> {
  const page = await db.wikiArticle.findUnique({
    where: { source_title: { source: job.source, title: job.title } },
    select: { wikitext: true },
  });
  return page?.wikitext ? page.wikitext : undefined;
}

async function sendFile(
  job: MirrorJob,
  name: string,
  bytes: Buffer,
  comment: string
): Promise<void> {
  const sniffed = sniffFile(bytes);
  if (!sniffed.ok)
    throw new Error(
      `The staged file of "${job.title}" is no longer a valid upload: ${sniffed.reason}`
    );
  const text = await descriptionText(job);
  const answer = await postMediaWikiAction(
    {
      action: "upload",
      filename: name,
      comment: await versionComment(job, comment),
      ignorewarnings: "1",
      ...(text === undefined ? {} : { text }),
    },
    uploadAnswerSchema,
    {
      field: "file",
      filename: name,
      contentType: sniffed.file.mime,
      content: new Uint8Array(bytes),
    }
  );
  if (answer.upload.result !== "Success") {
    throw new Error(
      `MediaWiki did not take the upload of "${job.title}": ${JSON.stringify(answer.upload)}`.slice(
        0,
        500
      )
    );
  }
}

/** Pages that use the file were rendered while MediaWiki had no such file: they are stale now (the render queue fixes them). */
async function markUsersStale(name: string): Promise<void> {
  try {
    await db.$executeRaw`
      UPDATE wiki_articles SET "htmlSyncedAt" = NULL
      WHERE source = ${MIRROR_SOURCE}
        AND "htmlSyncedAt" IS NOT NULL
        AND id IN (SELECT "articleId" FROM wiki_image_links WHERE "fileName" = ${name})`;
  } catch (error) {
    console.warn(`[WikiMirror] Marking the pages that use "${name}" stale failed:`, error);
  }
}

/**
 * Put the staged file the job names in MediaWiki; throws on failure, for the retry. When the job is done the asset is served from
 * MediaWiki's path, the pages that use the file are marked stale and the staged copy is released unless something else needs it.
 */
export async function runUploadJob(job: MirrorJob): Promise<void> {
  const { sha1, comment } = uploadPayloadSchema.parse(job.payload);
  const name = canonicalizeTitle(job.title)?.base;
  if (!name) throw new Error(`"${job.title}" is not a file title`);
  const hex = sha1Base36ToHex(sha1);

  if (!(await mediaWikiHolds(job.title, hex))) {
    const bytes = await readStaged(sha1);
    if (!bytes) {
      throw new Error(
        `The staged file ${sha1} of "${job.title}" is gone, and MediaWiki does not hold it`
      );
    }
    try {
      await sendFile(job, name, bytes, comment);
    } catch (error) {
      const refused = error instanceof MediaWikiApiError && NO_CHANGE_CODES.has(error.code);
      if (!refused || !(await mediaWikiHolds(job.title, hex))) throw error;
    }
  }

  await MediaAssetService.markMirrored(name, sha1);
  await markUsersStale(name);
  await releaseStagedFileUnlessNeeded(sha1, job.id);
}
