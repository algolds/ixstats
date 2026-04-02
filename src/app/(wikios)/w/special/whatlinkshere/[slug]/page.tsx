// src/app/(wikios)/w/special/whatlinkshere/[slug]/page.tsx
// WikiOS "What Links Here" — shows pages that link to the given page
"use client";

import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";

export default function WhatLinksHerePage() {
  const params = useParams<{ slug: string }>();
  const title = decodeURIComponent(params.slug).replace(/_/g, " ");

  const { data, isLoading } = api.wikios.getBacklinks.useQuery(
    { title, limit: 100 },
    { staleTime: 60_000 }
  );

  const links = data?.links ?? [];

  return (
    <WikiOSLayout title={`What links here: ${title}`}>
      <div className="wikios-special-page">
        <p className="wikios-backlink-subtitle">
          <Link href={withBasePath(`/w/${encodeURIComponent(title.replace(/ /g, "_"))}`)}>
            &larr; Back to article
          </Link>
        </p>

        {isLoading && (
          <div className="wikios-loading" style={{ minHeight: 200 }}>
            <div className="wikios-loading-spinner" />
          </div>
        )}

        {links.length > 0 && (
          <ul className="wikios-backlinks-list">
            {links.map((link) => (
              <li key={link.title} className="wikios-backlink-item">
                <Link
                  href={withBasePath(`/w/${encodeURIComponent(link.title.replace(/ /g, "_"))}`)}
                >
                  {link.title}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!isLoading && links.length === 0 && (
          <p className="text-zinc-400">No pages link to &ldquo;{title}&rdquo;.</p>
        )}
      </div>
    </WikiOSLayout>
  );
}
