"use client";

import "~/styles/wiki-os.css";
import { useMemo, useRef, type RefObject } from "react";
import Link from "next/link";
import { EditPencil, OpenBook, OpenNewWindow } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { useScrollSpy } from "~/components/wiki-os/reader/useScrollSpy";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { useProfileShell } from "~/app/countries/[slug]/_components/ProfileShellContext";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { useArticleHtml } from "~/hooks/lore/useArticleHtml";
import { useLoreEntry } from "~/hooks/lore/useLoreEntry";
import { groupLorePieces } from "~/lib/lore/lore-groups";
import { ARTICLE_STYLE_ROOT_CLASS } from "~/lib/utils/scope-template-styles";
import { wikiReaderPath, type WikiSource } from "~/lib/wiki-os/config";
import { pageEditHref } from "~/lib/wiki-os/page-tools";
import { api } from "~/trpc/react";
import { AddExistingPage } from "./AddExistingPage";
import { LoreIndex } from "./LoreIndex";
import { LorePieces } from "./LorePieces";
import { LoreWriter } from "./LoreWriter";

function LoreLoading() {
  return (
    <div className="max-w-[44rem] space-y-3" role="status" aria-label="Loading lore">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className={i === 4 ? "h-4 w-1/2" : "h-4 w-full"} />
      ))}
    </div>
  );
}

/** A light stand-in while the pieces are listed, below the article. */
function PiecesLoading() {
  return (
    <div className="max-w-[44rem] space-y-3" role="status" aria-label="Loading lore pieces">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

type Article = ReturnType<typeof useArticleHtml>;

/** The country's wiki article, or what stands in for it: loading, no article yet, or a wiki that did not answer. */
function ArticleBody({
  article,
  title,
  name,
  contentRef,
}: {
  article: Article;
  title: string;
  name: string;
  contentRef: RefObject<HTMLDivElement | null>;
}) {
  if (article.isLoading) return <LoreLoading />;
  if (article.error?.data?.code === "NOT_FOUND") {
    return (
      <EmptyState
        icon={<OpenBook />}
        title="No wiki article yet"
        message={`${name}'s story has not been written on the wiki.`}
        action={
          <Button asChild size="sm">
            <Link href={pageEditHref(title)}>Create page on WikiOS</Link>
          </Button>
        }
      />
    );
  }
  if (!article.markup) {
    return (
      <EmptyState
        icon={<OpenBook />}
        title="The wiki could not be loaded"
        message="The wiki did not answer. Try again in a moment."
      />
    );
  }
  return (
    <div ref={contentRef} className="wikios-article-body wikios-article-content max-w-[44rem]">
      <div className={ARTICLE_STYLE_ROOT_CLASS} dangerouslySetInnerHTML={article.markup} />
    </div>
  );
}

/** The tab's actions: the article's Open in WikiOS and Edit, then Write lore (writers) and Add an existing page (owner). */
function LoreActions({
  article,
  title,
  source,
  countryId,
  entry,
}: {
  article: Article;
  title: string;
  source: WikiSource;
  countryId: string;
  entry: ReturnType<typeof useLoreEntry>;
}) {
  const shown = article.data?.title ?? title;
  if (!article.markup && !entry.canWrite && !entry.isOwner) return null;
  return (
    <div role="group" aria-label="Lore actions" className="flex flex-wrap gap-2">
      {article.markup && (
        <>
          <Button asChild variant="secondary" size="sm">
            <Link href={wikiReaderPath(shown, source)}>
              <OpenNewWindow aria-hidden />
              Open in WikiOS
            </Link>
          </Button>
          {source === "ixwiki" && (
            <Button asChild variant="ghost" size="sm">
              <Link href={pageEditHref(shown)}>
                <EditPencil aria-hidden />
                Edit
              </Link>
            </Button>
          )}
        </>
      )}
      {entry.canWrite && (
        <Button size="sm" onClick={() => entry.write()}>
          <EditPencil aria-hidden />
          Write lore
        </Button>
      )}
      {entry.isOwner && <AddExistingPage countryId={countryId} />}
    </div>
  );
}

/**
 * LoreReader — the Lore tab: the country's wiki article as WikiOS renders it (`wikios.getArticleHtml`, IxWiki's from
 * Postgres), in WikiOS's article styles, then its native lore pieces as chapters grouped by type
 * (docs/superpowers/specs/2026-10-24-native-lore-design.md). WikiOS's contents follow the section being read on wide
 * screens, with the pieces after the article's chapters. The infobox is left out (the Factbook holds the facts), and
 * so are the notices, the margin and the reader's header. Owner and co-authors write and edit pieces in the one lore
 * writer this tab mounts. Neither the article nor the pieces failing blanks the other.
 */
export function LoreReader({ layer }: { layer: CountryProfileLayer }) {
  const { country } = useProfileShell();
  const source = country.wikiSource ?? "ixwiki";
  const title = country.wikiPageTitle ?? country.name;
  const article = useArticleHtml(title, source);
  const entry = useLoreEntry(layer.countryId);
  const listed = api.countryLore.list.useQuery({ countryId: layer.countryId }, { retry: false });
  const pieces = useMemo(() => listed.data ?? [], [listed.data]);
  const groups = useMemo(() => groupLorePieces(pieces), [pieces]);

  const toc = useMemo(() => article.data?.toc ?? [], [article.data?.toc]);
  const { setActiveSectionId } = useWikiContext();
  const tocIds = useMemo(() => toc.map((entry) => entry.id), [toc]);
  useScrollSpy(article.markup ? tocIds : [], setActiveSectionId);
  const contentRef = useRef<HTMLDivElement>(null);
  const name = layer.identity.name;

  return (
    <div className="flex gap-10">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <LoreActions
          article={article}
          title={title}
          source={source}
          countryId={layer.countryId}
          entry={entry}
        />
        <article aria-label={`${name} on the wiki`} className="min-w-0">
          <ArticleBody article={article} title={title} name={name} contentRef={contentRef} />
        </article>
        {listed.isLoading && <PiecesLoading />}
        {listed.isError && (
          <p className="text-callout text-label-secondary">The lore pieces could not be loaded.</p>
        )}
        <LorePieces
          countryId={layer.countryId}
          pieces={pieces}
          canWrite={entry.canWrite}
          isOwner={entry.isOwner}
          onEdit={entry.edit}
        />
      </div>
      <LoreIndex toc={article.markup ? toc : []} groups={groups} contentRef={contentRef} />
      <LoreWriter countryId={layer.countryId} countryName={name} {...entry.writer} />
    </div>
  );
}
