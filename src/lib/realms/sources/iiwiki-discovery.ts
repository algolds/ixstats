/**
 * World discovery on a sister wiki (P2.2): from a realm's wiki settings (`realm-wiki-settings.ts`), find its
 * nation roster, each nation's infobox hints (flag, coat of arms, capital and its `{{coord}}`, locator map files)
 * and the candidate world maps (files of the world's map categories, images on its portal, the portal's page
 * image), ranked for a flat political map (large, about 2:1), each with its imageinfo (original URL, size, type,
 * SHA-1, licence and author).
 *
 * Built for IIWiki, where a world is a portal, a root category, a keyword and a roster category on one shared
 * MediaWiki, and for any sister wiki laid out the same way. Every read goes through the throttled client
 * (`wiki-discovery-client.ts`): sequential, paced, capped, Retry-After honoured. A refusal never throws: each
 * phase keeps what it gathered and the report says `blocked`.
 *
 * Why not a source-sync adapter: an adapter (`adapters/types.ts`) parses files a GitHub provider already fetched,
 * synchronously and without network access, and a sync already takes roster nations and their infobox figures
 * from the lore index (`addRosterNations`, `useWikiInfobox`). Discovery is an interactive, rate-limited read
 * whose answer may be partial, so it is a standalone service the realm's wiki panel calls step by step.
 */
import { z } from "zod";
import {
  crawlRealmCategory,
  detectNationTitles,
  listRosterNations,
  queryAll,
  ContinueSchema,
  suspectRosterEntries,
} from "~/lib/realms/lore-import";
import type { RealmWikiSettings } from "~/lib/realms/realm-wiki-settings";
import {
  cleanWikiValue,
  extractCoordsFromFields,
  firstCoordBody,
  parseCoordTemplate,
  parseInfobox,
  type InfoboxField,
} from "~/lib/wiki-os/transformers/infobox-parser";
import { DiscoveryStopped, type DiscoveryClient, type DiscoveryStop } from "./wiki-discovery-client";
import { asFileTitle, fetchWikiFileInfo, type WikiFileInfo } from "./wiki-file-info";

/** Caps: what one discovery reads at most. */
export const MAX_ROSTER_NATIONS = 400;
/** Without a roster, the category crawl the infobox heuristic reads is capped at this many pages. */
export const MAX_CRAWL_PAGES = 300;
export const MAX_CRAWL_DEPTH = 2;
export const HINT_BATCH = 50;
export const MAX_MAP_SOURCE_CATEGORIES = 8;
export const MAX_FILES_PER_CATEGORY = 100;
export const MAX_MAP_CANDIDATES = 20;
/** A map narrower than this many pixels is not worth importing. */
export const MIN_MAP_WIDTH = 400;

export type DiscoveryPhase = "roster" | "hints" | "maps";

/** Where a discovery step stopped early, and in which phase. */
export interface DiscoveryBlock extends DiscoveryStop {
  phase: DiscoveryPhase;
}

