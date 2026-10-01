/**
 * import-request.ts — what a web import request looks like, shared by the import route (which
 * enforces it) and the import page (which builds it). No server imports: it runs in the browser.
 */

/**
 * Largest dump the web import accepts: 9.5 MiB of request body. Next.js clones a request body for
 * its proxy and caps the clone at `experimental.proxyClientMaxBodySize` (10 MiB by default), so a
 * larger body would arrive silently truncated; staying under the cap keeps "too large" detectable.
 * Bigger dumps go through `scripts/wikios-import-xml.ts`.
 */
export const DEFAULT_MAX_UPLOAD_BYTES = Math.floor(9.5 * 1024 * 1024);

export type UploadKind = "xml" | "gzip";

/** Whether a Content-Type names an XML dump or a gzipped one; null for anything else. */
export function uploadKind(contentType: string | null): UploadKind | null {
  const type = (contentType ?? "").split(";")[0]?.trim().toLowerCase();
  if (type === "application/xml" || type === "text/xml") return "xml";
  if (type === "application/gzip" || type === "application/x-gzip") return "gzip";
  return null;
}

/** The Content-Type to send a chosen file with: browsers often leave it empty or call .gz octet-stream. */
export function contentTypeFor(file: { name: string; type: string }): string {
  if (/\.gz$/i.test(file.name)) return "application/gzip";
  return uploadKind(file.type) ? file.type : "application/xml";
}

/** A byte limit as the page words it: "10 MB" for the default. */
export function formatLimit(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`;
}
