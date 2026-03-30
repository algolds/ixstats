// src/app/(wikios)/wiki-special/recent-changes/page.tsx
// WikiOS Recent Changes — shows latest wiki edits
"use client";

import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { formatMWDate } from "~/lib/wikios/mediawiki-timestamp";

export default function RecentChangesPage() {
  const { data: changes, isLoading } = api.wikios.getRecentChanges.useQuery(
    { limit: 50 },
    { staleTime: 30_000, refetchInterval: 60_000 }
  );

  return (
    <WikiOSLayout title="Recent changes">
      <div className="wikios-special-page">
        {isLoading && (
          <div className="wikios-loading">
            <div className="wikios-loading-spinner" />
          </div>
        )}
        {changes && changes.length > 0 && (
          <ul className="wikios-rc-list">
            {changes.map((change, idx) => (
              <li key={idx} className="wikios-rc-item">
                <span className="wikios-rc-diff">
                  {change.type === "new" ? (
                    <span className="wikios-rc-badge wikios-rc-badge--new">N</span>
                  ) : (
                    <span className="wikios-rc-badge">e</span>
                  )}
                </span>
                <Link
                  href={withBasePath(`/w/${encodeURIComponent((change.title ?? "").replace(/ /g, "_"))}`)}
                  className="wikios-rc-title"
                >
                  {change.title}
                </Link>
                <span className="wikios-rc-meta">
                  <span className="wikios-rc-user">{change.user}</span>
                  <span className="wikios-rc-time">
                    {formatMWDate(change.timestamp)}
                  </span>
                  {change.comment && (
                    <span className="wikios-rc-comment">({change.comment})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {changes && changes.length === 0 && (
          <p className="text-zinc-400">No recent changes found.</p>
        )}
      </div>
    </WikiOSLayout>
  );
}