/** Whether a stop means the wiki refused (as opposed to a cap or an error). */
export function isBlockingStop(stop: DiscoveryStop | null): boolean {
  return stop?.kind === "blocked" || stop?.kind === "rate-limited";
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export interface RosterResult {
  method: "roster" | "infobox";
  category: string | null;
  nations: string[];
  /** Roster entries that look like a subcategory of pages rather than a nation (kept; a warning). */
  suspects: string[];
  /** The cap or the crawl limits cut the list short. */
  truncated: boolean;
}

export interface StepResult<T> {
  data: T;
  stopped: DiscoveryBlock | null;
  requests: number;
}

function stoppedIn(client: DiscoveryClient, phase: DiscoveryPhase): DiscoveryBlock | null {
  const stop = client.stopped();
  return stop ? { ...stop, phase } : null;
}

/** Runs a phase; a DiscoveryStopped ends it quietly (what it gathered is in its accumulator). */
async function runPhase<T>(client: DiscoveryClient, name: DiscoveryPhase, data: T, run: () => Promise<void>) {
  const before = client.requests();
  try {
    await run();
  } catch (error) {
    if (!(error instanceof DiscoveryStopped)) throw error;
  }
  return { data, stopped: stoppedIn(client, name), requests: client.requests() - before } satisfies StepResult<T>;
}

/**
 * The world's nations: the roster category's entries (lore-import's roster rule: one subcategory or page per
 * nation), else, without a roster, the pages of a capped category crawl whose lead uses Infobox country.
 */
export async function discoverRoster(
  client: DiscoveryClient,
  settings: RealmWikiSettings
): Promise<StepResult<RosterResult>> {
  const result: RosterResult = {
    method: settings.rosterCategory ? "roster" : "infobox",
    category: settings.rosterCategory,
    nations: [],
    suspects: [],
    truncated: false,
  };
  return runPhase(client, "roster", result, async () => {
    let nations: string[];
    if (settings.rosterCategory) {
      nations = await listRosterNations(client.query, settings.rosterCategory);
    } else {
      const crawl = await crawlRealmCategory(client.query, {
        rootCategory: settings.rootCategory,
        keyword: settings.keyword,
        maxDepth: MAX_CRAWL_DEPTH,
        maxPages: MAX_CRAWL_PAGES,
      });
      result.truncated = crawl.truncated;
      nations = [...(await detectNationTitles(client.query, crawl.pages))].sort();
    }
    result.truncated ||= nations.length > MAX_ROSTER_NATIONS;
    result.nations = nations.slice(0, MAX_ROSTER_NATIONS);
    result.suspects = suspectRosterEntries(result.nations);
  });
}

// ---------------------------------------------------------------------------
// Infobox hints
// ---------------------------------------------------------------------------

export interface NationHint {
  title: string;
  /** The page does not exist on the wiki. */
  missing: boolean;
  /** The page's lead has an infobox. */
  hasInfobox: boolean;
  /** File names without the `File:` prefix. */
  flag: string | null;
  coatOfArms: string | null;
  capital: string | null;
  /** [longitude, latitude] of the capital, from a `{{coord}}` in the capital or coordinates field. */
  capitalCoordinates: [number, number] | null;
  /** Locator and map images (`image_map`, `locator_map`, `map`, …), in field order. */
  mapFiles: string[];
}

const FLAG_FIELDS = ["image_flag", "flag", "flag_image", "image_flag2"];
const COAT_FIELDS = ["image_coat", "coat_of_arms", "image_coa", "coa", "image_symbol", "emblem"];
const MAP_FIELDS = ["image_map", "locator_map", "map", "image_map2", "map_image", "location_map", "image_location"];
const COORD_FIELDS = ["capital_coordinates", "capital_coord", "coordinates", "coords", "coord"];
const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|svg|webp|tiff?)$/i;

const fieldOf = (fields: InfoboxField[], key: string) =>
  fields.find((f) => f.key.toLowerCase().replace(/[\s-]+/g, "_") === key);

/** A file name from an infobox image value: `Flag.svg`, `File:Flag.svg`, `[[File:Flag.svg|120px]]`. */
export function infoboxFileName(raw: string | undefined): string | null {
  if (!raw) return null;
  const inner = /\[\[\s*(?:file|image)\s*:([^|\]]+)/i.exec(raw)?.[1] ?? raw.split("|")[0] ?? "";
  const name = inner
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^\s*(?:file|image)\s*:/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || name.length > 240 || /[{}<>[\]]|https?:/i.test(name) || !IMAGE_EXTENSION.test(name)) return null;
  return asFileTitle(name).slice("File:".length);
}

function firstFile(fields: InfoboxField[], keys: string[]): string | null {
  for (const key of keys) {
    const name = infoboxFileName(fieldOf(fields, key)?.rawValue);
    if (name) return name;
  }
  return null;
}

function validCoords(coords: [number, number] | null): [number, number] | null {
  if (!coords) return null;
  const [lng, lat] = coords;
  return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? coords
    : null;
}

