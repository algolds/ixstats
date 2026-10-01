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
          className="rounded-card border-separator bg-surface relative overflow-hidden border p-6 sm:p-8"
        >
          <TextureOverlay texture="paperGrain" opacity={0.06} />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2">
              <Link
                href={withBasePath("/util")}
                className="group border-yellow/20 bg-yellow/10 text-caption text-yellow hover:bg-yellow/15 inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
              >
                <FolderTree className="h-3.5 w-3.5" />
                <span>Special:Utilities</span>
                <span className="opacity-40">/</span>
                <span className="font-semibold">WhatLinksHere</span>
              </Link>
            </div>

            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="max-w-xl space-y-1">
                <h1 className="text-label font-brand text-title-1 sm:text-large-title">
                  Backlinks & Link Graph
                </h1>
                <p className="text-label-secondary text-body leading-relaxed">
                  Query inbound links, citations, and incoming relations pointing to any
                  encyclopedic page in $O(1)$ time.
                </p>
              </div>

              {activeTarget && (
                <div className="border-separator rounded-card bg-surface shadow-card flex shrink-0 items-center gap-2.5 border px-4 py-2">
                  <LinkIcon className="text-yellow h-4 w-4" />
                  <div className="text-left">
                    <div className="text-label text-caption max-w-[160px] truncate font-semibold">
                      {activeTarget}
                    </div>
                    <div className="text-label-secondary text-footnote">
                      {links.length} inbound links
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Target Article Search Form */}
            <form onSubmit={handleSearch} className="pt-2">
              <div className="relative flex items-center">
                <Search className="text-label-secondary pointer-events-none absolute left-3.5 h-4 w-4" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Enter target page title (e.g. Caphiria, History of Urcea, Caphirian dollar)..."
                  className="border-separator placeholder:text-label-tertiary text-label rounded-card bg-surface text-body focus:border-yellow focus:ring-yellow/20 w-full border py-3 pr-24 pl-10 transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-row bg-yellow text-caption text-on-yellow shadow-card hover:bg-yellow absolute right-2 cursor-pointer px-4 py-1.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
                >
                  Inspect
                </button>
              </div>
            </form>
          </div>
        </motion.div>

        {/* ── 2. Backlinks Results Grid ── */}
        {isLoading && (
          <div className="border-separator bg-surface rounded-card flex h-64 items-center justify-center border">
            <div className="border-yellow h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="rounded-card border-red/30 bg-red/10 text-footnote text-red border p-6">
            Failed to query backlinks: {error.message}
          </div>
        )}

        {!isLoading && activeTarget.trim().length > 0 && links.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <LinkIcon className="text-yellow h-4 w-4" />
                <h2 className="text-label text-headline text-subhead">
                  Pages linking to &ldquo;{activeTarget}&rdquo; ({links.length})
                </h2>
              </div>

              <Link
                href={withBasePath(`/wiki/${encodeURIComponent(activeTarget.replace(/ /g, "_"))}`)}
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
                  href={withBasePath(`/wiki/${encodeURIComponent(link.title.replace(/ /g, "_"))}`)}
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

        {!isLoading && activeTarget.trim().length > 0 && links.length === 0 && (
          <div className="border-separator bg-surface text-label-secondary rounded-card text-footnote border border-dashed p-12 text-center">
            No pages currently link to &ldquo;{activeTarget}&rdquo;.
          </div>
        )}

        {!activeTarget && (
          <div className="border-separator bg-surface text-label-secondary rounded-card text-footnote border border-dashed p-12 text-center">
            Enter an article title above to explore all inbound links and citations across the
            realm.
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}
