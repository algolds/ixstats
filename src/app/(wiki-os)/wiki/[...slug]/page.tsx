// src/app/(wiki-os)/wiki/[...slug]/page.tsx
// Server entry for every /wiki/<path> URL: articles (subpages included), MediaWiki's URL forms
// (?action=, ?oldid=, ?diff=, ?redirect=no, Special:<Name>) and the old WikiOS tool slugs. The
// title is decoded and canonicalised here, the article is read here (so it is in the first HTML,
// and a missing page is a 404), and the client reader takes over from the hydrated cache.

import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import {
  canonicalPathRedirect,
  resolveWikiPath,
  type ArticleTarget,
  type LegacyTarget,
  type SearchParamsLike,
} from "~/lib/wiki-os/wiki-path";
import ArticlePageClient from "./ArticlePageClient";
import { articleTargetMetadata } from "./_lib/metadata";
import { redirectUnlessArticle } from "./_views/legacy-view";
import { diffView, historyView, infoView, revisionView } from "./_views/meta-views";
import { editView, readView } from "./_views/read-views";
import { specialView } from "./_views/special-views";

interface RouteProps {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: RouteProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const target = resolveWikiPath(slug, query);
  if (
    target.kind === "invalid" ||
    (target.kind === "special" && target.action.type === "unknown")
  ) {
    return notFound(); // the page says so too; see articleTargetMetadata
  }
  return target.kind === "article" ? articleTargetMetadata(target, slug, query) : {};
}

/** An IxWiki article in whichever view the query string asks for. */
function ixwikiArticle(
  target: ArticleTarget,
  segments: readonly string[],
  query: SearchParamsLike
) {
  const { canon, view } = target;
  const canonicalHref = canonicalPathRedirect(segments, canon, query);
  if (canonicalHref) permanentRedirect(canonicalHref);

  switch (view.type) {
    case "edit":
      return editView(canon, view);
    case "history":
      return historyView(canon);
    case "info":
      return infoView(canon);
    case "revision":
      return revisionView(canon, view.ref);
    case "diff":
      return diffView(canon, view);
    case "read":
      return readView(canon, view, query);
  }
}

function articleOf(target: ArticleTarget, segments: readonly string[], query: SearchParamsLike) {
  if (target.source !== "ixwiki") {
    // Another wiki's page is read-only and client-rendered, exactly as before.
    return <ArticlePageClient title={target.canon.title} wikiSource={target.source} />;
  }
  return ixwikiArticle(target, segments, query);
}

/** An old tool slug or `/edit` / `/talk` path: redirect, unless a page of that title exists. */
async function legacyOf(
  target: LegacyTarget,
  segments: readonly string[],
  query: SearchParamsLike
) {
  await redirectUnlessArticle(target);
  const view = { type: "read", followRedirect: true, redirectedFrom: null } as const;
  return articleOf(
    { kind: "article", source: "ixwiki", canon: target.canon, view },
    segments,
    query
  );
}

export default async function WikiPage({ params, searchParams }: RouteProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const target = resolveWikiPath(slug, query);

  switch (target.kind) {
    case "invalid":
      return notFound();
    case "special":
      return specialView(target);
    case "raw": {
      // Normally the proxy answers this URL itself; this takes the same contract: `path` and `action`.
      const oldid = target.ref ? `&oldid=${encodeURIComponent(target.ref)}` : "";
      return redirect(
        `/api/wiki/raw?path=${encodeURIComponent(target.canon.urlPath)}&action=raw${oldid}`
      );
    }
    case "tool-redirect":
    case "legacy-redirect":
      return legacyOf(target, slug, query);
    case "article":
      return articleOf(target, slug, query);
  }
}
