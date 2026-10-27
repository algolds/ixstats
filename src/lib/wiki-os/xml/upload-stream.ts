/**
 * upload-stream.ts — an uploaded dump as a bounded stream of bytes.
 *
 * The request body is never buffered: it passes through a byte counter (a TransformStream) that
 * fails the stream once more than the limit went by, whatever the Content-Length claimed or
 * whether it had one; is gunzipped when it is gzip; and is counted again after decompression
 * (a small archive cannot expand without limit).
 */

import { pipeline, Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { chunksOfStream } from "./import-reader";

export class PayloadTooLargeError extends Error {
  constructor(
    readonly limit: number,
    what: string
  ) {
    super(`${what} is larger than ${limit} bytes`);
  }
}

/** A transform that passes bytes through and fails with PayloadTooLargeError past `limit` bytes. */
export function byteLimit(limit: number, what: string): TransformStream<Uint8Array, Uint8Array> {
  let seen = 0;
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > limit) throw new PayloadTooLargeError(limit, what);
      controller.enqueue(chunk);
    },
  });
}

/** `source` with the same bound as `byteLimit`, for a Node stream. */
async function* limitBytes(
  source: AsyncIterable<Uint8Array>,
  limit: number,
  what: string
): AsyncGenerator<Uint8Array> {
  let seen = 0;
  for await (const chunk of source) {
    seen += chunk.byteLength;
    if (seen > limit) throw new PayloadTooLargeError(limit, what);
    yield chunk;
  }
}

export interface UploadLimits {
  /** The body as sent (compressed, for gzip). */
  maxBytes: number;
  /** The body once decompressed (gzip only). */
  maxExpandedBytes: number;
}

/**
 * `body` bounded by `limits` and decompressed when `gzip`, as chunks for `readExport`. Any
 * failure (the limit, a corrupt archive) is thrown by the iteration.
 */
export function openUpload(
  body: ReadableStream<Uint8Array>,
  { gzip, maxBytes, maxExpandedBytes }: UploadLimits & { gzip: boolean }
): AsyncIterable<Uint8Array> {
  const wire = chunksOfStream(body.pipeThrough(byteLimit(maxBytes, "The upload")));
  if (!gzip) return wire;

  const gunzip = createGunzip();
  // pipeline forwards a failure of `wire` (the byte limit) to `gunzip`, so the reader sees it.
  pipeline(Readable.from(wire), gunzip, () => undefined);
  return limitBytes(gunzip, maxExpandedBytes, "The decompressed dump");
}
