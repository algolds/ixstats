import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Globe as IconoirGlobe,
  Building as IconoirBuilding,
  Palette as IconoirPalette,
  GraphUp as IconoirGraphUp,
  MapPin as IconoirMapPin,
  Bank as IconoirBank,
  Timer as IconoirTimer,
  Shield as IconoirShield,
  Leaf as IconoirLeaf,
  Group as IconoirGroup,
  Megaphone as IconoirMegaphone,
  Cpu as IconoirCpu,
  Page,
  EditPencil,
} from "iconoir-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { formatMWTimeAgo } from "~/lib/wiki-os/adapters/mediawiki/timestamp";
import { formatNumber, formatCurrency } from "~/lib/utils/format-utils";
import type { MainPageContentProps } from "./types";

function ActivityItemThumbnail({ src, title }: { src?: string | null; title?: string | null }) {
  const [hasError, setHasError] = useState(false);

  if (src && !hasError) {
    return (
      <div className="h-9 w-9 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 shrink-0 bg-muted/40 mt-0.5 shadow-2xs">
        <img
          src={src}
          alt={title ?? ""}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div className="h-9 w-9 rounded-lg border border-black/5 dark:border-white/10 shrink-0 bg-foreground/[0.02] flex items-center justify-center mt-0.5 text-muted-foreground/60 group-hover:text-blue-500 transition-colors">
      <Page className="h-4 w-4" />
    </div>
  );
}

const CATEGORY_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; desc: string }
> = {
  Countries: { icon: IconoirGlobe, desc: "Sovereign states & realms" },
  Companies: { icon: IconoirBuilding, desc: "Enterprises, guilds & trade" },
  Culture: { icon: IconoirPalette, desc: "Arts, faith & heritage" },
  Economy: { icon: IconoirGraphUp, desc: "Finance, markets & currency" },
  Geography: { icon: IconoirMapPin, desc: "Oceans, terrain & realms" },
  Government: { icon: IconoirBank, desc: "Crowns, laws & treaties" },
  History: { icon: IconoirTimer, desc: "Chronicles, eras & wars" },
  Military: { icon: IconoirShield, desc: "Armed forces & defense" },
  Nature: { icon: IconoirLeaf, desc: "Flora, fauna & biomes" },
  People: { icon: IconoirGroup, desc: "Figures, leaders & lineages" },
  Politics: { icon: IconoirMegaphone, desc: "Parties & diplomacy" },
  Technology: { icon: IconoirCpu, desc: "Industry & sciences" },
};

