"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Link as LinkIcon, Page as FileText, ArrowRight } from "iconoir-react";
import {
  DashedNotice,
  UtilitySearchShell,
  useSearchTerm,
} from "~/components/wiki-os/utilities/UtilitySearchShell";

const wikiHref = (title: string) =>
  withBasePath(`/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`);

export default function WhatLinksHereHubPage() {
  const searchParams = useSearchParams();
  const search = useSearchTerm(
    searchParams.get("target") || searchParams.get("title") || searchParams.get("page") || ""
  );
  const activeTarget = search.active;
  const hasTarget = activeTarget.trim().length > 0;

  const { data, isLoading, error } = api.wikios.getBacklinks.useQuery(
    { title: activeTarget, limit: 200 },
    { enabled: hasTarget, staleTime: 60_000 }
  );
  const links = data?.links ?? [];

  return (
    <UtilitySearchShell
      accent="yellow"
      crumb="WhatLinksHere"
      title="Backlinks & link graph"
      description="Query inbound links, citations, and incoming relations pointing to any encyclopedic page in $O(1)$ time."
      badge={
        activeTarget
          ? {
              icon: <LinkIcon className="text-yellow h-4 w-4" />,
              primary: activeTarget,
              secondary: `${links.length} inbound links`,
              truncate: true,
            }
          : null
      }
      search={search}
      placeholder="Enter target page title (e.g. Caphiria, History of Urcea, Caphirian dollar)..."
      submitLabel="Inspect"
      isLoading={isLoading}
      error={error}
      errorPrefix="Failed to query backlinks"
    >
      {!isLoading && hasTarget && links.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <LinkIcon className="text-yellow h-4 w-4" />
              <h2 className="text-label text-headline text-subhead">
                Pages linking to &ldquo;{activeTarget}&rdquo; ({links.length})
              </h2>
            </div>

            <Link
              href={wikiHref(activeTarget)}
              className="text-caption text-yellow flex items-center gap-1 font-semibold hover:underline"
            >
              <span>View target article</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {links.map((link: { title: string; ns?: number }) => (
              <Link
                key={link.title}
                href={wikiHref(link.title)}
                className="group rounded-card border-separator bg-surface shadow-card hover:border-yellow/40 hover:bg-surface hover:shadow-card relative flex items-center gap-3 overflow-hidden border p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.98]"
              >
                <div className="rounded-row bg-yellow/10 text-yellow flex h-8 w-8 shrink-0 items-center justify-center transition-transform">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-label text-caption group-hover:text-yellow block truncate font-semibold transition-colors">
                    {link.title}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!isLoading && hasTarget && links.length === 0 && (
        <DashedNotice>No pages currently link to &ldquo;{activeTarget}&rdquo;.</DashedNotice>
      )}

      {!activeTarget && (
        <DashedNotice>
          Enter an article title above to explore all inbound links and citations across the realm.
        </DashedNotice>
      )}
    </UtilitySearchShell>
  );
}
