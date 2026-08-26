// src/app/(wiki-os)/wiki/whatlinkshere/page.tsx
// WikiOS Backlinks & Directed Link Graph Explorer — Special:WhatLinksHere
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { withBasePath } from "~/lib/base-path";
import {
  Link as LinkIcon,
  Search,
  Folder as FolderTree,
  Page as FileText,
  ArrowRight,
} from "iconoir-react";

export default function WhatLinksHereHubPage() {
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const initialTarget =
    searchParams.get("target") ||
    searchParams.get("title") ||
    searchParams.get("page") ||
    "";
  const [searchInput, setSearchInput] = useState(initialTarget);
  const [activeTarget, setActiveTarget] = useState(initialTarget);

  const { data, isLoading, error } = api.wikios.getBacklinks.useQuery(
    { title: activeTarget, limit: 200 },
    { enabled: activeTarget.trim().length > 0, staleTime: 60_000 }
  );

  const links = data?.links ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setActiveTarget(searchInput.trim());
    }
  };

  return (
    <WikiOSLayout hideTitleHeading>
      <div className="w-full space-y-8 select-none pb-16 max-w-6xl mx-auto">
        {/* ── 1. Masthead & Target Search ── */}
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
                href={withBasePath("/util")}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/15 active:scale-[0.97] transition-all cursor-pointer group"
              >
                <FolderTree className="h-3.5 w-3.5" />
                <span>Special:Utilities</span>
                <span className="opacity-40">/</span>
                <span className="font-bold">WhatLinksHere</span>
              </Link>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-1 max-w-xl">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-brand">
                  Backlinks & Link Graph
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Query inbound links, citations, and incoming relations pointing to any encyclopedic
                  page in $O(1)$ time.
                </p>
              </div>

              {activeTarget && (
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/50 dark:bg-zinc-800/50 border border-border/60 backdrop-blur-sm shadow-sm shrink-0">
                  <LinkIcon className="h-4 w-4 text-amber-500" />
                  <div className="text-left">
                    <div className="text-xs font-bold text-foreground truncate max-w-[160px]">
                      {activeTarget}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {links.length} inbound links
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Target Article Search Form */}
            <form onSubmit={handleSearch} className="pt-2">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Enter target page title (e.g. Caphiria, History of Urcea, Caphirian dollar)..."
                  className="w-full pl-10 pr-24 py-3 rounded-2xl text-sm bg-white/80 dark:bg-zinc-950/80 border border-border/80 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-inner transition-all placeholder:text-muted-foreground/60 text-foreground"
                />
                <button
                  type="submit"
                  className="absolute right-2 px-4 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white active:scale-[0.97] transition-all cursor-pointer shadow-sm"
                >
                  Inspect
                </button>
              </div>
            </form>
          </div>
        </motion.div>

        {/* ── 2. Backlinks Results Grid ── */}
        {isLoading && (
          <div className="flex h-64 items-center justify-center rounded-3xl border border-border/40 bg-card/50 backdrop-blur-md">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-xs text-red-400">
            Failed to query backlinks: {error.message}
          </div>
        )}

        {!isLoading && activeTarget.trim().length > 0 && links.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-bold tracking-tight text-foreground uppercase tracking-wider text-[11px]">
                  Pages linking to &ldquo;{activeTarget}&rdquo; ({links.length})
                </h2>
              </div>

              <Link
                href={withBasePath(`/wiki/${encodeURIComponent(activeTarget.replace(/ /g, "_"))}`)}
                className="text-xs font-semibold text-amber-500 hover:underline flex items-center gap-1"
              >
                <span>View target article</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {links.map((link: { title: string; ns?: number }) => (
                <Link
                  key={link.title}
                  href={withBasePath(`/wiki/${encodeURIComponent(link.title.replace(/ /g, "_"))}`)}
                  className="group relative overflow-hidden flex items-center gap-3 p-3 rounded-2xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm hover:border-amber-500/40 hover:bg-white/90 dark:hover:bg-zinc-900/90 hover:shadow-md transition-all duration-150 active:scale-[0.98]"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 group-hover:scale-105 transition-transform shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-foreground truncate block group-hover:text-amber-500 transition-colors">
                      {link.title}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!isLoading && activeTarget.trim().length > 0 && links.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border/50 bg-card/30 p-12 text-center text-xs text-muted-foreground">
            No pages currently link to &ldquo;{activeTarget}&rdquo;.
          </div>
        )}

        {!activeTarget && (
          <div className="rounded-3xl border border-dashed border-border/50 bg-card/30 p-12 text-center text-xs text-muted-foreground">
            Enter an article title above to explore all inbound links and citations across the realm.
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}