/** The capital's coordinates: a `{{coord}}` in the capital field, then in a coordinates field, then latd/longd. */
function capitalCoordinates(fields: InfoboxField[]): [number, number] | null {
  const capital = fieldOf(fields, "capital")?.rawValue;
  if (capital && firstCoordBody(capital) !== null) {
    const coords = validCoords(parseCoordTemplate(capital));
    if (coords) return coords;
  }
  for (const key of COORD_FIELDS) {
    const raw = fieldOf(fields, key)?.rawValue;
    if (raw && firstCoordBody(raw) !== null) {
      const coords = validCoords(parseCoordTemplate(raw));
      if (coords) return coords;
    }
  }
  return validCoords(extractCoordsFromFields(fields));
}

/** The capital's name: the capital field without its coordinates, first value only. */
function capitalName(fields: InfoboxField[]): string | null {
  const raw = fieldOf(fields, "capital")?.rawValue;
  if (!raw) return null;
  const name = cleanWikiValue(raw).split(",")[0]?.trim() ?? "";
  return name ? name.slice(0, 120) : null;
}

/** Pure: a nation page's hints from its wikitext. */
export function nationHintFromWikitext(title: string, wikitext: string | null): NationHint {
  const empty: NationHint = {
    title,
    missing: wikitext === null,
    hasInfobox: false,
    flag: null,
    coatOfArms: null,
    capital: null,
    capitalCoordinates: null,
    mapFiles: [],
  };
  if (!wikitext) return empty;
  const infobox = parseInfobox(wikitext);
  if (!infobox) return empty;
  const fields = infobox.fields;
  const mapFiles = MAP_FIELDS.map((key) => infoboxFileName(fieldOf(fields, key)?.rawValue)).filter(
    (name): name is string => name !== null
  );
  return {
    ...empty,
    hasInfobox: true,
    flag: firstFile(fields, FLAG_FIELDS),
    coatOfArms: firstFile(fields, COAT_FIELDS),
    capital: capitalName(fields),
    capitalCoordinates: capitalCoordinates(fields),
    mapFiles: [...new Set(mapFiles)],
  };
}

const ContentSchema = z.object({
  query: z
    .object({
      redirects: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
      normalized: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
      pages: z.array(
        z.object({
          title: z.string(),
          missing: z.boolean().optional(),
          revisions: z
            .array(z.object({ slots: z.object({ main: z.object({ content: z.string().optional() }) }) }))
            .optional(),
        })
      ),
    })
    .optional(),
  continue: ContinueSchema,
});

/**
 * Hints for up to HINT_BATCH nation pages (call once per batch; redirects are followed and reported under the
 * title asked for). A page the wiki says is missing gets `missing: true`; a stop keeps the pages read so far.
 */
export async function discoverNationHints(
  client: DiscoveryClient,
  titles: string[]
): Promise<StepResult<NationHint[]>> {
  const batch = [...new Set(titles)].slice(0, HINT_BATCH);
  const hints: NationHint[] = [];
  return runPhase(client, "hints", hints, async () => {
    if (batch.length === 0) return;
    const responses = await queryAll(
      client.query,
      { prop: "revisions", rvprop: "content", rvslots: "main", redirects: "1", titles: batch.join("|") },
      ContentSchema
    );
    // Map a returned title back to the title asked for, through normalization and redirects.
    const back = new Map<string, string>();
    for (const r of responses) {
      for (const n of r.query?.normalized ?? []) back.set(n.to, back.get(n.from) ?? n.from);
      for (const n of r.query?.redirects ?? []) back.set(n.to, back.get(n.from) ?? n.from);
    }
    const found = new Map<string, string | null>();
    for (const page of responses.flatMap((r) => r.query?.pages ?? [])) {
      const asked = back.get(page.title) ?? page.title;
      const content = page.revisions?.[0]?.slots.main.content;
      if (page.missing) found.set(asked, null);
      else if (content !== undefined || !found.has(asked)) found.set(asked, content ?? "");
    }
    for (const title of batch) {
      if (found.has(title)) hints.push(nationHintFromWikitext(title, found.get(title) ?? null));
    }
  });
}

// ---------------------------------------------------------------------------
// Map candidates
// ---------------------------------------------------------------------------

export interface MapCandidate extends WikiFileInfo {
  /** Where it was found: a category title, "portal images" or "portal page image". */
  foundIn: string[];
  score: number;
}

