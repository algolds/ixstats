// src/app/(wiki-os)/wiki/contributions/[user]/page.tsx
// WikiOS User Contributions — shows edit history for a specific user
"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import {
  User as UserIcon,
  Search,
  Folder as FolderTree,
  Clock,
  GitCommit,
} from "iconoir-react";

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
      <div className="w-full space-y-8 select-none pb-16 max-w-6xl mx-auto">
        {/* ── Masthead & Search ── */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-white/20 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_6px_24px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.4)]"
        >
          <TextureOverlay texture="paperGrain" opacity={0.06} />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2">
              <Link
                href={withBasePath("/wiki/utilities")}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/15 active:scale-[0.97] transition-all cursor-pointer group"
              >
                <FolderTree className="h-3.5 w-3.5" />
                <span>Special:Utilities</span>
                <span className="opacity-40">/</span>
                <span className="font-bold">Contributions</span>
              </Link>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-1 max-w-xl">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-brand">
                  Contributions: {activeUser}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Audit article revisions, new creations, byte diffs, and edit summaries by editor
                  identity.
                </p>
              </div>

              {activeUser && (
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/50 dark:bg-zinc-800/50 border border-border/60 backdrop-blur-sm shadow-sm shrink-0">
                  <UserIcon className="h-4 w-4 text-emerald-500" />
                  <div className="text-left">
                    <div className="text-xs font-bold text-foreground">{activeUser}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {contribs.length} recorded edits
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Search Input Form */}
            <form onSubmit={handleSearch} className="pt-2">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter editor username (e.g. Admin, LoreKeeper, your handle)..."
                  className="w-full pl-10 pr-24 py-3 rounded-2xl text-sm bg-white/80 dark:bg-zinc-950/80 border border-border/80 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-inner transition-all placeholder:text-muted-foreground/60 text-foreground"
                />
                <button
                  type="submit"
                  className="absolute right-2 px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.97] transition-all cursor-pointer shadow-sm"
                >
                  Lookup
                </button>
              </div>
            </form>
          </div>
        </motion.div>

        {/* ── Results Ledger ── */}
        {isLoading && (
          <div className="flex h-64 items-center justify-center rounded-3xl border border-border/40 bg-card/50 backdrop-blur-md">
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
              <h2 className="text-sm font-bold tracking-tight text-foreground uppercase tracking-wider text-[11px]">
                Revision History for {activeUser} ({contribs.length})
              </h2>
            </div>

            <div className="space-y-2">
              {contribs.map((c: { revid: number; title: string; timestamp: string; comment: string; size: number; minor: boolean; isNew: boolean }) => (
                <div
                  key={c.revid}
                  className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm hover:border-emerald-500/40 hover:bg-white/90 dark:hover:bg-zinc-900/90 transition-all duration-150"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="flex items-center gap-1 shrink-0">
                      {c.isNew && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                          NEW
                        </span>
                      )}
                      {c.minor && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-500 border border-blue-500/20">
                          m
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <Link
                        href={withBasePath(`/wiki/${encodeURIComponent(c.title.replace(/ /g, "_"))}`)}
                        className="text-xs font-bold text-foreground hover:text-emerald-500 transition-colors truncate block"
                      >
                        {c.title}
                      </Link>
                      {c.comment && (
                        <p className="text-[11px] text-muted-foreground italic mt-0.5 line-clamp-1">
                          &ldquo;{c.comment}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                      {c.size.toLocaleString()} bytes
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {!c.isNew && (
                      <Link
                        href={withBasePath(`/wiki/diff?to=${c.revid}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
                      >
                        <GitCommit className="h-3 w-3 text-muted-foreground" />
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
          <div className="rounded-3xl border border-dashed border-border/50 bg-card/30 p-12 text-center text-xs text-muted-foreground">
            No contributions found for &ldquo;{activeUser}&rdquo;.
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}

