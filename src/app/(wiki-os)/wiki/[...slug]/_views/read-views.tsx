import "server-only";

import { notFound, permanentRedirect } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { CategoryMembers } from "~/components/wiki-os/reader/CategoryMembers";
import { FileDetails } from "~/components/wiki-os/reader/FileDetails";
import { FileImage } from "~/components/wiki-os/reader/FileImage";
import { UserProfileCard } from "~/components/wiki-os/reader/UserProfileCard";
import { canonicalizeTitle, type CanonicalTitle } from "~/lib/wiki-os/core/title";
import {
  queryParam,
  queryStringOf,
  type ReadView,
  type SearchParamsLike,
} from "~/lib/wiki-os/wiki-path";
import { HydrateClient, api } from "~/trpc/server";
import ArticlePageClient from "../ArticlePageClient";
import { leanTheFlight } from "../_lib/lean-flight";
import { loadArticle, type ArticleHtml } from "../_lib/load-article";
import { userExists } from "../_lib/load-user";
import { orNotFound } from "../_lib/or-not-found";
import { prefetchHeroCard } from "../_lib/prefetch-hero";

const MAIN_PAGE = "Main Page";
const USER_NAMESPACE = 2;
const FILE_NAMESPACE = 6;
const CATEGORY_NAMESPACE = 14;

type Found = { status: "found"; data: ArticleHtml };

/** Where a redirect page sends its reader: the target, with `?rdfrom=` and the target's section. */
function redirectHref(data: ArticleHtml, query: SearchParamsLike): string {
  const target = canonicalizeTitle(data.title);
  const search = queryStringOf(query, ["redirect", "rdfrom"]);
  const params = new URLSearchParams(search);
  if (data.resolvedFrom) params.set("rdfrom", data.resolvedFrom);
  const section = data.redirectFragment
    ? `#${encodeURIComponent(data.redirectFragment.replace(/ /g, "_"))}`
    : "";
  const path = target
    ? `/wiki/${target.urlPath}`
    : `/wiki/${encodeURIComponent(data.title.replace(/ /g, "_"))}`;
  return `${path}?${params.toString()}${section}`;
}

interface Extras {
  /** Shown above the article. */
  aside?: ReactNode;
  /** Shown below the article. */
  children?: ReactNode;
}

/**
 * The client reader for an article the route has already read: its data is in the hydrated query
 * cache, so the article is in the first HTML and the client does not fetch it again. A redirect page
 * sends its reader to the target instead (308).
 */
async function articleReader(
  canon: CanonicalTitle,
  view: ReadView,
  query: SearchParamsLike,
  found: Found | null,
  { aside, children }: Extras = {}
): Promise<ReactElement> {
  if (found?.data.resolvedFrom) permanentRedirect(redirectHref(found.data, query));
  if (found) {
    await prefetchHeroCard(found.data.title);
    await leanTheFlight(canon.title, view.followRedirect, found.data);
  }
  return (
    <HydrateClient>
      <ArticlePageClient
        key={`${canon.title}|${view.followRedirect}`}
        title={canon.title}
        wikiSource="ixwiki"
        followRedirect={view.followRedirect}
        redirectedFrom={view.redirectedFrom}
        aside={aside}
      >
        {children}
      </ArticlePageClient>
    </HydrateClient>
  );
}

async function standardView(canon: CanonicalTitle, view: ReadView, query: SearchParamsLike) {
  const loaded = await loadArticle(canon.title, view.followRedirect);
  if (loaded.status === "missing") notFound();
  return articleReader(canon, view, query, loaded.status === "found" ? loaded : null);
}

/**
 * `User:<name>`: the page's own text, with the profile card. A user with no page still gets the card,
 * as long as the user exists: like MediaWiki, a page for someone who does not exist is a 404.
 */
