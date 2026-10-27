/**
 * upload-error.ts — the refusal of an upload itself (not of the uploader's rights): a file that may not be uploaded.
 * Its own module so a route can recognise it without loading the upload service.
 */

/** MediaWiki's code (`filetype-badmime`, `empty-file`, `file-too-large`, ...) and the sentence that explains it. */
export class UploadError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "UploadError";
  }
}
