/**
 * The plan of `scripts/realms/backfill-iiwiki-image-paths.ts`: which stored flag and arms values are raw IIWiki URLs,
 * and the media-proxy path each becomes. Pure.
 */
import { iiwikiStoredImagePath } from "~/lib/wiki-os/sister-media";
import { isIiwikiUrl } from "~/lib/wiki-os/wiki-hosts";

type Field = "flag" | "coatOfArms";
const FIELDS: readonly Field[] = ["flag", "coatOfArms"];

export interface ImageRow {
  id: string;
  name: string;
  flag: string | null;
  coatOfArms: string | null;
}

export interface ImageUpdate {
  id: string;
  name: string;
  data: Partial<Record<Field, string>>;
}

export interface ImageSkip {
  name: string;
  field: Field;
  value: string;
}

/** Each row's IIWiki file URLs as proxy paths; an IIWiki URL that is not a file (a page link) is reported, not changed. */
export function planIiwikiImagePaths(rows: readonly ImageRow[]): {
  updates: ImageUpdate[];
  skipped: ImageSkip[];
} {
  const updates: ImageUpdate[] = [];
  const skipped: ImageSkip[] = [];
  for (const row of rows) {
    const data: Partial<Record<Field, string>> = {};
    for (const field of FIELDS) {
      const value = row[field]?.trim();
      if (!value || !isIiwikiUrl(value)) continue;
      const path = iiwikiStoredImagePath(value);
      if (path) data[field] = path;
      else skipped.push({ name: row.name, field, value });
    }
    if (Object.keys(data).length > 0) updates.push({ id: row.id, name: row.name, data });
  }
  return { updates, skipped };
}
