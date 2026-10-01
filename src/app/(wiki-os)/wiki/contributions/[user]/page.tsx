"use client";
// src/app/(wiki-os)/wiki/contributions/[user]/page.tsx
// WikiOS User Contributions — shows edit history for a specific user

import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { User as UserIcon, Search, Folder as FolderTree, Clock, GitCommit } from "iconoir-react";
import { Button } from "~/components/ui/button";

export default function ContributionsPage() {
  const params = useParams<{ user: string }>();
  const initialUser = decodeURIComponent(params.user || "");
  const [username, setUsername] = useState(initialUser);
  const [activeUser, setActiveUser] = useState(initialUser);
  const reduceMotion = useReducedMotion();

  const { data, isLoading, error } = api.wikios.getUserContribs.useQuery(
    { user: activeUser, limit: 50 },
    { enabled: activeUser.trim().length > 0, staleTime: 30_000 }
  );

  const contribs = data?.contribs ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setActiveUser(username.trim());
    }
  };

  return (
    <WikiOSLayout hideTitleHeading>
      <div className="mx-auto w-full max-w-6xl space-y-8 pb-16 select-none">
        {/* ── Masthead & Search ── */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          className="rounded-card border-separator bg-surface relative overflow-hidden border p-6 sm:p-8"
        >
          <TextureOverlay texture="paperGrain" opacity={0.06} />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2">
              <Link
                href={withBasePath("/wiki/utilities")}
                className="group border-green/20 bg-green/10 text-caption text-green hover:bg-green/15 inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
              >
                <FolderTree className="h-3.5 w-3.5" />
                <span>Special:Utilities</span>
                <span className="opacity-40">/</span>
                <span className="font-semibold">Contributions</span>
              </Link>
            </div>

            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="max-w-xl space-y-1">
                <h1 className="text-label font-brand text-title-1 sm:text-large-title">
                  Contributions: {activeUser}
                </h1>
                <p className="text-label-secondary text-body leading-relaxed">
                  Audit article revisions, new creations, byte diffs, and edit summaries by editor
                  identity.
                </p>
              </div>

              {activeUser && (
                <div className="border-separator rounded-card bg-surface shadow-card flex shrink-0 items-center gap-2 border px-4 py-2">
                  <UserIcon className="text-green h-4 w-4" />
                  <div className="text-left">
                    <div className="text-label text-caption font-semibold">{activeUser}</div>
                    <div className="text-label-secondary text-footnote">
                      {contribs.length} recorded edits
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Search Input Form */}
            <form onSubmit={handleSearch} className="pt-2">
              <div className="relative flex items-center">
                <Search className="text-label-secondary pointer-events-none absolute left-4 h-4 w-4" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter editor username (e.g. Admin, LoreKeeper, your handle)..."
                  className="border-separator placeholder:text-label-tertiary text-label rounded-card bg-surface text-body focus:border-green focus:ring-green/20 w-full border py-3 pr-24 pl-10 transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none"
                />
                <Button
                  size="sm"
                  type="submit"
                  className="bg-green text-on-green hover:bg-green/90 absolute right-2"
                >
                  Lookup
                </Button>
              </div>
            </form>
          </div>
        </motion.div>

        {/* ── Results Ledger ── */}
        {isLoading && (
          <div className="border-separator bg-surface rounded-card flex h-64 items-center justify-center border">
            <div className="border-green h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="rounded-card border-red/30 bg-red/10 text-footnote text-red border p-6">
            Failed to load contributions: {error.message}
          </div>
        )}

        {!isLoading && activeUser.trim().length > 0 && contribs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Clock className="text-green h-4 w-4" />
              <h2 className="text-label text-headline text-subhead">
                Revision History for {activeUser} ({contribs.length})
              </h2>
            </div>

            <div className="space-y-2">
              {contribs.map(
                (c: {
                  revid: number | string;
                  title: string;
                  timestamp: string;
                  comment: string;
                  size: number;
                  minor: boolean;
                  isNew: boolean;
                }) => (
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
                          href={withBasePath(
                            `/wiki/${encodeURIComponent(c.title.replace(/ /g, "_"))}`
                          )}
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
                        {new Date(c.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
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
                )
              )}
            </div>
          </div>
        )}

        {!isLoading && activeUser.trim().length > 0 && contribs.length === 0 && (
          <div className="border-separator bg-surface text-label-secondary rounded-card text-footnote border border-dashed p-12 text-center">
            No contributions found for &ldquo;{activeUser}&rdquo;.
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}
