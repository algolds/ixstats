/**
 * The handle a passport URL segment (`[username]` in `/id/…`, `/r/{realm}/u/…` and the legacy
 * `/r/{realm}/…`) carries: percent-decoded, one leading `@` dropped. Client-safe.
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

/** Whether the segment already names a handle with `@` (literal or `%40`), as `/r/{realm}/@{handle}` does. */
export function segmentHasAt(raw: string): boolean {
  return raw.startsWith("@") || raw.startsWith("%40");
}
