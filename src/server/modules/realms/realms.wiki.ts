/**
 * A realm's wiki: its settings (`Realm.settings.wiki`), world discovery on that wiki run step by step (roster,
 * nation hints in batches, map candidates), choosing a world map from it (`Realm.settings.map`, the original
 * fetched and checked), re-checking the chosen map against the wiki (P2.6 hook), and the per-nation infobox hints
 * the map import's colour → nation step will use (P2.5).
 *
 * Who: site admins and the realm's founder (`canModerateRealm`), like the source sync: what the wiki settings name
 * decides which nations and which map a realm imports.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { globalCache } from "~/lib/cache";
import {
  REALM_WIKI_SOURCE_OPTIONS,
  realmWikiMap,
  realmWikiSettings,
  realmWikiSettingsSchema,
  withRealmWikiMap,
  withRealmWikiSettings,
  type RealmWikiMap,
  type RealmWikiSettings,
  type RealmWikiSettingsInput,
} from "~/lib/realms/realm-wiki-settings";
import {
  discoverMapCandidates,
  discoverNationHints,
  discoverRoster,
  HINT_BATCH,
  isBlockingStop,
  type DiscoveryBlock,
  type NationHint,
} from "~/lib/realms/sources/iiwiki-discovery";
import {
  createDiscoveryClient,
  DiscoveryStopped,
  type DiscoveryClient,
} from "~/lib/realms/sources/wiki-discovery-client";
import {
  asFileTitle,
  fetchWikiFileInfo,
  type WikiFileInfo,
} from "~/lib/realms/sources/wiki-file-info";
import {
  downloadWikiFileOriginal,
  WikiFileFetchError,
  type OriginalFetchDeps,
  type WikiFileOriginal,
} from "~/lib/realms/sources/wiki-file-original";
import { SOURCE_PRESETS } from "~/lib/realms/sources/presets";
import { canModerateRealm, type RealmActor } from "./realms.access";

type WikiErrorCode = "NOT_FOUND" | "FORBIDDEN" | "BAD_REQUEST" | "BAD_GATEWAY" | "CONFLICT";

export class RealmWikiError extends Error {
  constructor(
    public readonly code: WikiErrorCode,
    message: string
  ) {
    super(message);
    this.name = "RealmWikiError";
  }
}

export interface RealmWikiDeps {
  /** The throttled reader for a wiki; tests pass one over recorded responses. */
  client?: (source: RealmWikiSettings["source"]) => DiscoveryClient;
  download?: OriginalFetchDeps["download"];
}

const clientFor = (deps: RealmWikiDeps, source: RealmWikiSettings["source"]) =>
  (deps.client ?? ((s) => createDiscoveryClient(s)))(source);

interface WikiRealm {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  status: string;
  settings: Prisma.JsonValue;
}

async function loadWikiRealm(db: Pick<PrismaClient, "realm">, actor: RealmActor, slug: string): Promise<WikiRealm> {
  const realm = await db.realm.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, ownerId: true, status: true, settings: true },
  });
  if (!realm) throw new RealmWikiError("NOT_FOUND", "Realm not found");
  if (!canModerateRealm(actor, realm))
    throw new RealmWikiError("FORBIDDEN", "Only site admins and the realm's founder manage its wiki");
  return realm;
}

/** The realm, for a change to its wiki settings or chosen map: archived realms are read-only. */
async function loadWritableWikiRealm(
  db: Pick<PrismaClient, "realm">,
  actor: RealmActor,
  slug: string
): Promise<WikiRealm> {
  const realm = await loadWikiRealm(db, actor, slug);
  if (realm.status === "archived")
    throw new RealmWikiError("FORBIDDEN", "This realm is archived and can't be changed");
  return realm;
}

function requireSettings(realm: WikiRealm): RealmWikiSettings {
  const wiki = realmWikiSettings(realm.settings);
  if (!wiki) throw new RealmWikiError("BAD_REQUEST", "Set the realm's wiki first");
  return wiki;
}

