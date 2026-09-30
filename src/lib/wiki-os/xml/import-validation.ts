/**
 * import-validation.ts — what the importer accepts from a dump, stated once.
 *
 * A dump is untrusted input that ends up in typed columns, so a value that cannot be stored (or
 * could only be stored by rounding it into something else) rejects the page with a message that
 * says which value and why.
 */

import { contentModelFor } from "./content-model";
import type { XmlRevision } from "./types";

/** A page the dump describes wrongly (as opposed to one the database failed to take). */
export class PageRejected extends Error {}

/** Largest value of a PostgreSQL `integer` (the page id, revision id, size and namespace columns). */
export const MAX_INT4 = 2_147_483_647;

/** The one timestamp form MediaWiki dumps use: `2026-01-02T03:04:05Z`, UTC, whole seconds. */
const MW_TIMESTAMP = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;

/**
 * Milliseconds since the epoch of `timestamp`, or null when it is not exactly the dump form or
 * not a real moment (`Date.parse` rolls February 30th or hour 24 forward; here they are invalid).
 */
export function parseMwTimestamp(timestamp: string): number | null {
  if (!MW_TIMESTAMP.test(timestamp) || timestamp.startsWith("0000")) return null;
  const time = Date.parse(timestamp);
  if (Number.isNaN(time)) return null;
  return `${new Date(time).toISOString().slice(0, 19)}Z` === timestamp ? time : null;
}

/** Throws unless `value` is null (absent) or a whole number from 0 to 2147483647. */
export function checkInt4(label: string, value: number | null): void {
  if (value === null) return;
  if (!Number.isInteger(value) || value < 0 || value > MAX_INT4) {
    throw new PageRejected(
      `The ${label} must be a whole number from 0 to ${MAX_INT4}, not ${value}`
    );
  }
}

/**
 * A warning (never an error) when revisions declare a content model other than the one
 * MediaWiki's defaults give `title`, or null when they all agree.
 */
export function modelWarning(title: string, revisions: XmlRevision[]): string | null {
  const expected = contentModelFor(title).model;
  const other = [...new Set(revisions.map((revision) => revision.model))].filter(
    (model) => model !== expected
  );
  if (other.length === 0) return null;
  const listed = other.map((model) => JSON.stringify(model)).join(", ");
  return `Content model ${listed} differs from "${expected}", the model MediaWiki's defaults give this title`;
}
