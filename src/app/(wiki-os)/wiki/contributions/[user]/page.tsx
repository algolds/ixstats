// src/app/(wiki-os)/wiki/contributions/[user]/page.tsx
// WikiOS User Contributions — shows edit history for a specific user
"use client";

import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";

export default function ContributionsPage() {
  const params = useParams<{ user: string }>();
  const user = decodeURIComponent(params.user);

  const { data, isLoading } = api.wikios.getUserContribs.useQuery(
    { user, limit: 50 },
    { staleTime: 30_000 }
  );

  const contribs = data?.contribs ?? [];

  return (
    <WikiOSLayout title={`Contributions: ${user}`}>
      <div className="wikios-special-page">
        {isLoading && (
          <div className="wikios-loading" style={{ minHeight: 200 }}>
            <div className="wikios-loading-spinner" />
          </div>
        )}

        {contribs.length > 0 && (
          <ul className="wikios-contrib-list">
            {contribs.map((c) => (
              <li key={c.revid} className="wikios-contrib-item">
                <span className="wikios-contrib-badges">
                  {c.isNew && <span className="wikios-rc-badge wikios-rc-badge--new">N</span>}
                  {c.minor && <span className="wikios-rc-badge">m</span>}
                </span>

                <Link
                  href={withBasePath(`/wiki/${encodeURIComponent(c.title.replace(/ /g, "_"))}`)}
                  className="wikios-rc-title"
                >
                  {c.title}
                </Link>

                <span className="wikios-rc-meta">
                  <span className="wikios-rc-time">
                    {new Date(c.timestamp).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="wikios-contrib-size">{c.size.toLocaleString()}b</span>
                  {c.comment && <span className="wikios-rc-comment">({c.comment})</span>}
                </span>
              </li>
            ))}
          </ul>
        )}

        {!isLoading && contribs.length === 0 && (
          <p className="text-zinc-400">No contributions found for &ldquo;{user}&rdquo;.</p>
        )}
      </div>
    </WikiOSLayout>
  );
}