const FilesSchema = z.object({
  query: z
    .object({ categorymembers: z.array(z.object({ ns: z.number(), title: z.string() })) })
    .optional(),
  continue: ContinueSchema,
});

const PortalImagesSchema = z.object({
  query: z
    .object({
      pages: z.array(
        z.object({
          title: z.string(),
          missing: z.boolean().optional(),
          images: z.array(z.object({ title: z.string() })).optional(),
          pageimage: z.string().optional(),
          original: z.object({ source: z.string() }).optional(),
        })
      ),
    })
    .optional(),
  continue: ContinueSchema,
});

const NS_FILE = 6;
const NS_CATEGORY = 14;
const MAP_WORD = /\bmaps?\b/i;
/** Files that are never the world map: flags, arms, seals, logos, locators, icons. */
const NOT_A_WORLD_MAP =
  /\b(?:flag|flags|coat[\s_]of[\s_]arms|coa|arms|seal|emblem|logo|icon|locator|location|orthographic|portrait|banner)\b/i;
const MAP_MIMES = new Set(["image/png", "image/svg+xml", "image/jpeg", "image/gif", "image/webp", "image/tiff"]);

/** The categories map files are looked for in: the realm's own, the usual names, the root's "map" subcategories. */
export function mapCategoryNames(settings: RealmWikiSettings, rootSubcategories: string[]): string[] {
  const keyword = settings.keyword;
  const usual = [`Category:Maps of ${keyword}`, `Category:${keyword} maps`, `Category:Maps (${keyword})`];
  const fromRoot = rootSubcategories.filter((title) => MAP_WORD.test(title.replace(/^Category:/, "")));
  return [...new Set([...settings.mapCategories, ...usual, ...fromRoot])].slice(0, MAX_MAP_SOURCE_CATEGORIES);
}

/**
 * How good a flat world map a file looks, 0 to about 1.3: closeness to 2:1 (equirectangular) and size weigh
 * most; PNG and SVG beat JPEG (compression noise adds stray colours); a file in a map category or with "map" or
 * "political" in its name gets a little more.
 */
export function mapCandidateScore(file: Pick<WikiFileInfo, "width" | "height" | "mime" | "fileTitle">, foundIn: string[]) {
  const aspect = file.width / file.height;
  const ratio = Math.max(0, 1 - Math.abs(Math.log2(aspect / 2)));
  const pixels = file.width * file.height;
  const size = Math.min(1, Math.max(0, (Math.log2(pixels) - Math.log2(250_000)) / (Math.log2(32_000_000) - Math.log2(250_000))));
  const mime = file.mime === "image/png" || file.mime === "image/svg+xml" ? 0.15 : file.mime === "image/jpeg" ? -0.1 : 0;
  const inCategory = foundIn.some((place) => place.startsWith("Category:")) ? 0.1 : 0;
  const named = /\b(?:political|world|map)\b/i.test(file.fileTitle) ? 0.05 : 0;
  return Math.round((0.5 * ratio + 0.4 * size + mime + inCategory + named) * 1000) / 1000;
}

/** Ranked map candidates from the files found and their imageinfo: images only, wide enough, best first, capped. */
export function rankMapCandidates(
  files: Map<string, WikiFileInfo>,
  foundIn: Map<string, string[]>,
  exclude: Set<string> = new Set()
): MapCandidate[] {
  const candidates: MapCandidate[] = [];
  for (const [title, file] of files) {
    if (exclude.has(title) || !MAP_MIMES.has(file.mime) || file.width < MIN_MAP_WIDTH) continue;
    if (NOT_A_WORLD_MAP.test(title.replace(/^File:/, "").replace(/[_.]/g, " "))) continue;
    const places = foundIn.get(title) ?? [];
    candidates.push({ ...file, foundIn: places, score: mapCandidateScore(file, places) });
  }
  return candidates
    .sort((a, b) => b.score - a.score || b.width * b.height - a.width * a.height || a.fileTitle.localeCompare(b.fileTitle))
    .slice(0, MAX_MAP_CANDIDATES);
}

