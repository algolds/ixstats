"use client";

import "~/styles/wiki-os.css";
import { useRef, type RefObject } from "react";
import Link from "next/link";
import { EditPencil, NavArrowRight, OpenBook, OpenNewWindow } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { useProfileShell } from "~/app/countries/[slug]/_components/ProfileShellContext";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import type { ProfileMediaArticle } from "~/app/countries/[slug]/_utils/profileLayer";
import { useArticleHtml } from "~/hooks/lore/useArticleHtml";
import { useLoreEntry } from "~/hooks/lore/useLoreEntry";
import { useReadingProgress } from "~/hooks/lore/useReadingProgress";
import { groupLorePieces } from "~/lib/lore/lore-groups";
import { readingMinutes } from "~/lib/lore/reading";
import { stripHtml } from "~/lib/utils/sanitize-html";
import { ARTICLE_STYLE_ROOT_CLASS } from "~/lib/utils/scope-template-styles";
import { wikiReaderPath, type WikiSource } from "~/lib/wiki-os/config";
import { pageEditHref } from "~/lib/wiki-os/page-tools";
import { SISTER_WIKI_HOSTS } from "~/lib/wiki-os/wiki-hosts";
import { api } from "~/trpc/react";
import { AddExistingPage } from "./AddExistingPage";
import { LoreContents } from "./LoreContents";
import { LorePieces } from "./LorePieces";
import { LoreWriter } from "./LoreWriter";

function LoreLoading() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading lore">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className={i === 4 ? "h-4 w-1/2" : "h-4 w-full"} />
      ))}
    </div>
  );
}

/** A light stand-in while the pieces are listed, below the article. */
function PiecesLoading() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading lore pieces">
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
    <div
      ref={contentRef}
      // Section jumps land below the shell's top bar (scrollToChapter honours scroll-margin).
      className="wikios-article-body wikios-article-content [&_[id]]:scroll-mt-[calc(var(--shell-top-offset,5rem)+1.5rem)]"
    >
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
    <div role="group" aria-label="Lore actions" className="flex flex-wrap items-center gap-2">
      {article.markup && (
        <>
          <Button asChild variant="ghost" size="sm">
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
 * A thin bar pinned under the shell's top bar while the article is read, filling as the reader scrolls (a transform,
 * 1:1 with the scroll, so it never animates on its own). The negative margin cancels the column's gap, so it takes no
 * room above the masthead.
 */
function ReadingBar({ value }: { value: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className="z-raised bg-fill-4 sticky top-(--shell-header-top) -mb-8 h-[3px] overflow-hidden rounded-full"
    >
      <div className="bg-tint h-full origin-left" style={{ transform: `scaleX(${value})` }} />
    </div>
  );
}

/** The wiki a page is read from, by its display name (IxWiki is "Wiki", owner ruling 2026-10-25). */
function sourceName(source: WikiSource): string {
  return source === "ixwiki" ? "Wiki" : (SISTER_WIKI_HOSTS[source]?.name ?? "Wiki");
}

/**
 * The masthead: the article's title in display type, one quiet line of what it is at a glance (where it is read from,
 * how long it takes, how many sections), and the actions to the side.
 */
function Masthead({
  title,
  meta,
  actions,
}: {
  title: string;
  meta: string[];
  actions: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h2 className="text-large-title text-label text-balance">{title}</h2>
        {meta.length > 0 && (
          <p className="text-callout text-label-secondary mt-1 tabular-nums">{meta.join(" · ")}</p>
        )}
      </div>
      {actions}
    </header>
  );
}

/** Further reading at the end of the article: the country's linked wiki articles, with how long each takes. */
function FurtherReading({ articles }: { articles: readonly ProfileMediaArticle[] }) {
  if (articles.length === 0) return null;
  return (
    <nav
      aria-label="Further reading"
      className="border-separator mt-2 flex flex-col gap-1 border-t pt-6"
    >
      <h3 className="text-headline text-label mb-1">Further reading</h3>
      {articles.map((a) => (
        <Link
          key={a.id}
          href={`/wiki/${encodeURIComponent(a.slug)}`}
          className="hover:bg-fill-4 focus-visible:outline-tint rounded-control -mx-2 flex items-center justify-between gap-3 px-2 py-2 transition-colors focus-visible:outline-2 pointer-coarse:min-h-11"
        >
          <span className="text-body text-label min-w-0 truncate">{stripHtml(a.title)}</span>
          <span className="text-footnote text-label-secondary flex shrink-0 items-center gap-1 tabular-nums">
            {a.readingTime > 0 && `${a.readingTime} min`}
            <NavArrowRight aria-hidden className="text-label-tertiary size-4" />
          </span>
        </Link>
      ))}
    </nav>
  );
}

/**
 * LoreReader — the Lore tab, built for reading: the country's wiki article as WikiOS renders it
 * (`wikios.getArticleHtml`) straight on the document, at a reading measure, under a masthead that says at a glance
 * what it is, its contents inline (sections, then lore pieces by type), further reading at its end and the country's
 * native lore pieces following as chapters (docs/specs/2026-10-24-native-lore-design.md). A thin bar pinned at the
 * top shows how far in the reader is. Nothing moves behind the text.
 */
export function LoreReader({ layer }: { layer: CountryProfileLayer }) {
  const { country } = useProfileShell();
  const source = country.wikiSource ?? "ixwiki";
  const title = country.wikiPageTitle ?? country.name;
  const article = useArticleHtml(title, source);
  const entry = useLoreEntry(layer.countryId);
  const listed = api.countryLore.list.useQuery({ countryId: layer.countryId }, { retry: false });
  const pieces = listed.data ?? [];
  const groups = groupLorePieces(pieces);

  const toc = article.data?.toc ?? [];
  const chapters = toc.filter((t) => t.level <= 2);
  const contentRef = useRef<HTMLDivElement>(null);
  const progress = useReadingProgress(contentRef, Boolean(article.markup));
  const name = layer.identity.name;
  const shown = stripHtml(article.data?.title ?? title);
  const minutes = article.markup ? readingMinutes(article.markup.__html) : 0;

  const meta = article.markup
    ? [
        `From the ${sourceName(source)}`,
        ...(minutes > 0 ? [`${minutes} min read`] : []),
        ...(chapters.length > 1 ? [`${chapters.length} sections`] : []),
      ]
    : [];

  return (
    <div className="flex min-w-0 flex-col gap-8 lg:px-4">
      {article.markup && <ReadingBar value={progress} />}
      <Masthead
        title={shown}
        meta={meta}
        actions={
          <LoreActions
            article={article}
            title={title}
            source={source}
            countryId={layer.countryId}
            entry={entry}
          />
        }
      />

      <LoreContents toc={article.markup ? toc : []} groups={groups} />

      <article aria-label={`${name} on the wiki`} className="min-w-0">
        <ArticleBody article={article} title={title} name={name} contentRef={contentRef} />
      </article>

      <FurtherReading articles={layer.media?.articles.slice(0, 6) ?? []} />

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
      <LoreWriter countryId={layer.countryId} countryName={name} {...entry.writer} />
    </div>
  );
}
