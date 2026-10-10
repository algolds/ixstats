"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { ArticleRenderer } from "~/components/wiki-os/reader/ArticleRenderer";
import { ArticleBusy } from "~/components/wiki-os/reader/ArticleBusy";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { articleHref } from "~/lib/wiki-os/wiki-path";

/** An old revision is final: its rendering never changes, so the query is never refetched. */
const REVISION_STALE_TIME_MS = Infinity;

/**
 * `?oldid=<ref>`: one old revision of a page, rendered by the same reader as the current text,
 * under MediaWiki's notice. The route primed the query, so the revision is in the first HTML.
 */
export function RevisionView({ revisionRef, title }: { revisionRef: string; title: string }) {
  const { data, error, refetch } = api.wikios.getRevisionHtml.useQuery(
    { ref: revisionRef },
    { staleTime: REVISION_STALE_TIME_MS, retry: false }
  );
  const canon = canonicalizeTitle(title);
  const current = canon ? articleHref(canon) : "#";
  const diff = canon ? articleHref(canon, { diff: "prev", oldid: revisionRef }) : "#";

  return (
    <WikiOSLayout>
      <div className="wikios-article-container min-h-[500px]">
        <p
          role="note"
          className="border-border/40 bg-card/60 text-muted-foreground mb-4 rounded-xl border px-4 py-2 text-xs"
        >
          This is an old revision of this page
          {data ? `, as it was on ${new Date(data.timestamp).toUTCString()}` : ""}. It may differ
          significantly from the{" "}
          <Link href={current} className="hover:text-wiki underline underline-offset-2">
            current revision
          </Link>{" "}
          (
          <Link href={diff} className="hover:text-wiki underline underline-offset-2">
            diff
          </Link>
          ).
        </p>
        {error?.data?.code === "TOO_MANY_REQUESTS" && (
          <ArticleBusy title={title} onRetry={() => void refetch()} />
        )}
        {error && error.data?.code !== "TOO_MANY_REQUESTS" && (
          <p className="text-red text-sm">{error.message}</p>
        )}
        {data && (
          <ArticleRenderer
            title={title}
            contentHtml={data.contentHtml}
            infoboxHtml={data.infoboxHtml}
            noticesHtml={data.noticesHtml}
            toc={data.toc}
            categories={[]}
            lastModified={data.timestamp}
            wikiSource="ixwiki"
            authorInfo={null}
          />
        )}
      </div>
    </WikiOSLayout>
  );
}
