"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Folder, Page as FileText, ArrowLeft } from "iconoir-react";

interface CategoryMember {
  title: string;
  ns: number;
  imageUrl?: string | null;
}

interface EnhancedCategoryBrowserProps {
  category: string;
  subcategories: CategoryMember[];
  pages: CategoryMember[];
}

export function EnhancedCategoryBrowser({
  category,
  subcategories,
  pages,
}: EnhancedCategoryBrowserProps) {
  const reduceMotion = useReducedMotion();

  // Fetch all countries for flag matching
  const { data: countriesData } = api.countries.getSelectList.useQuery(
    { limit: 500 },
    { staleTime: 10 * 60 * 1000 }
  );

  const countryMap = useMemo(() => {
    const list = Array.isArray(countriesData)
      ? countriesData
      : ((countriesData as any)?.countries ?? []);
    const map = new Map<string, { flagUrl?: string | null; economicTier?: string | null }>();
    for (const c of list as any[]) {
      if (c.name)
        map.set(c.name.toLowerCase(), { flagUrl: c.flagUrl, economicTier: c.economicTier });
    }
    return map;
  }, [countriesData]);

  const cleanCategoryName = category.replace(/^Category:/i, "").replace(/_/g, " ");

  return (
    <div className="w-full space-y-8 select-none pb-16 max-w-6xl mx-auto">
      {/* ── Apple-Grade Masthead Card ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-white/20 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_6px_24px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.4)]"
      >
        <TextureOverlay texture="paperGrain" opacity={0.06} />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            {/* Breadcrumb Navigation Pill */}
            <Link
              href={withBasePath("/wiki/categories")}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/15 active:scale-[0.97] transition-all cursor-pointer group"
            >
              <ArrowLeft className="h-3 w-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
              <Folder className="h-3.5 w-3.5" />
              <span>Category Directory</span>
              <span className="opacity-40">/</span>
              <span className="font-bold">{cleanCategoryName}</span>
            </Link>

            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground font-brand">
              {cleanCategoryName}
            </h1>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Encyclopedic category index containing {pages.length} published article
              {pages.length === 1 ? "" : "s"}
              {subcategories.length > 0
                ? ` and ${subcategories.length} subcategor${subcategories.length === 1 ? "y" : "ies"}`
                : ""}
              .
            </p>
          </div>

          {/* Quick Metrics Deck */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/50 dark:bg-zinc-800/50 border border-border/60 backdrop-blur-sm shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-foreground tabular-nums">{pages.length}</div>
                <div className="text-[10px] font-medium text-muted-foreground">Articles</div>
              </div>
            </div>

            {subcategories.length > 0 && (
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/50 dark:bg-zinc-800/50 border border-border/60 backdrop-blur-sm shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
                  <Folder className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-foreground tabular-nums">
                    {subcategories.length}
                  </div>
                  <div className="text-[10px] font-medium text-muted-foreground">Subcategories</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Subcategories Section ── */}
      {subcategories.length > 0 && (
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 px-1">
            <Folder className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-bold tracking-tight text-foreground uppercase tracking-wider text-[11px]">
              Subcategories ({subcategories.length})
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {subcategories.map((m) => {
              const name = m.title.replace(/^Category:/, "");
              return (
                <Link
                  key={m.title}
                  href={withBasePath(
                    `/wiki/categories/${encodeURIComponent(name.replace(/ /g, "_"))}`
                  )}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/60 dark:bg-zinc-900/60 border border-white/20 dark:border-white/10 hover:border-blue-500/40 hover:bg-white/90 dark:hover:bg-zinc-900/90 active:scale-[0.97] transition-all duration-150 backdrop-blur-md shadow-sm text-foreground hover:text-blue-500 group"
                >
                  <Folder className="h-3.5 w-3.5 text-blue-500/70 group-hover:text-blue-500 transition-colors shrink-0" />
                  <span>{name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pages in Category Grid ── */}
      {pages.length > 0 && (
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 px-1">
            <FileText className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-bold tracking-tight text-foreground uppercase tracking-wider text-[11px]">
              Pages in category ({pages.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {pages.map((m) => {
              const match = countryMap.get(m.title.toLowerCase());
              const displayImage = m.imageUrl || match?.flagUrl;
              const isFlag = !m.imageUrl && !!match?.flagUrl;

              return (
                <Link
                  key={m.title}
                  href={withBasePath(`/wiki/${encodeURIComponent(m.title.replace(/ /g, "_"))}`)}
                  className="group relative overflow-hidden flex items-center gap-3 p-3 rounded-2xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.25)] hover:border-blue-500/40 hover:bg-white/90 dark:hover:bg-zinc-900/90 hover:shadow-md transition-all duration-150 active:scale-[0.98]"
                >
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt=""
                      className={
                        isFlag
                          ? "h-8 w-12 object-cover rounded-lg border border-border/60 shrink-0"
                          : "h-10 w-10 object-cover rounded-xl border border-border/60 shrink-0"
                      }
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-colors shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-foreground truncate block group-hover:text-blue-500 transition-colors">
                      {m.title}
                    </span>
                    {match?.economicTier && (
                      <span className="text-[10px] font-medium text-muted-foreground block truncate">
                        {match.economicTier}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {pages.length === 0 && subcategories.length === 0 && (
        <div className="text-center py-16 rounded-3xl border border-border/40 bg-muted/20">
          <p className="text-sm text-muted-foreground">This category is currently empty.</p>
        </div>
      )}
    </div>
  );
}
