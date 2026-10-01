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
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-16 select-none">
      {/* ── Apple-Grade Masthead Card ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        className="rounded-card border-separator bg-surface relative overflow-hidden border p-6 sm:p-8"
      >
        <TextureOverlay texture="paperGrain" opacity={0.06} />

        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl space-y-2">
            {/* Breadcrumb Navigation Pill */}
            <Link
              href={withBasePath("/wiki/categories")}
              className="group border-tint/20 bg-tint/10 text-caption text-tint hover:bg-tint/15 inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
            >
              <ArrowLeft className="h-3 w-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
              <Folder className="h-3.5 w-3.5" />
              <span>Category Directory</span>
              <span className="opacity-40">/</span>
              <span className="font-semibold">{cleanCategoryName}</span>
            </Link>

            <h1 className="text-label font-brand text-title-1 sm:text-large-title">
              {cleanCategoryName}
            </h1>

            <p className="text-label-secondary text-body leading-relaxed">
              Encyclopedic category index containing {pages.length} published article
              {pages.length === 1 ? "" : "s"}
              {subcategories.length > 0
                ? ` and ${subcategories.length} subcategor${subcategories.length === 1 ? "y" : "ies"}`
                : ""}
              .
            </p>
          </div>

          {/* Quick Metrics Deck */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="border-separator rounded-card bg-surface shadow-card flex items-center gap-2 border px-4 py-3">
              <div className="rounded-row bg-green/10 text-green flex h-8 w-8 shrink-0 items-center justify-center">
                <FileText className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-label text-headline tabular-nums">{pages.length}</div>
                <div className="text-label-secondary text-caption">Articles</div>
              </div>
            </div>

            {subcategories.length > 0 && (
              <div className="border-separator rounded-card bg-surface shadow-card flex items-center gap-2 border px-4 py-3">
                <div className="rounded-row bg-tint/10 text-tint flex h-8 w-8 shrink-0 items-center justify-center">
                  <Folder className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <div className="text-label text-headline tabular-nums">
                    {subcategories.length}
                  </div>
                  <div className="text-label-secondary text-caption">Subcategories</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Subcategories Section ── */}
      {subcategories.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Folder className="text-tint h-4 w-4" />
            <h2 className="text-label text-headline text-subhead">
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
                  className="text-label group rounded-row border-separator bg-surface text-caption shadow-card hover:border-tint/40 hover:bg-surface hover:text-tint inline-flex items-center gap-2 border px-4 py-2 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.98]"
                >
                  <Folder className="text-tint/70 group-hover:text-tint h-3.5 w-3.5 shrink-0 transition-colors" />
                  <span>{name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pages in Category Grid ── */}
      {pages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <FileText className="text-green h-4 w-4" />
            <h2 className="text-label text-headline text-subhead">
              Pages in category ({pages.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {pages.map((m) => {
              const match = countryMap.get(m.title.toLowerCase());
              const displayImage = m.imageUrl || match?.flagUrl;
              const isFlag = !m.imageUrl && !!match?.flagUrl;

              return (
                <Link
                  key={m.title}
                  href={withBasePath(`/wiki/${encodeURIComponent(m.title.replace(/ /g, "_"))}`)}
                  className="group rounded-card border-separator bg-surface hover:border-tint/40 hover:bg-surface hover:shadow-card relative flex items-center gap-3 overflow-hidden border p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.98]"
                >
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt=""
                      className={
                        isFlag
                          ? "border-separator rounded-control h-8 w-12 shrink-0 border object-cover"
                          : "border-separator rounded-row h-10 w-10 shrink-0 border object-cover"
                      }
                      loading="lazy"
                    />
                  ) : (
                    <div className="bg-fill-3 text-label-secondary rounded-row group-hover:bg-tint/10 group-hover:text-tint flex h-9 w-9 shrink-0 items-center justify-center transition-colors">
                      <FileText className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-label text-caption group-hover:text-tint block truncate font-semibold transition-colors">
                      {m.title}
                    </span>
                    {match?.economicTier && (
                      <span className="text-label-secondary text-caption block truncate">
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
        <div className="border-separator bg-fill-4 rounded-card border py-16 text-center">
          <p className="text-label-secondary text-body">This category is currently empty.</p>
        </div>
      )}
    </div>
  );
}
