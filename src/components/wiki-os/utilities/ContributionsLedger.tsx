"use client";

import Link from "next/link";
import { User as UserIcon, Clock, GitCommit } from "iconoir-react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { DashedNotice, UtilitySearchShell, useSearchTerm } from "./UtilitySearchShell";

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Special:Contributions search + revision ledger, shared by the hub and the per-user page. */
export function ContributionsLedger({
  initialUser,
  title,
  showEmptyPrompt,
}: {
  initialUser: string;
  title: (activeUser: string) => string;
  /** Hub only: prompt for a username while none is active. */
  showEmptyPrompt?: boolean;
}) {
  const search = useSearchTerm(initialUser);
  const activeUser = search.active;
  const hasUser = activeUser.trim().length > 0;

  const { data, isLoading, error } = api.wikios.getUserContribs.useQuery(
    { user: activeUser, limit: 50 },
    { enabled: hasUser, staleTime: 30_000 }
  );
  const contribs = data?.contribs ?? [];

  return (
    <UtilitySearchShell
      accent="green"
      crumb="Contributions"
      title={title(activeUser)}
      description="Audit article revisions, new creations, byte diffs, and edit summaries by editor identity."
      badge={
        activeUser
          ? {
              icon: <UserIcon className="text-green h-4 w-4" />,
              primary: activeUser,
              secondary: `${contribs.length} recorded edits`,
            }
          : null
      }
      search={search}
      placeholder="Enter editor username (e.g. Admin, LoreKeeper, your handle)..."
      submitLabel="Lookup"
      isLoading={isLoading}
      error={error}
      errorPrefix="Failed to load contributions"
    >
      {!isLoading && hasUser && contribs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Clock className="text-green h-4 w-4" />
            <h2 className="text-label text-headline text-subhead">
              Revision History for {activeUser} ({contribs.length})
            </h2>
          </div>

          <div className="space-y-2">
            {contribs.map((c) => (
              <div
                key={c.revid}
                className="group rounded-card border-separator bg-surface shadow-card hover:border-green/40 hover:bg-surface relative flex flex-col justify-between gap-3 border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                  <div className="flex shrink-0 items-center gap-1">
                    {c.isNew && (
                      <span className="rounded-control-sm border-green/20 bg-green/15 text-caption text-green border px-2 py-0.5 font-semibold">
                        NEW
                      </span>
                    )}
                    {c.minor && (
                      <span className="rounded-control-sm border-tint/20 bg-tint/15 text-caption text-tint border px-2 py-0.5 font-semibold">
                        m
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={withBasePath(`/wiki/${encodeURIComponent(c.title.replace(/ /g, "_"))}`)}
                      className="text-label text-caption hover:text-green block truncate font-semibold transition-colors"
                    >
                      {c.title}
                    </Link>
                    {c.comment && (
                      <p className="text-label-secondary text-footnote mt-0.5 line-clamp-1 italic">
                        &ldquo;{c.comment}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-footnote flex shrink-0 items-center gap-3">
                  <span className="text-label-secondary text-footnote tabular-nums">
                    {c.size.toLocaleString()} bytes
                  </span>
                  <span className="text-label-secondary text-footnote">
                    {shortDate.format(new Date(c.timestamp))}
                  </span>
                  {!c.isNew && (
                    <Link
                      href={withBasePath(`/wiki/diff?to=${c.revid}`)}
                      className="bg-fill-3 hover:bg-fill-2 text-label rounded-control text-caption inline-flex items-center gap-1 px-3 py-1 font-semibold transition-colors"
                    >
                      <GitCommit className="text-label-secondary h-3 w-3" />
                      <span>diff</span>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && hasUser && contribs.length === 0 && (
        <DashedNotice>No contributions found for &ldquo;{activeUser}&rdquo;.</DashedNotice>
      )}

      {showEmptyPrompt && !activeUser && (
        <DashedNotice>
          Enter an editor username above to inspect their contribution history.
        </DashedNotice>
      )}
    </UtilitySearchShell>
  );
}