async function userView(canon: CanonicalTitle, view: ReadView, query: SearchParamsLike) {
  const username = canon.base.split("/")[0] ?? canon.base;
  const loaded = await loadArticle(canon.title, view.followRedirect);
  if (loaded.status === "missing") {
    if (canon.base.includes("/") || (await userExists(username)) === false) notFound();
    return (
      <WikiOSLayout title={canon.title}>
        <UserProfileCard username={username} pageExists={false} />
      </WikiOSLayout>
    );
  }
  const card = <UserProfileCard username={username} pageExists />;
  return articleReader(canon, view, query, loaded.status === "found" ? loaded : null, {
    aside: card,
  });
}

/** `Category:<name>`: the page's prose (if it has any), then its members, 200 to a page. */
async function categoryView(canon: CanonicalTitle, view: ReadView, query: SearchParamsLike) {
  const from = queryParam(query, "from") ?? "";
  const after = queryParam(query, "after") ?? "";
  const [loaded, page] = await Promise.all([
    loadArticle(canon.title, view.followRedirect),
    orNotFound(api.wikios.getCategoryPage({ category: canon.base, from, after })),
  ]);
  const members = (
    <CategoryMembers
      title={canon.title}
      members={page.members}
      total={page.total}
      from={from}
      next={page.next}
    />
  );

  if (loaded.status === "missing") {
    if (page.total === 0) notFound();
    return <WikiOSLayout title={canon.title}>{members}</WikiOSLayout>;
  }
  return articleReader(canon, view, query, loaded.status === "found" ? loaded : null, {
    children: members,
  });
}

/**
 * `File:<name>`: the file, then the description page's text, then the file's upload history and the pages that use it; a
 * file with no description page shows the file alone (with its history and usage).
 */
async function fileView(canon: CanonicalTitle, view: ReadView, query: SearchParamsLike) {
  const [loaded, file, details] = await Promise.all([
    loadArticle(canon.title, view.followRedirect),
    orNotFound(api.wikios.getFileInfo({ file: canon.base })),
    orNotFound(api.wikios.getFileDetails({ file: canon.base })),
  ]);
  const image = file ? <FileImage file={file} /> : undefined;
  const below = details ? <FileDetails details={details} /> : undefined;

  if (loaded.status === "missing") {
    if (!file) notFound();
    return (
      <WikiOSLayout title={canon.title}>
        {image}
        <p className="text-muted-foreground text-sm">This file has no description page yet.</p>
        {below}
      </WikiOSLayout>
    );
  }
  return articleReader(canon, view, query, loaded.status === "found" ? loaded : null, {
    aside: image,
    children: below,
  });
}

/**
 * The Main Page: its data (featured article, almanac, recent changes, counts, prompt) is read here in
 * one query, so the page is in the first HTML and the client does not fetch it again. The read never
 * fails the page: what it could not get, the client asks for.
 */
async function mainPageView() {
  await api.wikios.getMainPage.prefetch();
  return (
    <HydrateClient>
      <ArticlePageClient title={MAIN_PAGE} wikiSource="ixwiki" />
    </HydrateClient>
  );
}

/**
 * The read view of an IxWiki page: the Main Page, a `Category:`, `User:` or `File:` page, or an
 * ordinary article. A page that does not exist is a 404 (a category, user or file page that has
 * members, a profile or a file to show is not missing).
 */
export function readView(canon: CanonicalTitle, view: ReadView, query: SearchParamsLike) {
  if (canon.title === MAIN_PAGE) return mainPageView();
  switch (canon.namespaceId) {
    case CATEGORY_NAMESPACE:
      return categoryView(canon, view, query);
    case USER_NAMESPACE:
      return userView(canon, view, query);
    case FILE_NAMESPACE:
      return fileView(canon, view, query);
    default:
      return standardView(canon, view, query);
  }
}

/** The editor, open on load (`?action=edit`): no article is read, a page that does not exist is created. */
export function editView(
  canon: CanonicalTitle,
  edit: { mode: "source" | "visual"; section: string | null }
) {
  return (
    <ArticlePageClient
      key={`edit|${canon.title}`}
      title={canon.title}
      wikiSource="ixwiki"
      initialEdit={edit}
    />
  );
}
