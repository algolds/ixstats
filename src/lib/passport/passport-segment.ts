/**
 * The handle a passport URL segment (`[username]` in `/id/…` and `/r/{realm}/u/…`) carries: percent-decoded,
 * one leading `@` dropped. Client-safe.
 */

/** The segment's handle; null when its percent-encoding is malformed (`decodeURIComponent` throws). */
export function passportSegmentHandle(raw: string): string | null {
  try {
    return decodeURIComponent(raw).replace(/^@/, "");
  } catch {
    return null;
  }
}

/** The segment's handle, or the raw segment without a leading `@` when it cannot be decoded. */
export function passportSegmentHandleOrRaw(raw: string): string {
  return passportSegmentHandle(raw) ?? raw.replace(/^@/, "");
}
