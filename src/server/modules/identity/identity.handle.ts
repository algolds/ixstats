/**
 * IxStates Passport handles: pure format, reserved-word and slug rules (no DB).
 * Availability against stored handles is the caller's job; `pickAvailableHandle` only
 * de-duplicates against a set the caller supplies.
 */

export const HANDLE_PATTERN = /^[a-z0-9_]{3,24}$/;

const HANDLE_MAX = 24;
const HANDLE_MIN = 3;

/** Handles that would collide with passport sub-routes or reserved URL segments. */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "me",
  "admin",
  "embed",
  "settings",
  "board",
  "nations",
  "rules",
  "manage",
  "happenings",
  "api",
  "id",
  "new",
]);

export type HandleValidation = { ok: true; handle: string } | { ok: false; reason: "format" | "reserved" };

/** Lowercases, strips one leading `@`, trims. */
export function normalizeHandle(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return (trimmed.startsWith("@") ? trimmed.slice(1) : trimmed).trim();
}

export function validateHandle(raw: string): HandleValidation {
  const handle = normalizeHandle(raw);
  if (RESERVED_HANDLES.has(handle)) return { ok: false, reason: "reserved" };
  if (!HANDLE_PATTERN.test(handle)) return { ok: false, reason: "format" };
  return { ok: true, handle };
}

/** Turns a display name or username into a valid, non-reserved handle candidate. */
export function slugifyHandle(source: string): string {
  const slug = source
    .toLowerCase()
    .replace(/[\s-]/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, HANDLE_MAX)
    .padEnd(HANDLE_MIN, "_");
  return RESERVED_HANDLES.has(slug) ? `${slug}_1` : slug;
}

/** Returns `base`, else `base_2`, `base_3`, ... keeping the result within 24 characters. */
export function pickAvailableHandle(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `_${n}`;
    const candidate = `${base.slice(0, HANDLE_MAX - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