/** The wiki values presets carry (the Eurth preset's IIWiki world), for "Fill from preset". */
export const WIKI_PRESETS = SOURCE_PRESETS.flatMap((preset) =>
  preset.wiki ? [{ id: preset.id, label: preset.label, wiki: preset.wiki }] : []
);

/** The panel: the realm's wiki settings (or null), the chosen wiki map (or null), the wikis and presets offered. */
export async function getRealmWikiView(db: Pick<PrismaClient, "realm">, actor: RealmActor, slug: string) {
  const realm = await loadWikiRealm(db, actor, slug);
  return {
    realm: { id: realm.id, slug: realm.slug, name: realm.name },
    wiki: realmWikiSettings(realm.settings),
    map: realmWikiMap(realm.settings),
    sources: REALM_WIKI_SOURCE_OPTIONS,
    presets: WIKI_PRESETS,
    hintBatch: HINT_BATCH,
  };
}

/** Save (or with `null`, clear) the realm's wiki settings; every other key of `Realm.settings` is kept. */
export async function saveRealmWikiSettings(
  db: Pick<PrismaClient, "realm">,
  actor: RealmActor,
  slug: string,
  input: RealmWikiSettingsInput | null
) {
  const realm = await loadWritableWikiRealm(db, actor, slug);
  let wiki: RealmWikiSettings | null = null;
  if (input) {
    const parsed = realmWikiSettingsSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new RealmWikiError("BAD_REQUEST", `${issue?.path.join(".") || "wiki"}: ${issue?.message ?? "invalid"}`);
    }
    wiki = parsed.data;
  }
  await db.realm.update({ where: { id: realm.id }, data: { settings: withRealmWikiSettings(realm.settings, wiki) } });
  await globalCache.delete(hintsCacheKey(realm.id));
  return { success: true, wiki };
}

export type DiscoveryStep =
  | { kind: "roster" }
  | { kind: "hints"; titles: string[] }
  | { kind: "maps"; exclude: string[] };

/**
 * One step of world discovery on the realm's wiki: the roster, one batch of nation hints (HINT_BATCH titles), or
 * the map candidates. The panel calls them in turn and shows progress; a step the wiki refuses returns what it
 * gathered with `blocked` set, and the panel stops there.
 */
export async function runRealmDiscoveryStep(
  db: Pick<PrismaClient, "realm">,
  actor: RealmActor,
  slug: string,
  step: DiscoveryStep,
  deps: RealmWikiDeps = {}
) {
  const realm = await loadWikiRealm(db, actor, slug);
  const wiki = requireSettings(realm);
  const client = clientFor(deps, wiki.source);
  const outcome = <T>(result: { data: T; stopped: DiscoveryBlock | null; requests: number }) => ({
    ...result,
    blocked: isBlockingStop(result.stopped),
  });
  if (step.kind === "roster") return { kind: "roster" as const, ...outcome(await discoverRoster(client, wiki)) };
  if (step.kind === "hints")
    return { kind: "hints" as const, ...outcome(await discoverNationHints(client, step.titles)) };
  return { kind: "maps" as const, ...outcome(await discoverMapCandidates(client, wiki, new Set(step.exclude))) };
}

function wikiFailure(error: unknown): never {
  if (error instanceof DiscoveryStopped) throw new RealmWikiError("BAD_GATEWAY", error.stop.message);
  if (error instanceof WikiFileFetchError) {
    const code = error.code === "UNREACHABLE" ? "BAD_GATEWAY" : "BAD_REQUEST";
    throw new RealmWikiError(code, error.message);
  }
  throw error;
}

/**
 * "Use this map": read the file's imageinfo on the realm's wiki, fetch and check the original (allowlisted hosts,
 * 40 MB, SHA-1, 64 megapixels), then store the choice in `Realm.settings.map` (`source: { wiki, fileTitle, sha1 }`,
 * `attribution`, `file`). The map import will start from this choice; nothing is imported here.
 */
