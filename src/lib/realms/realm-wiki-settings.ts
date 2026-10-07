/**
 * A realm's wiki (`Realm.settings.wiki`): the sister wiki its lore lives on and how its world is found there (the
 * root category and keyword the lore import crawls, the roster category that lists its nations, its portal page
 * and any extra map categories). Discovery (`sources/iiwiki-discovery.ts`) and the lore import script read it;
 * site admins (/admin/realms → Wiki) and the founder (Manage → Wiki) edit it.
 *
 * Also the map a realm chose from its wiki (`Realm.settings.map`: `source`, `attribution`, `file`), kept so a later
 * re-check can tell whether the wiki's file changed. Client-safe.
 *
 * A wiki is named by its id in `~/lib/wiki-os/wiki-hosts.ts`, never by a URL, so these settings cannot point the
 * server at a host that is not allowlisted.
 */
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { SISTER_READER_IDS, SISTER_WIKI_HOSTS, type SisterReaderId } from "~/lib/wiki-os/wiki-hosts";

/** The wikis a realm can name: every sister wiki WikiOS reads. IxWiki is IxWorld's and is never crawled. */
export const REALM_WIKI_SOURCES: readonly SisterReaderId[] = SISTER_READER_IDS;
export type RealmWikiSource = SisterReaderId;

export const REALM_WIKI_SOURCE_OPTIONS = REALM_WIKI_SOURCES.map((id) => ({
  id,
  name: SISTER_WIKI_HOSTS[id].name,
}));

export const MAX_TITLE_LENGTH = 255;
export const MAX_KEYWORD_LENGTH = 100;
export const MAX_MAP_CATEGORIES = 5;

/** Characters MediaWiki never allows in a title, plus control characters. */
// oxlint-disable-next-line no-control-regex -- refusing control characters is the point
const BAD_TITLE_CHARS = /[#<>[\]|{}\u0000-\u001f\u007f]/;

/** MediaWiki's own spelling of a title: underscores are spaces, runs of spaces are one, first letter upper-case. */
export function normalizeWikiTitle(title: string): string {
  const spaced = title.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const pageTitleSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .max(MAX_TITLE_LENGTH)
  .refine((title) => !BAD_TITLE_CHARS.test(title), "A wiki title can't contain # < > [ ] | { }")
  .transform(normalizeWikiTitle);

const CATEGORY_PREFIX = /^category\s*:\s*/i;

/** A category title, spelled `Category:Name` whatever case the prefix was typed in. */
export const categoryTitleSchema = pageTitleSchema
  .refine((title) => CATEGORY_PREFIX.test(title) && title.replace(CATEGORY_PREFIX, "").length > 0, {
    message: 'Start with "Category:"',
  })
  .transform((title) => `Category:${normalizeWikiTitle(title.replace(CATEGORY_PREFIX, ""))}`);

const RETIRED = /retired/i;

/** A file title, spelled `File:Name.ext` (an `Image:` prefix or none is accepted). */
export const fileTitleSchema = pageTitleSchema
  .transform((title) => `File:${normalizeWikiTitle(title.replace(/^(?:file|image)\s*:\s*/i, ""))}`)
  .refine((title) => title.length > "File:".length && title.length <= MAX_TITLE_LENGTH, "Not a file title");

export const realmWikiSettingsSchema = z.object({
  source: z.enum(REALM_WIKI_SOURCES),
  /** The category tree the lore import crawls: "Category:Eurth". */
  rootCategory: categoryTitleSchema,
  /** Only subcategories whose title contains it are followed: "Eurth". */
  keyword: z.string().trim().min(1, "Required").max(MAX_KEYWORD_LENGTH),
  /** One subcategory or page per nation: "Category:Countries (Eurth)". A retired roster is refused. */
  rosterCategory: categoryTitleSchema
    .refine((title) => !RETIRED.test(title), "A retired roster lists nations nobody can claim")
    .nullable()
    .default(null),
  /** The world's portal page: "Portal:Eurth". Its images are map candidates. */
  portalTitle: pageTitleSchema.nullable().default(null),
  /** Categories of map files besides the usual names ("Category:Maps of Eurth", "Category:Eurth maps"). */
  mapCategories: z.array(categoryTitleSchema).max(MAX_MAP_CATEGORIES).default([]),
});

export type RealmWikiSettings = z.infer<typeof realmWikiSettingsSchema>;
export type RealmWikiSettingsInput = z.input<typeof realmWikiSettingsSchema>;

/** The stored settings object; a non-object becomes `{}`. */
function storedSettings(settings: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  return settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
}

/** The realm's wiki settings (`settings.wiki`), or null when unset or malformed. */
export function realmWikiSettings(settings: Prisma.JsonValue | null | undefined): RealmWikiSettings | null {
  const parsed = realmWikiSettingsSchema.safeParse(storedSettings(settings).wiki);
  return parsed.success ? parsed.data : null;
}

/** `Realm.settings` with the wiki settings set, or removed (`null`); every other stored key is kept. */
export function withRealmWikiSettings(
  settings: Prisma.JsonValue | null | undefined,
  wiki: RealmWikiSettings | null
): Prisma.JsonObject {
  const { wiki: _previous, ...rest } = storedSettings(settings);
  return wiki ? { ...rest, wiki: { ...wiki } } : rest;
}

const sha1Schema = z.string().regex(/^[0-9a-f]{40}$/, "Not a SHA-1");

/** The map file a realm chose from its wiki (`settings.map.source`). */
export const realmMapSourceSchema = z.object({
  wiki: z.enum(REALM_WIKI_SOURCES),
  fileTitle: fileTitleSchema,
  sha1: sha1Schema,
});
export type RealmMapSource = z.infer<typeof realmMapSourceSchema>;

/** What was known of the chosen file when it was chosen or last checked (`settings.map.file`). */
export const realmMapFileSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  size: z.number().int().nonnegative(),
  mime: z.string().max(100),
  licence: z.string().max(500).nullable(),
  descriptionUrl: z.string().max(2000).nullable(),
  chosenAt: z.string().max(40),
  chosenBy: z.string().max(200),
  checkedAt: z.string().max(40).nullable().default(null),
});
export type RealmMapFile = z.infer<typeof realmMapFileSchema>;

export interface RealmWikiMap {
  source: RealmMapSource;
  attribution: string | null;
  file: RealmMapFile | null;
}

/** The map the realm chose from its wiki, or null when none is stored (or the stored value is malformed). */
export function realmWikiMap(settings: Prisma.JsonValue | null | undefined): RealmWikiMap | null {
  const map = storedSettings(storedSettings(settings).map as Prisma.JsonValue);
  const source = realmMapSourceSchema.safeParse(map.source);
  if (!source.success) return null;
  const file = realmMapFileSchema.safeParse(map.file);
  return {
    source: source.data,
    attribution: typeof map.attribution === "string" && map.attribution.trim() ? map.attribution : null,
    file: file.success ? file.data : null,
  };
}

/**
 * `Realm.settings` with the chosen wiki map stored under `settings.map` (`source`, `attribution`, `file`). Other
 * keys of `settings.map`, and every other key of the settings, are kept.
 */
export function withRealmWikiMap(
  settings: Prisma.JsonValue | null | undefined,
  map: RealmWikiMap
): Prisma.JsonObject {
  const stored = storedSettings(settings);
  const previous = storedSettings(stored.map as Prisma.JsonValue);
  return {
    ...stored,
    map: {
      ...previous,
      source: { ...map.source },
      attribution: map.attribution,
      file: map.file ? { ...map.file } : null,
    },
  };
}
