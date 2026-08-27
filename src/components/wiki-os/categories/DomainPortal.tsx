"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Page as FileText, Folder, ArrowLeft } from "iconoir-react";

interface CategoryMember {
  title: string;
  ns: number;
  imageUrl?: string | null;
}

interface DomainPortalProps {
  domain: string;
  domainMeta: { color: string; metric: string; description: string };
  subcategories: CategoryMember[];
  pages: CategoryMember[];
}

export function DomainPortal({ domain, domainMeta, subcategories, pages }: DomainPortalProps) {
  const reduceMotion = useReducedMotion();

  const { data: countriesData } = api.countries.getSelectList.useQuery(
    { limit: 500 },
    { staleTime: 10 * 60 * 1000 }
  );

  const countries = useMemo(() => {
    const list = Array.isArray(countriesData)
      ? countriesData
      : ((countriesData as any)?.countries ?? []);
    return [...list].sort((a: any, b: any) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [countriesData]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-16 select-none">
      {/* ── Apple-Grade Masthead Card ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/70 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_6px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl sm:p-8 dark:border-white/10 dark:bg-zinc-900/70 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.4)]"
      >
        <TextureOverlay texture="paperGrain" opacity={0.06} />

        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl space-y-2">
            {/* Breadcrumb Navigation Pill */}
            <Link
              href={withBasePath("/wiki/categories")}
              className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 transition-all hover:bg-blue-500/15 active:scale-[0.97] dark:text-blue-400"
            >
              <ArrowLeft className="h-3 w-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
              <Folder className="h-3.5 w-3.5" />
              <span>Category Directory</span>
              <span className="opacity-40">/</span>
              <span className="font-bold">{domain}</span>
            </Link>

            <h1 className="text-foreground font-brand text-2xl font-bold tracking-tight sm:text-4xl">
              {domain}
            </h1>

            <p className="text-muted-foreground text-sm leading-relaxed">
              {domainMeta.description}
            </p>
          </div>

          {/* Quick Metrics Deck */}
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <div className="border-border/60 flex items-center gap-2.5 rounded-2xl border bg-white/50 px-4 py-2.5 shadow-sm backdrop-blur-sm dark:bg-zinc-800/50">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${domainMeta.color}15`, color: domainMeta.color }}
              >
                <FileText className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-foreground text-sm font-bold tabular-nums">{pages.length}</div>
                <div className="text-muted-foreground text-[10px] font-medium">Articles</div>
              </div>
            </div>

            <div className="border-border/60 flex items-center gap-2.5 rounded-2xl border bg-white/50 px-4 py-2.5 shadow-sm backdrop-blur-sm dark:bg-zinc-800/50">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                <Folder className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-foreground text-sm font-bold tabular-nums">
                  {subcategories.length}
                </div>
                <div className="text-muted-foreground text-[10px] font-medium">Subcategories</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Subcategories Section ── */}
      {subcategories.length > 0 && (
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 px-1">
            <Folder className="h-4 w-4 text-blue-500" />
            <h2 className="text-foreground text-sm text-[11px] font-bold tracking-tight tracking-wider uppercase">
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
                  className="text-foreground group inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/60 px-3.5 py-2 text-xs font-semibold shadow-sm backdrop-blur-md transition-all duration-150 hover:border-blue-500/40 hover:bg-white/90 hover:text-blue-500 active:scale-[0.97] dark:border-white/10 dark:bg-zinc-900/60 dark:hover:bg-zinc-900/90"
                >
                  <Folder className="h-3.5 w-3.5 shrink-0 text-blue-500/70 transition-colors group-hover:text-blue-500" />
                  <span>{name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Articles Grid ── */}
      {pages.length > 0 && (
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 px-1">
            <FileText className="h-4 w-4 text-emerald-500" />
            <h2 className="text-foreground text-sm text-[11px] font-bold tracking-tight tracking-wider uppercase">
              Articles in {domain} ({pages.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {pages.map((m) => {
              const countryMatch = countries.find(
                (c: any) =>
                  c.name &&
                  c.name.trim().length >= 3 &&
                  m.title.toLowerCase().includes(c.name.toLowerCase())
              ) as any;
              const displayImage = m.imageUrl || countryMatch?.flag || countryMatch?.flagUrl;
              const isFlag = !m.imageUrl && !!(countryMatch?.flag || countryMatch?.flagUrl);

              return (
                <Link
                  key={m.title}
                  href={withBasePath(`/wiki/${encodeURIComponent(m.title.replace(/ /g, "_"))}`)}
                  className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/20 bg-white/60 p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.03)] backdrop-blur-md transition-all duration-150 hover:border-blue-500/40 hover:bg-white/90 hover:shadow-md active:scale-[0.98] dark:border-white/10 dark:bg-zinc-900/60 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.25)] dark:hover:bg-zinc-900/90"
                >
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt=""
                      className={
                        isFlag
                          ? "border-border/60 h-8 w-12 shrink-0 rounded-lg border object-cover"
                          : "border-border/60 h-10 w-10 shrink-0 rounded-xl border object-cover"
                      }
                      loading="lazy"
                    />
                  ) : (
                    <div className="bg-muted/60 text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors group-hover:bg-blue-500/10 group-hover:text-blue-500">
                      <FileText className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-foreground block truncate text-xs font-semibold transition-colors group-hover:text-blue-500">
                      {m.title}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {subcategories.length === 0 && pages.length === 0 && (
        <div className="border-border bg-card/40 flex flex-col items-center justify-center space-y-3 rounded-3xl border border-dashed p-12 text-center">
          <Folder className="text-muted-foreground/50 h-10 w-10" />
          <h3 className="text-foreground text-base font-semibold">
            No articles or subcategories found
          </h3>
          <p className="text-muted-foreground max-w-sm text-xs">
            This domain is currently empty or indexing. Browse all indexed categories from the main
            directory.
          </p>
          <Link
            href={withBasePath("/wiki/categories")}
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors"
          >
            <Folder className="h-3.5 w-3.5" />
            <span>Browse Category Directory</span>
          </Link>
        </div>
      )}
    </div>
  );
}