export async function chooseRealmWikiMap(
  db: Pick<PrismaClient, "realm">,
  actor: RealmActor,
  slug: string,
  fileTitle: string,
  deps: RealmWikiDeps = {}
) {
  const realm = await loadWritableWikiRealm(db, actor, slug);
  const wiki = requireSettings(realm);
  const title = asFileTitle(fileTitle);
  try {
    const client = clientFor(deps, wiki.source);
    const info = (await fetchWikiFileInfo(wiki.source, client.query, [title])).get(title);
    if (!info) throw new RealmWikiError("NOT_FOUND", `${title} was not found on the realm's wiki`);
    const original = await downloadWikiFileOriginal(wiki.source, info, { download: deps.download });
    const map: RealmWikiMap = {
      source: { wiki: wiki.source, fileTitle: info.fileTitle, sha1: original.sha1 },
      attribution: original.attribution,
      file: {
        width: original.width,
        height: original.height,
        size: original.size,
        mime: original.mime,
        licence: original.licence,
        descriptionUrl: original.descriptionUrl,
        chosenAt: new Date().toISOString(),
        chosenBy: actor.clerkUserId,
        checkedAt: null,
      },
    };
    await db.realm.update({ where: { id: realm.id }, data: { settings: withRealmWikiMap(realm.settings, map) } });
    return { success: true, map };
  } catch (error) {
    return wikiFailure(error);
  }
}

/**
 * The chosen map's original bytes for the map import: the file's imageinfo is read again, its SHA-1 must still be
 * the stored one (a changed file is refused, so an import never takes a version nobody chose), and the download is
 * checked as in `chooseRealmWikiMap`. No permission check here: the caller (the import) has done it.
 */
export async function fetchChosenWikiMapOriginal(
  db: Pick<PrismaClient, "realm">,
  realmId: string,
  deps: RealmWikiDeps = {}
): Promise<WikiFileOriginal & { filename: string }> {
  const realm = await db.realm.findUnique({ where: { id: realmId }, select: { settings: true } });
  const stored = realm ? realmWikiMap(realm.settings) : null;
  if (!stored) throw new RealmWikiError("BAD_REQUEST", "The realm has no map chosen from its wiki");
  try {
    const client = clientFor(deps, stored.source.wiki);
    const info = (await fetchWikiFileInfo(stored.source.wiki, client.query, [stored.source.fileTitle])).get(
      stored.source.fileTitle
    );
    if (!info) throw new RealmWikiError("NOT_FOUND", `${stored.source.fileTitle} is no longer on the wiki`);
    if (info.sha1 !== stored.source.sha1)
      throw new RealmWikiError("CONFLICT", "The wiki's file changed since it was chosen; re-check and choose it again");
    const original = await downloadWikiFileOriginal(stored.source.wiki, info, { download: deps.download });
    return { ...original, filename: stored.source.fileTitle.replace(/^File:/, "") };
  } catch (error) {
    return wikiFailure(error);
  }
}

export type MapRecheckStatus = "unchanged" | "changed" | "missing";

/**
 * Compare the chosen map's SHA-1 with the wiki's current one (P2.6 hook; a scheduled re-import comes later). Records
 * when it was checked; never changes the stored choice.
 */
