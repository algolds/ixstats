"use client";
// src/components/wiki-os/history/PageHistoryView.tsx
// WikiOS Page History Hub with Scrubbable Timeline. Shared by /util/history/[slug] and the in-place
// `/wiki/<title>?action=history` view of the `/wiki/[...slug]` route.

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { ScrubbableRevisionTimeline } from "~/components/wiki-os/history/ScrubbableRevisionTimeline";
import { withBasePath } from "~/lib/base-path";

/** Revisions one history request asks for; "Older" asks for the next so many. */
const HISTORY_PAGE = 50;

type HistoryPage = RouterOutputs["wikios"]["getHistory"];

/** What "Older" loaded, tagged with the newest revision it was loaded under: a new head voids it. */
interface OlderRevisions extends HistoryPage {
  head: string | undefined;
}

/** `title` is the page's title (spaces, not underscores); `slug` is its URL path segment. */
export function PageHistoryView({ title, slug }: { title: string; slug: string }) {
  const utils = api.useUtils();
  const first = api.wikios.getHistory.useQuery(
    { title, limit: HISTORY_PAGE, includeParked: true }, // the badge needs the parked ones
    { staleTime: 30_000 }
  );
  const [older, setOlder] = useState<OlderRevisions | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);

  // A new newest revision (after a revert, say) shifts the page boundary: what "Older" added no longer follows it
  const head = first.data?.revisions[0]?.revid;
  const loaded = older && older.head === head ? older : null;
  const rawRevisions = [...(first.data?.revisions ?? []), ...(loaded?.revisions ?? [])];
  const hasMore = loaded ? loaded.hasMore : (first.data?.hasMore ?? false);

  const loadOlder = async () => {
    const last = rawRevisions[rawRevisions.length - 1];
    if (!last || loadingOlder) return;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const page = await utils.wikios.getHistory.fetch({
        title,
        limit: HISTORY_PAGE,
        before: last.revid,
        includeParked: true,
      });
      setOlder({
        head,
        revisions: [...(loaded?.revisions ?? []), ...page.revisions],
        hasMore: page.hasMore,
      });
    } catch (error) {
      setOlderError(error instanceof Error ? error.message : "Could not load older revisions.");
    } finally {
      setLoadingOlder(false);
    }
  };

  const mappedRevisions = rawRevisions.map((r) => ({
    id: r.revid,
    articleId: title,
    author: r.user || null, // null: a name revision deletion hid (the timeline says so, and offers no rollback of it)
    summary: r.comment || null,
    minor: r.minor || false,
    byteSize: r.size || 0,
    byteDelta: r.byteDelta,
    parked: r.parked,
    createdAt: r.timestamp || new Date().toISOString(),
  }));
  const isLoading = first.isLoading;

  return (
    <WikiOSLayout title={`History: ${title}`} articleView="history">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        {/* Back Navigation Bar */}
        <div>
          <Link
            href={withBasePath(`/wiki/${slug}`)}
            className="text-label-secondary hover:text-tint text-caption inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {title}
          </Link>
        </div>

        {/* Interactive Scrubbable Timeline */}
        {first.error ? (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/10 flex flex-col items-center gap-3 rounded-2xl border p-8 text-center"
          >
            <p className="text-destructive text-sm font-medium">
              The history of {title} could not be loaded: {first.error.message}
            </p>
            <button
              type="button"
              onClick={() => void first.refetch()}
              className="border-border/50 bg-secondary/60 text-foreground hover:bg-secondary rounded-xl border px-4 py-2 text-xs font-semibold"
            >
              Try again
            </button>
          </div>
        ) : (
          <ScrubbableRevisionTimeline
            title={title}
            revisions={mappedRevisions}
            isLoading={isLoading}
          />
        )}

        {hasMore && (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="border-border/50 bg-secondary/60 text-foreground hover:bg-secondary rounded-xl border px-4 py-2 text-xs font-semibold disabled:opacity-60"
            >
              {loadingOlder ? "Loading…" : `Older ${HISTORY_PAGE}`}
            </button>
            {olderError && (
              <p role="alert" className="text-xs font-medium text-red-400">
                {olderError}
              </p>
            )}
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}
