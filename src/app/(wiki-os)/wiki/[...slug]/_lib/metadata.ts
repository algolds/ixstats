import "server-only";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWikiBaseUrl } from "~/lib/wiki-os/config";
import { articleSeo } from "~/lib/wiki-os/article-seo";
import { canonicalizeTitle, type CanonicalTitle } from "~/lib/wiki-os/core/title";
import {
  canonicalPathRedirect,
  type ArticleTarget,
  type SearchParamsLike,
} from "~/lib/wiki-os/wiki-path";
import { loadArticle, type ArticleHtml } from "./load-article";
import { userExists } from "./load-user";

const NO_INDEX = { index: false, follow: false } as const;
const USER_NAMESPACE = 2;
/** Namespaces whose page may have no text and still be worth showing: File and Category pages. */
const NAMESPACES_WITHOUT_TEXT = new Set([6, 14]);

function publicOrigin(): string {
  return getWikiBaseUrl("ixwiki").replace(/\/+$/, "");
}

/** Title, description, canonical URL and link-preview card of an article, from the same data the reader is served. */
function articleMetadata(data: ArticleHtml): Metadata {
  const canon = canonicalizeTitle(data.title);
  const origin = publicOrigin();
  const url = `${origin}/wiki/${canon?.urlPath ?? encodeURIComponent(data.title.replace(/ /g, "_"))}`;
  const { description, image } = articleSeo(data, origin);

  return {
    title: data.title,
    ...(description ? { description } : {}),
    alternates: { canonical: url },
    openGraph: {
      siteName: "WikiOS",
      type: "article",
      url,
      title: data.title,
      ...(description ? { description } : {}),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: data.title,
      ...(description ? { description } : {}),
      ...(image ? { images: [image] } : {}),
    },
  };
}

/**
 * The metadata of `/wiki/<path>`: an article's own title, description, canonical URL and card; edit,
 * history, diff, revision and info views are not indexed and point at the article. The canonical URL
 * stays on classic ixwiki.com (owner, 2026-10-24: WikiOS runs inside IxStates, classic is the public
 * wiki), the Main Page's too. Another wiki's page (`?source=`) is not indexed and claims no canonical
 * URL: its own wiki's copy is the one to index. Tool, special and raw routes redirect, so they have none.
 *
 * A page that does not exist is `notFound()` here as well as in the page, so the decision does not
 * depend on which of the two Next resolves first. The 404, 307 and 308 status lines only survive
 * because no `loading.tsx` sits above the wiki routes (a Suspense boundary there flushes the shell
 * first and every status becomes 200; see the architecture test).
 */
export async function articleTargetMetadata(
  target: ArticleTarget,
  segments: readonly string[],
  query: SearchParamsLike
): Promise<Metadata> {
  const { canon, view, source } = target;
  if (source !== "ixwiki") return { robots: NO_INDEX };

  const canonical = `${publicOrigin()}/wiki/${canon.urlPath}`;
  // The Main Page has its own view and title; it names classic's Main Page so it never duplicates it.
  if (canon.title === "Main Page" && view.type === "read") return { alternates: { canonical } };
  if (view.type !== "read") {
    return { title: canon.title, alternates: { canonical }, robots: NO_INDEX };
  }
  // A URL that is not the canonical spelling redirects before it renders anything.
  if (canonicalPathRedirect(segments, canon, query)) return {};

  const loaded = await loadArticle(canon.title, view.followRedirect);
  if (loaded.status === "found")
    return loaded.data.resolvedFrom ? {} : articleMetadata(loaded.data);
  if (loaded.status === "unavailable") return { alternates: { canonical } };
  if (canon.namespaceId === USER_NAMESPACE) return missingUserMetadata(canon, canonical);
  // A category or file page can be worth showing with no text of its own: the page decides.
  if (NAMESPACES_WITHOUT_TEXT.has(canon.namespaceId)) {
    return { title: canon.title, alternates: { canonical } };
  }
  return notFound();
}

/**
 * A user page with no text: a 404 for a user that does not exist (and for any subpage), and the bare
 * profile card, which is not worth indexing, for one that does.
 */
async function missingUserMetadata(canon: CanonicalTitle, canonical: string): Promise<Metadata> {
  const username = canon.base.split("/")[0] ?? canon.base;
  if (canon.base.includes("/") || (await userExists(username)) === false) notFound();
  return { title: canon.title, alternates: { canonical }, robots: NO_INDEX };
}
