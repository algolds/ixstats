"use client";
// src/components/wiki-os/history/PageHistoryView.tsx
// WikiOS Page History Hub with Scrubbable Timeline. Shared by /util/history/[slug] and the in-place
// `/wiki/<title>?action=history` view of the `/wiki/[...slug]` route.

import Link from "next/link";
import { ArrowLeft } from "iconoir-react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { ScrubbableRevisionTimeline } from "~/components/wiki-os/history/ScrubbableRevisionTimeline";
import { withBasePath } from "~/lib/base-path";

/** `title` is the page's title (spaces, not underscores); `slug` is its URL path segment. */
export function PageHistoryView({ title, slug }: { title: string; slug: string }) {
  const { data, isLoading } = api.wikios.getHistory.useQuery(
    { title, limit: 50 },
    { staleTime: 30_000 }
  );

  const rawRevisions = data?.revisions ?? [];
  const mappedRevisions = rawRevisions.map((r) => ({
    id: r.revid,
    articleId: title,
    author: r.user || "Community Contributor",
    summary: r.comment || null,
    minor: r.minor || false,
    byteSize: r.size || 0,
    byteDelta: r.byteDelta,
    createdAt: r.timestamp || new Date().toISOString(),
  }));

  return (
    <WikiOSLayout title={`History: ${title}`}>
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        {/* Back Navigation Bar */}
        <div>
          <Link
            href={withBasePath(`/wiki/${slug}`)}
            className="text-muted-foreground hover:text-wiki inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {title}
          </Link>
        </div>

        {/* Interactive Scrubbable Timeline */}
        <ScrubbableRevisionTimeline
          title={title}
          slug={slug}
          revisions={mappedRevisions}
          isLoading={isLoading}
        />
      </div>
    </WikiOSLayout>
  );
}