export async function recheckRealmWikiMap(
  db: Pick<PrismaClient, "realm">,
  actor: RealmActor,
  slug: string,
  deps: RealmWikiDeps = {}
) {
  const realm = await loadWritableWikiRealm(db, actor, slug);
  const stored = realmWikiMap(realm.settings);
  if (!stored) throw new RealmWikiError("BAD_REQUEST", "Choose a map from the wiki first");
  let current;
  try {
    const client = clientFor(deps, stored.source.wiki);
    current = (await fetchWikiFileInfo(stored.source.wiki, client.query, [stored.source.fileTitle])).get(
      stored.source.fileTitle
    );
  } catch (error) {
    return wikiFailure(error);
  }
  const status: MapRecheckStatus = !current ? "missing" : current.sha1 === stored.source.sha1 ? "unchanged" : "changed";
  const checkedAt = new Date().toISOString();
  if (stored.file) {
    await db.realm.update({
      where: { id: realm.id },
      data: { settings: withRealmWikiMap(realm.settings, { ...stored, file: { ...stored.file, checkedAt } }) },
    });
  }
  return {
    status,
    changed: status !== "unchanged",
    storedSha1: stored.source.sha1,
    currentSha1: current?.sha1 ?? null,
    current: current
      ? { width: current.width, height: current.height, size: current.size, thumbUrl: current.thumbUrl }
      : null,
    checkedAt,
  };
}

const HINTS_CACHE_TTL_S = 60 * 60;
const hintsCacheKey = (realmId: string) => `realm-wiki-hints:${realmId}`;

export interface NationInfoboxHint {
  title: string;
  hasInfobox: boolean;
  capital: string | null;
  /** [longitude, latitude]. */
  capitalCoordinates: [number, number] | null;
  locatorMap: { fileTitle: string; thumbUrl: string | null } | null;
}

export interface InfoboxHintsExport {
  nations: NationInfoboxHint[];
  /** False when the wiki stopped the read part-way: the nations read so far are listed. */
  complete: boolean;
  blocked: boolean;
  stopped: DiscoveryBlock | null;
}

/**
 * P2.5: per roster nation, its capital's coordinates and a thumbnail of its locator map (through this app's media
 * proxy), for the map import's colour → nation step. A complete answer is cached for an hour.
 */
export async function realmInfoboxHints(
  db: Pick<PrismaClient, "realm">,
  actor: RealmActor,
  slug: string,
  deps: RealmWikiDeps = {}
): Promise<InfoboxHintsExport> {
  const realm = await loadWikiRealm(db, actor, slug);
  const wiki = requireSettings(realm);
  const cached = await globalCache.get<InfoboxHintsExport>(hintsCacheKey(realm.id));
  if (cached) return cached;

  const client = clientFor(deps, wiki.source);
  const roster = await discoverRoster(client, wiki);
  let stopped = roster.stopped;
  const hints: NationHint[] = [];
  for (let i = 0; !stopped && i < roster.data.nations.length; i += HINT_BATCH) {
    const step = await discoverNationHints(client, roster.data.nations.slice(i, i + HINT_BATCH));
    hints.push(...step.data);
    stopped = step.stopped;
  }
  const locators = hints.flatMap((hint) => (hint.mapFiles[0] ? [hint.mapFiles[0]] : []));
  const files = new Map<string, WikiFileInfo>();
  if (!stopped && locators.length > 0) {
    try {
      await fetchWikiFileInfo(wiki.source, client.query, locators, files, 200);
    } catch (error) {
      if (!(error instanceof DiscoveryStopped)) throw error;
      stopped = { ...error.stop, phase: "hints" };
    }
  }
  const result: InfoboxHintsExport = {
    nations: hints.map((hint) => {
      const locator = hint.mapFiles[0] ? asFileTitle(hint.mapFiles[0]) : null;
      return {
        title: hint.title,
        hasInfobox: hint.hasInfobox,
        capital: hint.capital,
        capitalCoordinates: hint.capitalCoordinates,
        locatorMap: locator ? { fileTitle: locator, thumbUrl: files.get(locator)?.thumbUrl ?? null } : null,
      };
    }),
    complete: !stopped,
    blocked: isBlockingStop(stopped),
    stopped,
  };
  if (result.complete) await globalCache.set(hintsCacheKey(realm.id), result, { ttl: HINTS_CACHE_TTL_S });
  return result;
}
