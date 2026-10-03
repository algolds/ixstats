"use client";
// WikiOS Page History Hub with Scrubbable Timeline

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "iconoir-react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { ScrubbableRevisionTimeline } from "~/components/wiki-os/history/ScrubbableRevisionTimeline";
import { withBasePath } from "~/lib/base-path";

export default function HistoryPage() {
  const params = useParams<{ slug: string }>();
  const rawSlug = params.slug ? decodeURIComponent(params.slug) : "";
  const title = rawSlug.replace(/_/g, " ");

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
            href={withBasePath(`/wiki/${encodeURIComponent(rawSlug)}`)}
            className="text-label-secondary hover:text-tint text-caption inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {title}
          </Link>
        </div>

        {/* Interactive Scrubbable Timeline */}
        <ScrubbableRevisionTimeline
          title={title}
          revisions={mappedRevisions}
          isLoading={isLoading}
        />
      </div>
    </WikiOSLayout>
  );
}