export function EditorialMainPageContent({
  categories,
  recentChanges,
  isLoadingRecent,
  countries,
}: MainPageContentProps) {
  const reduceMotion = useReducedMotion();
  const visibleChanges = useMemo(() => {
    return recentChanges?.slice(0, 4) ?? [];
  }, [recentChanges]);

  return (
    <div className="w-full space-y-5 sm:space-y-6 select-none pb-2">
      {/* ── 1. Two-Column Grid: Topic Taxonomy + Live Revisions Ledger (Equal Proportion) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
        {/* Left Column (col-span-6): Topic Taxonomy Matrix */}
        <section
          aria-label="Browse by Topic"
          className="lg:col-span-6 flex flex-col h-full"
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              Browse by topic
            </h2>
            <Link
              href={withBasePath("/wiki/categories/Countries")}
              data-cuelume-press="press"
              data-cuelume-hover="tick"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 font-medium group/all"
            >
              <span>All Topics</span>
              <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover/all:translate-x-0.5" />
            </Link>
          </div>

          <div className="rounded-2xl sm:rounded-3xl border border-black/[0.08] dark:border-white/[0.1] bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-2.5 sm:p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_20px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_6px_24px_rgba(0,0,0,0.2)] flex-1 flex flex-col justify-between">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 flex-1">
              {categories.map((cat) => {
                const meta = CATEGORY_META[cat.name] || {
                  icon: IconoirGlobe,
                  desc: "Encyclopedia entries",
                };
                const Icon = meta.icon;
                return (
                  <Link
                    key={cat.name}
                    href={withBasePath(`/wiki/categories/${encodeURIComponent(cat.name)}`)}
                    data-cuelume-press="page"
                    data-cuelume-hover="tick"
                    className={cn(
                      "flex items-start gap-2.5 p-2 sm:p-2.5 rounded-xl",
                      "hover:bg-foreground/[0.04] transition-all duration-150 group active:scale-[0.98]"
                    )}
                  >
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-foreground/10 shrink-0 mt-0.5 transition-transform group-hover:scale-105"
                      style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-semibold text-foreground/90 group-hover:text-foreground truncate">
                        {cat.name}
                      </span>
                      <span className="text-[10.5px] text-muted-foreground/75 truncate mt-0.5 leading-snug">
                        {meta.desc}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right Column (col-span-6): Live Revisions Ledger */}
        <section
          aria-label="Recent Wiki Activity"
          className="lg:col-span-6 flex flex-col h-full"
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              Recent activity
            </h2>
            <Link
              href={withBasePath("/wiki/recent-changes")}
              data-cuelume-press="press"
              data-cuelume-hover="tick"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 font-medium group/all"
            >
              <span>View all</span>
              <ArrowUpRight className="h-3 w-3 transition-transform duration-200 group-hover/all:translate-x-0.5 group-hover/all:-translate-y-0.5" />
            </Link>
          </div>

          <div className="rounded-2xl sm:rounded-3xl border border-black/[0.08] dark:border-white/[0.1] bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-2.5 sm:p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_20px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_6px_24px_rgba(0,0,0,0.2)] flex-1 flex flex-col justify-between overflow-hidden relative">
            {visibleChanges.length > 0 ? (
              <ul className="divide-y divide-border/30 flex-1 flex flex-col justify-between">
                {visibleChanges.map((rc, idx) => {
                  const diff = (rc.newLen ?? 0) - (rc.oldLen ?? 0);
                  const diffSign = diff > 0 ? "+" : "";
                  const formattedDiff = `${diffSign}${diff.toLocaleString()}`;

                  let diffClass = "text-muted-foreground/60";
                  if (diff > 0) {
                    diffClass = "text-emerald-500 font-semibold";
                  } else if (diff < 0) {
                    diffClass = "text-rose-500 font-semibold";
                  }

                  return (
                    <li
                      key={idx}
                      className="py-2.5 px-3 flex items-start justify-between gap-3 hover:bg-foreground/[0.04] rounded-2xl transition-all duration-200 group flex-1"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <ActivityItemThumbnail src={rc.thumbnail} title={rc.title} />

                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={withBasePath(
                                `/wiki/${encodeURIComponent((rc.title ?? "").replace(/ /g, "_"))}`
                              )}
                              data-cuelume-press="droplet"
                              data-cuelume-hover="tick"
                              className="text-xs sm:text-sm font-semibold text-foreground truncate hover:text-blue-500 transition-colors"
                            >
                              {rc.title}
                            </Link>
                          </div>

                          {/* Page Blurb / Description */}
                          {rc.blurb && (
                            <p className="text-[11px] text-muted-foreground/80 line-clamp-1 leading-snug mt-0.5">
                              {rc.blurb}
                            </p>
                          )}

                          {/* Edit Notes / Summary */}
                          {rc.comment && rc.comment.trim() && (
                            <div className="flex items-center gap-1 mt-1 text-[10.5px] text-foreground/75 bg-foreground/[0.03] border border-border/40 rounded-md px-1.5 py-0.5 max-w-fit">
                              <EditPencil className="h-2.5 w-2.5 text-muted-foreground/70 shrink-0" />
                              <span className="truncate italic font-sans">{rc.comment}</span>
                            </div>
                          )}

                          {/* Author & Timestamp */}
                          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground mt-1">
                            <span className="font-medium text-foreground/80">{rc.user}</span>
                            <span className="opacity-40">·</span>
                            <span>{formatMWTimeAgo(rc.timestamp)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Byte Diff Pill */}
                      <span
                        className={cn(
                          "text-[11px] font-semibold shrink-0 rounded-md px-1.5 py-0.5 bg-foreground/[0.03] border border-border/20 flex items-center gap-1 mt-0.5 tabular-nums",
                          diffClass
                        )}
                        title={`${rc.oldLen} → ${rc.newLen} bytes`}
                      >
                        {diff > 0 ? (
                          <motion.span
                            animate={reduceMotion ? false : { y: [0, -1.5, 0] }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                            className="inline-flex items-center"
                          >
                            <ArrowUpRight className="h-3 w-3 text-emerald-500 shrink-0" />
                          </motion.span>
                        ) : diff < 0 ? (
                          <motion.span
                            animate={reduceMotion ? false : { y: [0, 1.5, 0] }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                            className="inline-flex items-center"
                          >
                            <ArrowDownRight className="h-3 w-3 text-rose-500 shrink-0" />
                          </motion.span>
                        ) : null}
                        <span>{formattedDiff}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : isLoadingRecent ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex-1 flex items-center justify-center">
                Loading recent edits...
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground flex-1 flex items-center justify-center">
                No recent activity recorded yet.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── 2. Countries Atlas (Explore the World) ── */}
      {countries && countries.length > 0 && (
        <section
          id="sovereign-nations"
          aria-label="Countries of Ixnay"
          className="w-full flex flex-col pt-1 scroll-mt-6"
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              Explore Countries
            </h2>
            <Link
              href={withBasePath("/countries")}
              data-cuelume-press="press"
              data-cuelume-hover="tick"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 font-medium group/all"
            >
              <span>All 82 Realms</span>
              <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover/all:translate-x-0.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {countries.slice(0, 12).map((c) => (
              <motion.div
                key={c.id}
                whileHover={reduceMotion ? {} : { scale: 1.03, y: -2 }}
                whileTap={reduceMotion ? {} : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
              >
                <Link
                  href={withBasePath(
                    `/wiki/${encodeURIComponent((c.name ?? "").replace(/ /g, "_"))}`
                  )}
                  data-cuelume-press="droplet"
                  data-cuelume-hover="tick"
                  className={cn(
                    "group relative overflow-hidden flex flex-col p-3 rounded-2xl",
                    "border border-black/[0.08] dark:border-white/[0.1]",
                    "bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl",
                    "shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_16px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_24px_rgba(0,0,0,0.3)]",
                    "hover:border-purple-500/40 hover:bg-white/90 dark:hover:bg-zinc-900/90 hover:shadow-md",
                    "transition-colors duration-150 block text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                  )}
                >
                  <div className="w-full h-16 rounded-xl overflow-hidden mb-2.5 bg-foreground/5 border border-foreground/10 relative shadow-2xs">
                    {c.flagUrl ? (
                      <img
                        src={c.flagUrl}
                        alt={c.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                        FLAG
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-foreground truncate group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors">
                    {c.name}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground mt-0.5 tabular-nums truncate font-medium">
                    {c.population ? <span>Pop {formatNumber(c.population, 1)}</span> : null}
                    {c.population && c.gdp ? <span className="opacity-40">·</span> : null}
                    {c.gdp ? <span>{formatCurrency(c.gdp)}</span> : null}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