export interface MapDiscovery {
  categories: string[];
  candidates: MapCandidate[];
  /** Files found whose imageinfo was not read (the client stopped first). */
  unread: number;
}

/**
 * Candidate world maps: files in the world's map categories, images on its portal and the portal's page image,
 * ranked. `exclude` holds file titles known not to be the world map (the nations' flags and arms).
 */
export async function discoverMapCandidates(
  client: DiscoveryClient,
  settings: RealmWikiSettings,
  exclude: Set<string> = new Set()
): Promise<StepResult<MapDiscovery>> {
  const result: MapDiscovery = { categories: [], candidates: [], unread: 0 };
  const foundIn = new Map<string, string[]>();
  const files = new Map<string, WikiFileInfo>();
  const note = (title: string, place: string) => {
    const file = asFileTitle(title);
    foundIn.set(file, [...new Set([...(foundIn.get(file) ?? []), place])]);
  };
  const finish = () => {
    result.candidates = rankMapCandidates(files, foundIn, new Set([...exclude].map(asFileTitle)));
    result.unread = [...foundIn.keys()].filter((title) => !files.has(title)).length;
  };
  return runPhase(client, "maps", result, async () => {
    try {
      const subcats = await client.query(
        { list: "categorymembers", cmtitle: settings.rootCategory, cmtype: "subcat", cmlimit: "500" },
        FilesSchema
      );
      result.categories = mapCategoryNames(
        settings,
        (subcats.query?.categorymembers ?? []).filter((m) => m.ns === NS_CATEGORY).map((m) => m.title)
      );
      for (const category of result.categories) {
        const members = await client.query(
          { list: "categorymembers", cmtitle: category, cmtype: "file", cmlimit: String(MAX_FILES_PER_CATEGORY) },
          FilesSchema
        );
        for (const m of members.query?.categorymembers ?? []) if (m.ns === NS_FILE) note(m.title, category);
      }
      if (settings.portalTitle) {
        const portal = await client.query(
          { prop: "images|pageimages", titles: settings.portalTitle, imlimit: "100", piprop: "name|original" },
          PortalImagesSchema
        );
        for (const page of portal.query?.pages ?? []) {
          for (const image of page.images ?? []) note(image.title, "portal images");
          if (page.pageimage) note(page.pageimage, "portal page image");
        }
      }
      await fetchWikiFileInfo(client.source, client.query, [...foundIn.keys()], files);
    } finally {
      finish();
    }
  });
}

// ---------------------------------------------------------------------------
// One call: every phase (the script and tests; the panel calls the steps itself)
// ---------------------------------------------------------------------------

export interface DiscoveryReport {
  source: string;
  roster: RosterResult;
  nations: NationHint[];
  maps: MapDiscovery;
  requests: number;
  /** True when the wiki refused or rate-limited part-way: the report holds what was gathered. */
  blocked: boolean;
  /** Why discovery stopped early (refused, a cap, an error), or null when every phase ran. */
  stopped: DiscoveryBlock | null;
}

/** Every phase in order, stopping at the first refusal; never throws for a wiki that refuses. */
export async function runDiscovery(client: DiscoveryClient, settings: RealmWikiSettings): Promise<DiscoveryReport> {
  const roster = await discoverRoster(client, settings);
  const nations: NationHint[] = [];
  let stopped = roster.stopped;
  for (let i = 0; !stopped && i < roster.data.nations.length; i += HINT_BATCH) {
    const hints = await discoverNationHints(client, roster.data.nations.slice(i, i + HINT_BATCH));
    nations.push(...hints.data);
    stopped = hints.stopped;
  }
  const exclude = new Set(nations.flatMap((n) => [n.flag, n.coatOfArms, ...n.mapFiles]).filter((f): f is string => !!f));
  let maps: MapDiscovery = { categories: [], candidates: [], unread: 0 };
  if (!stopped) {
    const step = await discoverMapCandidates(client, settings, exclude);
    maps = step.data;
    stopped = step.stopped;
  }
  return {
    source: client.source,
    roster: roster.data,
    nations,
    maps,
    requests: client.requests(),
    blocked: isBlockingStop(stopped),
    stopped,
  };
}
