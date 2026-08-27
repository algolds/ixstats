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
      <div className="bg-muted/40 mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-black/10 shadow-2xs dark:border-white/10">
        <img
          src={src}
          alt={title ?? ""}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div className="bg-foreground/[0.02] text-muted-foreground/60 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/5 transition-colors group-hover:text-blue-500 dark:border-white/10">
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
    <div className="w-full space-y-5 pb-2 select-none sm:space-y-6">
      {/* ── 1. Two-Column Grid: Topic Taxonomy + Live Revisions Ledger (Equal Proportion) ── */}
      <div className="grid grid-cols-1 items-stretch gap-6 sm:gap-8 lg:grid-cols-12">
        {/* Left Column (col-span-6): Topic Taxonomy Matrix */}
        <section aria-label="Browse by Topic" className="flex h-full flex-col lg:col-span-6">
          <div className="mb-3 flex items-center justify-between border-b border-black/[0.06] pb-2 dark:border-white/[0.08]">
            <h2 className="text-foreground text-sm font-semibold tracking-tight">
              Browse by topic
            </h2>
            <Link
              href={withBasePath("/wiki/categories/Countries")}
              data-cuelume-press="press"
              data-cuelume-hover="tick"
              className="text-muted-foreground hover:text-foreground group/all flex items-center gap-1 text-xs font-medium transition-colors"
            >
              <span>All Topics</span>
              <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover/all:translate-x-0.5" />
            </Link>
          </div>

          <div className="flex flex-1 flex-col justify-between rounded-2xl border border-black/[0.08] bg-white/70 p-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_20px_rgba(0,0,0,0.02)] backdrop-blur-xl sm:rounded-3xl sm:p-3 dark:border-white/[0.1] dark:bg-zinc-900/70 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_6px_24px_rgba(0,0,0,0.2)]">
            <div className="grid flex-1 grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
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
                      "flex items-start gap-2.5 rounded-xl p-2 sm:p-2.5",
                      "hover:bg-foreground/[0.04] group transition-all duration-150 active:scale-[0.98]"
                    )}
                  >
                    <div
                      className="border-foreground/10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-transform group-hover:scale-105"
                      style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-foreground/90 group-hover:text-foreground truncate text-xs font-semibold">
                        {cat.name}
                      </span>
                      <span className="text-muted-foreground/75 mt-0.5 truncate text-[10.5px] leading-snug">
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
        <section aria-label="Recent Wiki Activity" className="flex h-full flex-col lg:col-span-6">
          <div className="mb-3 flex items-center justify-between border-b border-black/[0.06] pb-2 dark:border-white/[0.08]">
            <h2 className="text-foreground text-sm font-semibold tracking-tight">
              Recent activity
            </h2>
            <Link
              href={withBasePath("/wiki/recent-changes")}
              data-cuelume-press="press"
              data-cuelume-hover="tick"
              className="text-muted-foreground hover:text-foreground group/all flex items-center gap-1 text-xs font-medium transition-colors"
            >
              <span>View all</span>
              <ArrowUpRight className="h-3 w-3 transition-transform duration-200 group-hover/all:translate-x-0.5 group-hover/all:-translate-y-0.5" />
            </Link>
          </div>

          <div className="relative flex flex-1 flex-col justify-between overflow-hidden rounded-2xl border border-black/[0.08] bg-white/70 p-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_20px_rgba(0,0,0,0.02)] backdrop-blur-xl sm:rounded-3xl sm:p-3 dark:border-white/[0.1] dark:bg-zinc-900/70 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_6px_24px_rgba(0,0,0,0.2)]">
            {visibleChanges.length > 0 ? (
              <ul className="divide-border/30 flex flex-1 flex-col justify-between divide-y">
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
                      className="hover:bg-foreground/[0.04] group flex flex-1 items-start justify-between gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <ActivityItemThumbnail src={rc.thumbnail} title={rc.title} />

                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={withBasePath(
                                `/wiki/${encodeURIComponent((rc.title ?? "").replace(/ /g, "_"))}`
                              )}
                              data-cuelume-press="droplet"
                              data-cuelume-hover="tick"
                              className="text-foreground truncate text-xs font-semibold transition-colors hover:text-blue-500 sm:text-sm"
                            >
                              {rc.title}
                            </Link>
                          </div>

                          {/* Page Blurb / Description */}
                          {rc.blurb && (
                            <p className="text-muted-foreground/80 mt-0.5 line-clamp-1 text-[11px] leading-snug">
                              {rc.blurb}
                            </p>
                          )}

                          {/* Edit Notes / Summary */}
                          {rc.comment && rc.comment.trim() && (
                            <div className="text-foreground/75 bg-foreground/[0.03] border-border/40 mt-1 flex max-w-fit items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px]">
                              <EditPencil className="text-muted-foreground/70 h-2.5 w-2.5 shrink-0" />
                              <span className="truncate font-sans italic">{rc.comment}</span>
                            </div>
                          )}

                          {/* Author & Timestamp */}
                          <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-[10.5px]">
                            <span className="text-foreground/80 font-medium">{rc.user}</span>
                            <span className="opacity-40">·</span>
                            <span>{formatMWTimeAgo(rc.timestamp)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Byte Diff Pill */}
                      <span
                        className={cn(
                          "bg-foreground/[0.03] border-border/20 mt-0.5 flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
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
                            <ArrowUpRight className="h-3 w-3 shrink-0 text-emerald-500" />
                          </motion.span>
                        ) : diff < 0 ? (
                          <motion.span
                            animate={reduceMotion ? false : { y: [0, 1.5, 0] }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                            className="inline-flex items-center"
                          >
                            <ArrowDownRight className="h-3 w-3 shrink-0 text-rose-500" />
                          </motion.span>
                        ) : null}
                        <span>{formattedDiff}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : isLoadingRecent ? (
              <div className="text-muted-foreground flex flex-1 items-center justify-center py-8 text-center text-xs">
                Loading recent edits...
              </div>
            ) : (
              <div className="text-muted-foreground flex flex-1 items-center justify-center py-8 text-center text-xs">
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
          className="flex w-full scroll-mt-6 flex-col pt-1"
        >
          <div className="mb-3 flex items-center justify-between border-b border-black/[0.06] pb-2 dark:border-white/[0.08]">
            <h2 className="text-foreground text-sm font-semibold tracking-tight">
              Explore Countries
            </h2>
            <Link
              href={withBasePath("/countries")}
              data-cuelume-press="press"
              data-cuelume-hover="tick"
              className="text-muted-foreground hover:text-foreground group/all flex items-center gap-1 text-xs font-medium transition-colors"
            >
              <span>All 82 Realms</span>
              <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover/all:translate-x-0.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
                    "group relative flex flex-col overflow-hidden rounded-2xl p-3",
                    "border border-black/[0.08] dark:border-white/[0.1]",
                    "bg-white/70 backdrop-blur-xl dark:bg-zinc-900/70",
                    "shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_16px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_24px_rgba(0,0,0,0.3)]",
                    "hover:border-purple-500/40 hover:bg-white/90 hover:shadow-md dark:hover:bg-zinc-900/90",
                    "block text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-zinc-900"
                  )}
                >
                  <div className="bg-foreground/5 border-foreground/10 relative mb-2.5 h-16 w-full overflow-hidden rounded-xl border shadow-2xs">
                    {c.flagUrl ? (
                      <img
                        src={c.flagUrl}
                        alt={c.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-muted-foreground flex h-full w-full items-center justify-center text-[10px]">
                        FLAG
                      </div>
                    )}
                  </div>
                  <span className="text-foreground truncate text-xs font-semibold transition-colors group-hover:text-purple-500 dark:group-hover:text-purple-400">
                    {c.name}
                  </span>
                  <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate text-[10.5px] font-medium tabular-nums">
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
