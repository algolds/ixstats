"use client";
// src/app/(wiki-os)/wiki/contributions/page.tsx
// WikiOS User Contributions Ledger — Hub & Editor History Search

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { api } from "~/trpc/react";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { withBasePath } from "~/lib/base-path";
import { User as UserIcon, Search, Folder as FolderTree, Clock, GitCommit } from "iconoir-react";

export default function ContributionsHubPage() {
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const { user: authUser } = useWikiAuth();

  const initialUser =
    searchParams.get("user") || searchParams.get("target") || authUser?.username || "";
  const [username, setUsername] = useState(initialUser);
  const [activeUser, setActiveUser] = useState(initialUser);

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
        {/* ── 1. Masthead & Search ── */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/70 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_6px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl sm:p-8 dark:border-white/10 dark:bg-zinc-900/70 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.4)]"
        >
          <TextureOverlay texture="paperGrain" opacity={0.06} />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2">
              <Link
                href={withBasePath("/util")}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 transition-all hover:bg-emerald-500/15 active:scale-[0.97] dark:text-emerald-400"
              >
                <FolderTree className="h-3.5 w-3.5" />
                <span>Special:Utilities</span>
                <span className="opacity-40">/</span>
                <span className="font-bold">Contributions</span>
              </Link>
            </div>

            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="max-w-xl space-y-1">
                <h1 className="text-foreground font-brand text-2xl font-bold tracking-tight sm:text-3xl">
                  User Contributions Ledger
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Audit article revisions, new creations, byte diffs, and edit summaries by editor
                  identity.
                </p>
              </div>

              {activeUser && (
                <div className="border-border/60 flex shrink-0 items-center gap-2.5 rounded-2xl border bg-white/50 px-4 py-2 shadow-sm backdrop-blur-sm dark:bg-zinc-800/50">
                  <UserIcon className="h-4 w-4 text-emerald-500" />
                  <div className="text-left">
                    <div className="text-foreground text-xs font-bold">{activeUser}</div>
                    <div className="text-muted-foreground text-[10px]">
                      {contribs.length} recorded edits
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Search Input Form */}
            <form onSubmit={handleSearch} className="pt-2">
              <div className="relative flex items-center">
                <Search className="text-muted-foreground pointer-events-none absolute left-3.5 h-4 w-4" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter editor username (e.g. Admin, LoreKeeper, your handle)..."
                  className="border-border/80 placeholder:text-muted-foreground/60 text-foreground w-full rounded-2xl border bg-white/80 py-3 pr-24 pl-10 text-sm shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none dark:bg-zinc-950/80"
                />
                <button
                  type="submit"
                  className="absolute right-2 cursor-pointer rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-[0.97]"
                >
                  Lookup
                </button>
              </div>
            </form>
          </div>
        </motion.div>

        {/* ── 2. Results Ledger ── */}
        {isLoading && (
          <div className="border-border/40 bg-card/50 flex h-64 items-center justify-center rounded-3xl border backdrop-blur-md">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-xs text-red-400">
            Failed to load contributions: {error.message}
          </div>
        )}

        {!isLoading && activeUser.trim().length > 0 && contribs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Clock className="h-4 w-4 text-emerald-500" />
              <h2 className="text-foreground text-sm text-[11px] font-bold tracking-tight tracking-wider uppercase">
                Revision History for {activeUser} ({contribs.length})
              </h2>
            </div>

            <div className="space-y-2">
              {contribs.map((c) => (
                <div
                  key={c.revid}
                  className="group relative flex flex-col justify-between gap-3 rounded-2xl border border-white/20 bg-white/60 p-4 shadow-sm backdrop-blur-md transition-all duration-150 hover:border-emerald-500/40 hover:bg-white/90 sm:flex-row sm:items-center dark:border-white/10 dark:bg-zinc-900/60 dark:hover:bg-zinc-900/90"
                >
                  <div className="flex min-w-0 items-start gap-3 sm:items-center">
                    <div className="flex shrink-0 items-center gap-1">
                      {c.isNew && (
                        <span className="rounded border border-emerald-500/20 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-500">
                          NEW
                        </span>
                      )}
                      {c.minor && (
                        <span className="rounded border border-blue-500/20 bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-bold text-blue-500">
                          m
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <Link
                        href={withBasePath(
                          `/wiki/${encodeURIComponent(c.title.replace(/ /g, "_"))}`
                        )}
                        className="text-foreground block truncate text-xs font-bold transition-colors hover:text-emerald-500"
                      >
                        {c.title}
                      </Link>
                      {c.comment && (
                        <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[11px] italic">
                          &ldquo;{c.comment}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
                      {c.size.toLocaleString()} bytes
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(c.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {!c.isNew && (
                      <Link
                        href={withBasePath(`/wiki/diff?to=${c.revid}`)}
                        className="bg-muted hover:bg-muted/80 text-foreground inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors"
                      >
                        <GitCommit className="text-muted-foreground h-3 w-3" />
                        <span>diff</span>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && activeUser.trim().length > 0 && contribs.length === 0 && (
          <div className="border-border/50 bg-card/30 text-muted-foreground rounded-3xl border border-dashed p-12 text-center text-xs">
            No contributions found for &ldquo;{activeUser}&rdquo;.
          </div>
        )}

        {!activeUser && (
          <div className="border-border/50 bg-card/30 text-muted-foreground rounded-3xl border border-dashed p-12 text-center text-xs">
            Enter an editor username above to inspect their contribution history.
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}
