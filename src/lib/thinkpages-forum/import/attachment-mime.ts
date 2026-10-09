/**
 * The MIME type recorded for an exported XenForo attachment. The download's Content-Type wins; the attachment
 * metadata's `content_type` is used only when it is a real MIME type (XenForo may put the owning content type,
 * "post", there); otherwise the file extension decides.
 */

const BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  txt: "text/plain",
  zip: "application/zip",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
};

export const UNKNOWN_MIME = "application/octet-stream";

/** "Image/PNG; charset=binary" → "image/png"; "" when it is not a type/subtype pair or is the unknown type. */
function usable(candidate: string | null | undefined): string {
  const mime = (candidate ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime) && mime !== UNKNOWN_MIME ? mime : "";
}

export function mimeFromFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
  return BY_EXTENSION[ext] ?? UNKNOWN_MIME;
}

/** The first usable of `candidates` (download header first), else the type for the file extension. */
export function attachmentMime(
  candidates: Array<string | null | undefined>,
  filename: string
): string {
  for (const candidate of candidates) {
    const mime = usable(candidate);
    if (mime) return mime;
  }
  return mimeFromFilename(filename);
}
