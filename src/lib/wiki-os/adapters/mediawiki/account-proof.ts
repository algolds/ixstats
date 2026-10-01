/**
 * Wiki account proof — the three MediaWiki reads needed to verify that a user controls a wiki account
 * and to find who created a page. IxWiki is read through its internal api.php (the private engine's URL),
 * the sister wikis through their public ones, all with the allowlisted IxStats-Builder user agent
 * (iiwiki through the Cloudflare-safe URL). The underlying
 * `wikiQuery` is exported for other read-only wiki queries (the realm lore import).
 */
import { z } from "zod";
import { DEFAULT_USER_AGENT, getMediaWikiApiUrl, mediaWikiOrigin } from "~/lib/wiki-os/config";
import { getFullIiwikiApiUrl } from "~/lib/wiki-os/adapters/mediawiki/bridge/http-reader";

export const PROOF_SOURCES = ["ixwiki", "iiwiki", "althistory"] as const;
export type ProofSource = (typeof PROOF_SOURCES)[number];

export function isProofSource(source: string): source is ProofSource {
  return (PROOF_SOURCES as readonly string[]).includes(source);
}

export class WikiApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WikiApiError";
  }
}

const SITE_URLS: Record<ProofSource, string> = {
  ixwiki: mediaWikiOrigin(),
  iiwiki: "https://iiwiki.com",
  althistory: "https://althistory.fandom.com",
};

function apiUrl(source: ProofSource): string {
  if (source === "iiwiki") return getFullIiwikiApiUrl();
  if (source === "ixwiki") return getMediaWikiApiUrl("ixwiki");
  return `${SITE_URLS[source]}/api.php`;
}

/** MediaWiki title rules for user names: underscores are spaces, first letter upper-case. */
export function normalizeWikiUsername(name: string): string {
  const spaced = name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function wikiUserPageUrl(source: ProofSource, username: string): string {
  const title = `User:${normalizeWikiUsername(username)}`.replace(/ /g, "_");
  return `${SITE_URLS[source]}/wiki/${encodeURI(title)}`;
}

/** One api.php `action=query` read (formatversion 2) with the allowlisted UA, parsed by `schema`; throws WikiApiError. */
export async function wikiQuery<T>(source: ProofSource, params: Record<string, string>, schema: z.ZodType<T>): Promise<T> {
  const url = new URL(apiUrl(source));
  for (const [key, value] of Object.entries({ action: "query", format: "json", formatversion: "2", ...params })) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url, {
    headers: { "User-Agent": DEFAULT_USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("json")) {
    throw new WikiApiError(`${source} did not answer (HTTP ${res.status}); try again later`);
  }
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new WikiApiError(`${source} returned an unexpected response`);
  return parsed.data;
}

const UsersSchema = z.object({
  query: z.object({
    users: z.array(
      z.object({
        userid: z.number().optional(),
        name: z.string(),
        missing: z.boolean().optional(),
        editcount: z.number().optional(),
        registration: z.string().nullable().optional(),
      })
    ),
  }),
});

export interface WikiUser {
  username: string;
  userId: number;
  /** When the account registered; null when the wiki does not say (accounts from before registration dates were kept). */
  registration: Date | null;
  editCount: number | null;
}

export async function fetchWikiUser(source: ProofSource, username: string): Promise<WikiUser | null> {
  const data = await wikiQuery(
    source,
    { list: "users", ususers: normalizeWikiUsername(username), usprop: "editcount|registration" },
    UsersSchema
  );
  const user = data.query.users[0];
  if (!user || user.missing || user.userid === undefined) return null;
  const registration = user.registration ? new Date(user.registration) : null;
  return {
    username: user.name,
    userId: user.userid,
    registration: registration && !Number.isNaN(registration.getTime()) ? registration : null,
    editCount: user.editcount ?? null,
  };
}

const RevisionsSchema = z.object({
  /** Present when more revisions exist beyond the ones returned. */
  continue: z.object({ rvcontinue: z.string().optional() }).optional(),
  query: z.object({
    pages: z.array(
      z.object({
        missing: z.boolean().optional(),
        revisions: z
          .array(
            z.object({
              user: z.string().optional(),
              slots: z.object({ main: z.object({ content: z.string().optional() }) }).optional(),
            })
          )
          .optional(),
      })
    ),
  }),
});

/** How many user page revisions saved since a code was issued the proof reads; more is a truncated window (F-6). */
export const USER_PAGE_REVISION_WINDOW = 20;

export interface UserPageRevision {
  /** null when the revision's content is hidden (revision-deleted). */
  content: string | null;
  /** Normalised; null when the author is hidden. */
  author: string | null;
}

/** A user page's revisions saved since a time, oldest first; `complete` when the window is not truncated. */
export interface UserPageHistory {
  revisions: UserPageRevision[];
  complete: boolean;
}

/** MediaWiki timestamp (ISO 8601, whole seconds). */
const wikiTimestamp = (at: Date) => at.toISOString().replace(/\.\d{3}Z$/, "Z");

/**
 * The revisions of a user page saved since `since` (oldest first, up to USER_PAGE_REVISION_WINDOW) — content AND
 * author. Stock MediaWiki lets anyone (often anonymous) edit another user's `User:` page, so the token alone does
 * not prove control of the account; the caller must attribute the token's first appearance. A missing page has
 * no revisions.
 */
export async function fetchUserPageHistory(
  source: ProofSource,
  username: string,
  since: Date
): Promise<UserPageHistory> {
  const data = await wikiQuery(
    source,
    {
      prop: "revisions",
      titles: `User:${normalizeWikiUsername(username)}`,
      rvprop: "content|user",
      rvslots: "main",
      rvdir: "newer",
      rvstart: wikiTimestamp(since),
      rvlimit: String(USER_PAGE_REVISION_WINDOW),
    },
    RevisionsSchema
  );
  const revisions = (data.query.pages[0]?.revisions ?? []).map((revision) => ({
    content: revision.slots?.main.content ?? null,
    author: revision.user ? normalizeWikiUsername(revision.user) : null,
  }));
  return { revisions, complete: !data.continue };
}

/** Author of the page's first revision, normalised; null if the page does not exist. */
export async function fetchPageCreator(source: ProofSource, title: string): Promise<string | null> {
  const data = await wikiQuery(
    source,
    { prop: "revisions", titles: title, rvlimit: "1", rvdir: "newer", rvprop: "user" },
    RevisionsSchema
  );
  const creator = data.query.pages[0]?.revisions?.[0]?.user;
  return creator ? normalizeWikiUsername(creator) : null;
}
