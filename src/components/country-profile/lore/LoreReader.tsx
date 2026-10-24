"use client";

import "~/styles/wiki-os.css";
import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { EditPencil, OpenBook, OpenNewWindow } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { StickyToc } from "~/components/wiki-os/reader/StickyToc";
import { useScrollSpy } from "~/components/wiki-os/reader/useScrollSpy";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { useProfileShell } from "~/app/countries/[slug]/_components/ProfileShellContext";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { ARTICLE_STYLE_ROOT_CLASS } from "~/lib/utils/scope-template-styles";
import { articleHtmlInput, wikiReaderPath } from "~/lib/wiki-os/config";
import { isLeanResolvable, parseLeanMarker, resolveLeanHtml } from "~/lib/wiki-os/lean-article";
import { pageEditHref } from "~/lib/wiki-os/page-tools";
import { api } from "~/trpc/react";

/** As long as WikiOS keeps a finished article fresh. */
const ARTICLE_STALE_TIME_MS = 10 * 60 * 1000;

function LoreLoading() {
  return (
    <div className="max-w-[44rem] space-y-3" role="status" aria-label="Loading lore">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className={i === 4 ? "h-4 w-1/2" : "h-4 w-full"} />
      ))}
    </div>
  );
}

/**
 * LoreReader — the Lore tab: the country's wiki article as WikiOS renders it (`wikios.getArticleHtml`, IxWiki's from
 * Postgres), in WikiOS's article styles, with WikiOS's contents following the section being read on wide screens. The
 * infobox is left out (the Factbook holds the facts), and so are the notices, the margin and the reader's header.
 */
export function LoreReader({ layer }: { layer: CountryProfileLayer }) {
  const { country } = useProfileShell();
  const source = country.wikiSource ?? "ixwiki";
  const title = country.wikiPageTitle ?? country.name;
  const { data, isLoading, error, refetch } = api.wikios.getArticleHtml.useQuery(
    articleHtmlInput(title, source),
    { staleTime: ARTICLE_STALE_TIME_MS, retry: false }
  );

  // A lean answer cached by a WikiOS page load is a marker, not HTML: one this page cannot resolve is asked for again.
  const marker = data?.contentHtml;
  const unresolved = parseLeanMarker(marker) !== null && !isLeanResolvable(marker);
  useEffect(() => {
    if (unresolved) void refetch();
  }, [unresolved, refetch]);
  const html = unresolved ? null : resolveLeanHtml(marker);
  const markup = useMemo(() => (html ? { __html: html } : null), [html]);

  const toc = useMemo(() => data?.toc ?? [], [data?.toc]);
  const { setActiveSectionId } = useWikiContext();
  const tocIds = useMemo(() => toc.map((entry) => entry.id), [toc]);
  useScrollSpy(markup ? tocIds : [], setActiveSectionId);
  const contentRef = useRef<HTMLDivElement>(null);

  if (isLoading || unresolved) return <LoreLoading />;

  if (error?.data?.code === "NOT_FOUND") {
    return (
      <EmptyState
        icon={<OpenBook />}
        title="No wiki article yet"
        message={`${layer.identity.name}'s story has not been written on the wiki.`}
        action={
          <Button asChild size="sm">
            <Link href={pageEditHref(title)}>Create page on WikiOS</Link>
          </Button>
        }
      />
    );
  }

  if (!markup) {
    return (
      <EmptyState
        icon={<OpenBook />}
        title="The wiki could not be loaded"
        message="The wiki did not answer. Try again in a moment."
      />
    );
  }

  return (
    <div className="flex gap-10">
      <article aria-label={`${layer.identity.name} on the wiki`} className="min-w-0 flex-1">
        <div className="mb-6 flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={wikiReaderPath(data?.title ?? title, source)}>
              <OpenNewWindow aria-hidden />
              Open in WikiOS
            </Link>
          </Button>
          {source === "ixwiki" && (
            <Button asChild variant="ghost" size="sm">
              <Link href={pageEditHref(data?.title ?? title)}>
                <EditPencil aria-hidden />
                Edit
              </Link>
            </Button>
          )}
        </div>
        <div ref={contentRef} className="wikios-article-body wikios-article-content max-w-[44rem]">
          <div className={ARTICLE_STYLE_ROOT_CLASS} dangerouslySetInnerHTML={markup} />
        </div>
      </article>
      {toc.length > 1 && (
        <aside
          aria-label="Contents"
          className="sticky top-[calc(var(--shell-top-offset,5rem)+1rem)] hidden max-h-[calc(100vh-var(--shell-top-offset,5rem)-2rem)] w-60 shrink-0 self-start overflow-y-auto lg:block"
        >
          <StickyToc entries={toc} contentRef={contentRef} />
        </aside>
      )}
    </div>
  );
}
