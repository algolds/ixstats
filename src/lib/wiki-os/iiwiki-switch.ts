/**
 * The IIWiki switch (admin panel /admin/iiwiki): one master switch for every request the app makes to IIWiki, and one
 * switch per feature. Every outbound IIWiki call names its feature and checks here first, at the one gate it passes
 * (`upstreamGuard.fetch`, or `assertIiwikiAllowed` where a call cannot go through the guard: file bytes, `action=raw`,
 * the media proxy). A refused call throws `WikiUnavailableError` with reason `disabled`, which every caller already
 * treats as an outage, so turning a feature off degrades exactly like IIWiki being down, with no request sent.
 *
 * Stored as one JSON row in `SystemConfig` (`IIWIKI_SWITCH_KEY`). With no row everything is on. Read at most once per
 * TTL per process, like the WikiOS editing switch: a flip reaches the app and the cron runner within the TTL, and the
 * process that flipped it at once.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "~/server/db";

export const IIWIKI_SWITCH_KEY = "iiwiki_switch";
const TTL_MS = 15_000;

/** What each outbound IIWiki call is for; the panel shows one switch per entry. */
export const IIWIKI_FEATURES = {
  reader: "Reader pages (?source=iiwiki): wikitext, renders and authors",
  embeds: "{{Sister}} embeds, hover previews and link previews",
  country: "Country and map data (intros, rich intros, sections, infoboxes, builder import)",
  media: "Images and files (media proxy, flags, OG images, image downloads)",
  search: "Search and the image repository (titles, files, categories)",
  proxy: "Public api.php proxy (/api/mediawiki/iiwiki/api.php)",
  cards: "Lore cards (imports, discovery, excerpts, authors)",
  realms: "Realm tools (wiki discovery, map import, flag localisation, source sync)",
  identity: "Account proof (IxnayID wiki verification, page-creator checks)",
} as const;

export type IiwikiFeature = keyof typeof IIWIKI_FEATURES;
export const IIWIKI_FEATURE_IDS = Object.keys(IIWIKI_FEATURES) as IiwikiFeature[];

export interface IiwikiSwitchState {
  enabled: boolean;
  features: Record<IiwikiFeature, boolean>;
}

export const IIWIKI_SWITCH_DEFAULT: IiwikiSwitchState = {
  enabled: true,
  features: Object.fromEntries(IIWIKI_FEATURE_IDS.map((id) => [id, true])) as Record<
    IiwikiFeature,
    boolean
  >,
};

const isRecord = (value: object | null): value is Record<string, boolean | object> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** The stored row's state; a missing, malformed or partial row falls back to on for whatever it does not say. */
export function parseIiwikiSwitch(raw: string | null | undefined): IiwikiSwitchState {
  if (!raw) return IIWIKI_SWITCH_DEFAULT;
  let parsed: object | null;
  try {
    parsed = JSON.parse(raw) as object | null;
  } catch {
    return IIWIKI_SWITCH_DEFAULT;
  }
  if (!isRecord(parsed)) return IIWIKI_SWITCH_DEFAULT;
  const stored = isRecord((parsed.features as object | null) ?? null)
    ? (parsed.features as Record<string, boolean | object>)
    : {};
  const features = { ...IIWIKI_SWITCH_DEFAULT.features };
  for (const id of IIWIKI_FEATURE_IDS) {
    if (typeof stored[id] === "boolean") features[id] = stored[id];
  }
  return { enabled: parsed.enabled !== false, features };
}

/** Whether a call for `feature` may go out under `state`; a call with no feature answers to the master switch alone. */
export function iiwikiStateAllows(state: IiwikiSwitchState, feature?: IiwikiFeature): boolean {
  return state.enabled && (feature === undefined || state.features[feature]);
}

let cached: IiwikiSwitchState = IIWIKI_SWITCH_DEFAULT;
let loadedAt = 0;
let inFlight: Promise<IiwikiSwitchState> | null = null;

const stale = () => Date.now() - loadedAt > TTL_MS;

async function load(): Promise<IiwikiSwitchState> {
  try {
    const row = await db.systemConfig.findUnique({
      where: { key: IIWIKI_SWITCH_KEY },
      select: { value: true },
    });
    cached = parseIiwikiSwitch(row?.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[iiwiki] could not read the IIWiki switch; keeping the last value:", message);
  }
  return cached;
}

export function refreshIiwikiSwitch(force = false): Promise<IiwikiSwitchState> {
  if (!force && !stale()) return Promise.resolve(cached);
  inFlight ??= load().finally(() => {
    loadedAt = Date.now();
    inFlight = null;
  });
  return inFlight;
}

/** The switch as last read; a stale cache starts a background refresh and answers with the last value meanwhile. */
export function iiwikiSwitchState(): IiwikiSwitchState {
  if (stale()) void refreshIiwikiSwitch();
  return cached;
}

export function iiwikiAllows(feature?: IiwikiFeature): boolean {
  return iiwikiStateAllows(iiwikiSwitchState(), feature);
}

/**
 * The feature of the work running now. A tRPC procedure that reaches IIWiki declares it once
 * (`iiwikiFeatureMiddleware`), so the bridge reads deep under it are checked against that feature without each call
 * naming it; a call that names its own feature wins.
 */
const featureContext = new AsyncLocalStorage<IiwikiFeature>();

export function withIiwikiFeature<T>(feature: IiwikiFeature, work: () => T): T {
  return featureContext.run(feature, work);
}

export function currentIiwikiFeature(): IiwikiFeature | undefined {
  return featureContext.getStore();
}

/** What a refused IIWiki call tells the reader (the same words as `WikiUnavailableError`'s `disabled`). */
export const IIWIKI_DISABLED_MESSAGE = "IIWiki is switched off for now.";

/** For code that knows its wiki by id rather than by URL: false only when `source` is IIWiki and `feature` is off. */
export function iiwikiSourceAllowed(source: string, feature: IiwikiFeature): boolean {
  return source !== "iiwiki" || iiwikiAllows(feature);
}

export async function setIiwikiSwitch(state: IiwikiSwitchState): Promise<IiwikiSwitchState> {
  const value = JSON.stringify(state);
  await db.systemConfig.upsert({
    where: { key: IIWIKI_SWITCH_KEY },
    create: { key: IIWIKI_SWITCH_KEY, value },
    update: { value },
  });
  cached = state;
  loadedAt = Date.now();
  return cached;
}

export function __resetIiwikiSwitchCacheForTests(): void {
  cached = IIWIKI_SWITCH_DEFAULT;
  loadedAt = 0;
  inFlight = null;
}
