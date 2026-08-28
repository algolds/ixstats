"use client";
// src/app/(wiki-os)/wiki/whatlinkshere/page.tsx
// WikiOS Backlinks & Directed Link Graph Explorer — Special:WhatLinksHere

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
    searchParams.get("target") || searchParams.get("title") || searchParams.get("page") || "";
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
      <div className="mx-auto w-full max-w-6xl space-y-8 pb-16 select-none">
        {/* ── 1. Masthead & Target Search ── */}
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
                className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 transition-all hover:bg-amber-500/15 active:scale-[0.97] dark:text-amber-400"
              >
                <FolderTree className="h-3.5 w-3.5" />
                <span>Special:Utilities</span>
                <span className="opacity-40">/</span>
                <span className="font-bold">WhatLinksHere</span>
              </Link>
            </div>

            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="max-w-xl space-y-1">
                <h1 className="text-foreground font-brand text-2xl font-bold tracking-tight sm:text-3xl">
                  Backlinks & Link Graph
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Query inbound links, citations, and incoming relations pointing to any
                  encyclopedic page in $O(1)$ time.
                </p>
              </div>

              {activeTarget && (
                <div className="border-border/60 flex shrink-0 items-center gap-2.5 rounded-2xl border bg-white/50 px-4 py-2 shadow-sm backdrop-blur-sm dark:bg-zinc-800/50">
                  <LinkIcon className="h-4 w-4 text-amber-500" />
                  <div className="text-left">
                    <div className="text-foreground max-w-[160px] truncate text-xs font-bold">
                      {activeTarget}
                    </div>
                    <div className="text-muted-foreground text-[10px]">
                      {links.length} inbound links
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Target Article Search Form */}
            <form onSubmit={handleSearch} className="pt-2">
              <div className="relative flex items-center">
                <Search className="text-muted-foreground pointer-events-none absolute left-3.5 h-4 w-4" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Enter target page title (e.g. Caphiria, History of Urcea, Caphirian dollar)..."
                  className="border-border/80 placeholder:text-muted-foreground/60 text-foreground w-full rounded-2xl border bg-white/80 py-3 pr-24 pl-10 text-sm shadow-inner transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none dark:bg-zinc-950/80"
                />
                <button
                  type="submit"
                  className="absolute right-2 cursor-pointer rounded-xl bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-amber-500 active:scale-[0.97]"
                >
                  Inspect
                </button>
              </div>
            </form>
          </div>
        </motion.div>

        {/* ── 2. Backlinks Results Grid ── */}
        {isLoading && (
          <div className="border-border/40 bg-card/50 flex h-64 items-center justify-center rounded-3xl border backdrop-blur-md">
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
                <h2 className="text-foreground text-sm text-[11px] font-bold tracking-tight tracking-wider uppercase">
                  Pages linking to &ldquo;{activeTarget}&rdquo; ({links.length})
                </h2>
              </div>

              <Link
                href={withBasePath(`/wiki/${encodeURIComponent(activeTarget.replace(/ /g, "_"))}`)}
                className="flex items-center gap-1 text-xs font-semibold text-amber-500 hover:underline"
              >
                <span>View target article</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {links.map((link: { title: string; ns?: number }) => (
                <Link
                  key={link.title}
                  href={withBasePath(`/wiki/${encodeURIComponent(link.title.replace(/ /g, "_"))}`)}
                  className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/20 bg-white/60 p-3 shadow-sm backdrop-blur-md transition-all duration-150 hover:border-amber-500/40 hover:bg-white/90 hover:shadow-md active:scale-[0.98] dark:border-white/10 dark:bg-zinc-900/60 dark:hover:bg-zinc-900/90"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 transition-transform group-hover:scale-105">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-foreground block truncate text-xs font-semibold transition-colors group-hover:text-amber-500">
                      {link.title}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!isLoading && activeTarget.trim().length > 0 && links.length === 0 && (
          <div className="border-border/50 bg-card/30 text-muted-foreground rounded-3xl border border-dashed p-12 text-center text-xs">
            No pages currently link to &ldquo;{activeTarget}&rdquo;.
          </div>
        )}

        {!activeTarget && (
          <div className="border-border/50 bg-card/30 text-muted-foreground rounded-3xl border border-dashed p-12 text-center text-xs">
            Enter an article title above to explore all inbound links and citations across the
            realm.
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}
