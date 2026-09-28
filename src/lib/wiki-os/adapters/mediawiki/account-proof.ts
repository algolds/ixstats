/**
 * Wiki account proof — the three MediaWiki reads needed to verify that a user controls a wiki account
 * and to find who created a page. All three wikis are read through their public api.php with the
 * allowlisted IxStats-Builder user agent (iiwiki through the Cloudflare-safe URL).
 */
import { z } from "zod";
import { DEFAULT_MEDIAWIKI_URL, DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
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

const IXWIKI_BASE = DEFAULT_MEDIAWIKI_URL.replace(/\/+$/, "");
const SITE_URLS: Record<ProofSource, string> = {
  ixwiki: IXWIKI_BASE,
  iiwiki: "https://iiwiki.com",
  althistory: "https://althistory.fandom.com",
};

function apiUrl(source: ProofSource): string {
  if (source === "iiwiki") return getFullIiwikiApiUrl();
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

async function apiQuery<T>(source: ProofSource, params: Record<string, string>, schema: z.ZodType<T>): Promise<T> {
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
    users: z.array(z.object({ userid: z.number().optional(), name: z.string(), missing: z.boolean().optional() })),
  }),
});

export async function fetchWikiUser(source: ProofSource, username: string): Promise<{ username: string; userId: number } | null> {
  const data = await apiQuery(source, { list: "users", ususers: normalizeWikiUsername(username) }, UsersSchema);
  const user = data.query.users[0];
  if (!user || user.missing || user.userid === undefined) return null;
  return { username: user.name, userId: user.userid };
}

const RevisionsSchema = z.object({
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

export async function fetchUserPageWikitext(source: ProofSource, username: string): Promise<string | null> {
  const data = await apiQuery(
    source,
    { prop: "revisions", titles: `User:${normalizeWikiUsername(username)}`, rvprop: "content", rvslots: "main" },
    RevisionsSchema
  );
  return data.query.pages[0]?.revisions?.[0]?.slots?.main.content ?? null;
}

/** Author of the page's first revision, normalised; null if the page does not exist. */
export async function fetchPageCreator(source: ProofSource, title: string): Promise<string | null> {
  const data = await apiQuery(
    source,
    { prop: "revisions", titles: title, rvlimit: "1", rvdir: "newer", rvprop: "user" },
    RevisionsSchema
  );
  const creator = data.query.pages[0]?.revisions?.[0]?.user;
  return creator ? normalizeWikiUsername(creator) : null;
}
