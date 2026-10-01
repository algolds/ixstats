/**
 * upload.ts — `action=upload` (plan 411).
 *
 * A bot uploads as it would to MediaWiki: a multipart POST with the file as the `file` part, `filename`, `comment`,
 * `text` (the whole text of the new `File:` page), `ignorewarnings` and the CSRF `token`. The module reads the
 * request and shapes MediaWiki's answer; everything else is the upload service's (rights, the bytes' type and size,
 * warnings, the staging directory, the `File:` page, the asset, the log and the mirror job).
 *
 * Supported: a file sent in the request. Not supported, and refused with a code of its own: uploads by URL (`url`:
 * `copyuploaddisabled`, as MediaWiki answers when the feature is off), by stash (`filekey`, `stash`) and in chunks
 * (`offset`, `chunk`, `filesize`, `async`).
 * A warning is answered as MediaWiki answers it (`result: Warning`, `warnings`); the bot sends the file again with
 * `ignorewarnings` to go on, except for the same bytes as the current version, which MediaWiki refuses either way
 * (`fileexists-no-change`, checked against a real MediaWiki 1.45): nothing is stored.
 */

import { ApiError, missingOneOf, missingParam } from "../errors";
import { mwTimestamp, type JsonObject } from "../format";
import type { FileRow } from "../store-types";
import type { ApiContext } from "../types";
import { checkToken, cleanComment, requireBotSession } from "./write-common";
import { uploadImageInfo } from "./file-info";
import type { UploadWarnings } from "~/lib/wiki-os/services/upload-service";

/** Uploads one caller may make a minute: WikiOS's own limit on top of the write limit (the browser route has the same). */
const UPLOADS_PER_MINUTE = 20;
const WINDOW_MS = 60_000;

const underscored = (name: string) => name.replace(/ /g, "_");

/** The service's warnings as MediaWiki writes them: names with underscores, and `nochange` with the time of the version. */
function warningsBody(warnings: UploadWarnings, current: FileRow | undefined): JsonObject {
  return {
    ...(warnings.exists === undefined ? {} : { exists: underscored(warnings.exists) }),
    ...(warnings.nochange
      ? { nochange: { timestamp: mwTimestamp(current?.timestamp ?? new Date(0)) } }
      : {}),
    ...(warnings.duplicate ? { duplicate: warnings.duplicate.map(underscored) } : {}),
  };
}

export async function runUpload(rc: ApiContext): Promise<JsonObject> {
  requireBotSession(rc);
  const p = rc.params.scope("", "upload");
  const filename = p.string("filename");
  const comment = cleanComment(p.string("comment", ""));
  const text = p.string("text");
  const ignoreWarnings = p.flag("ignorewarnings");
  const filekey = p.string("filekey");
  const url = p.string("url");
  p.declare({ name: "file", type: "string" });
  const stashed =
    p.flag("stash") || p.has("offset") || p.has("chunk") || p.has("filesize") || p.flag("async");
  p.string("tags");
  p.string("watchlist");
  checkToken(rc);

  if (stashed) {
    throw new ApiError(
      "stashnotsupported",
      "WikiOS does not take stashed or chunked uploads: send the whole file as the file parameter."
    );
  }
  if (url !== undefined) {
    throw new ApiError(
      "copyuploaddisabled",
      "Uploads by URL are not enabled on this wiki: send the file itself."
    );
  }
  const file = rc.files.get("file");
  if (!file) {
    if (filekey !== undefined)
      throw new ApiError(
        "invalidfilekey",
        "WikiOS keeps no stashed uploads: send the file itself."
      );
    throw missingOneOf(["filekey", "file", "url"]);
  }
  const name = filename ?? file.filename;
  if (!name) throw missingParam("filename");

  const limit = await rc.deps.rateLimit(rc.clientKey, "wiki_upload", {
    maxRequests: UPLOADS_PER_MINUTE,
    windowMs: WINDOW_MS,
  });
  if (!limit.success)
    throw new ApiError(
      "ratelimited",
      "You've exceeded your rate limit. Please wait some time and try again."
    );

  const result = await rc.deps.services.uploadFile({
    ctx: rc.session.ctx,
    bytes: file.bytes,
    filename: name,
    comment,
    // `text` is the whole page, as in MediaWiki; without it the page is the comment (MediaWiki's own default).
    pageText: text ?? comment,
    ignoreWarnings,
  });

  const [current] = await rc.deps.store.filesByName([result.filename]);
  if (result.result === "Warning") {
    return {
      upload: {
        result: "Warning",
        warnings: warningsBody(result.warnings, current),
      },
    };
  }
  // The same bytes as the current version, told to go on: nothing was stored, and MediaWiki refuses it the same way.
  if (result.noChange) {
    throw new ApiError(
      "fileexists-no-change",
      `The upload is an exact duplicate of the current version of [[:${result.title}]].`
    );
  }
  return {
    upload: {
      result: "Success",
      filename: underscored(result.filename),
      imageinfo: current ? { ...uploadImageInfo(current, rc.deps.siteUrl) } : {},
    },
  };
}
