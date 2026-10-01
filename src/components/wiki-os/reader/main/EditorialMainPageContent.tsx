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
import { ixstatesHref } from "~/lib/system/wikios-standalone";
import { formatMWTimeAgo } from "~/lib/wiki-os/adapters/mediawiki/timestamp";
import { formatNumber, formatCurrency } from "~/lib/utils/format-utils";
import type { MainPageContentProps } from "./types";

function ActivityItemThumbnail({ src, title }: { src?: string | null; title?: string | null }) {
  const [hasError, setHasError] = useState(false);

  if (src && !hasError) {
    return (
      <div className="bg-fill-3 rounded-control border-separator mt-0.5 h-9 w-9 shrink-0 overflow-hidden border">
        <img
          src={src}
          alt={title ?? ""}
          className="h-full w-full object-cover transition-transform duration-300"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div className="bg-fill-4 text-label-secondary rounded-control border-separator group-hover:text-tint mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border transition-colors">
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
          <div className="border-separator mb-3 flex items-center justify-between border-b pb-2">
            <h2 className="text-label text-headline">Browse by topic</h2>
            <Link
              href={withBasePath("/util/categories/Countries")}
              data-cuelume-press="press"
              data-cuelume-hover="tick"
              className="text-label-secondary hover:text-label group/all text-caption flex items-center gap-1 transition-colors"
            >
              <span>All Topics</span>
              <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover/all:translate-x-0.5" />
            </Link>
          </div>

          <div className="rounded-card border-separator bg-surface sm:rounded-card flex flex-1 flex-col justify-between border p-3 sm:p-3">
            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2">
              {categories.map((cat) => {
                const meta = CATEGORY_META[cat.name] || {
                  icon: IconoirGlobe,
                  desc: "Encyclopedia entries",
                };
                const Icon = meta.icon;
                return (
                  <Link
                    key={cat.name}
                    href={withBasePath(`/util/categories/${encodeURIComponent(cat.name)}`)}
                    data-cuelume-press="page"
                    data-cuelume-hover="tick"
                    className={cn(
                      "rounded-row flex items-start gap-2 p-2 sm:p-3",
                      "hover:bg-fill-4 group transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.98]"
                    )}
                  >
                    <div
                      className="border-separator rounded-control mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border transition-transform"
                      style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-label group-hover:text-label text-caption truncate font-semibold">
                        {cat.name}
                      </span>
                      <span className="text-label-secondary text-footnote mt-0.5 truncate leading-snug">
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
          <div className="border-separator mb-3 flex items-center justify-between border-b pb-2">
            <h2 className="text-label text-headline">Recent activity</h2>
            <Link
              href={withBasePath("/util/recent-changes")}
              data-cuelume-press="press"
              data-cuelume-hover="tick"
              className="text-label-secondary hover:text-label group/all text-caption flex items-center gap-1 transition-colors"
            >
              <span>View all</span>
              <ArrowUpRight className="h-3 w-3 transition-transform duration-200 group-hover/all:translate-x-0.5 group-hover/all:-translate-y-0.5" />
            </Link>
          </div>

          <div className="rounded-card border-separator bg-surface sm:rounded-card relative flex flex-1 flex-col justify-between overflow-hidden border p-3 sm:p-3">
            {visibleChanges.length > 0 ? (
              <ul className="divide-separator flex flex-1 flex-col justify-between divide-y">
                {visibleChanges.map((rc, idx) => {
                  const diff = (rc.newLen ?? 0) - (rc.oldLen ?? 0);
                  const diffSign = diff > 0 ? "+" : "";
                  const formattedDiff = `${diffSign}${diff.toLocaleString()}`;

                  let diffClass = "text-label-secondary";
                  if (diff > 0) {
                    diffClass = "text-green font-semibold";
                  } else if (diff < 0) {
                    diffClass = "text-red font-semibold";
                  }

                  return (
                    <li
                      key={idx}
                      className="hover:bg-fill-4 group rounded-card flex flex-1 items-start justify-between gap-3 px-3 py-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <ActivityItemThumbnail src={rc.thumbnail} title={rc.title} />

                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-center gap-2">
                            <Link
                              href={withBasePath(
                                `/wiki/${encodeURIComponent((rc.title ?? "").replace(/ /g, "_"))}`
                              )}
                              data-cuelume-press="droplet"
                              data-cuelume-hover="tick"
                              className="text-label text-caption hover:text-tint sm:text-headline truncate font-semibold transition-colors"
                            >
                              {rc.title}
                            </Link>
                          </div>

                          {/* Page Blurb / Description */}
                          {rc.blurb && (
                            <p className="text-label-secondary text-footnote mt-0.5 line-clamp-1 leading-snug">
                              {rc.blurb}
                            </p>
                          )}

                          {/* Edit Notes / Summary */}
                          {rc.comment && rc.comment.trim() && (
                            <div className="text-label-secondary bg-fill-4 border-separator rounded-control-sm text-footnote mt-1 flex max-w-fit items-center gap-1 border px-2 py-0.5">
                              <EditPencil className="text-label-secondary h-2.5 w-2.5 shrink-0" />
                              <span className="truncate font-sans italic">{rc.comment}</span>
                            </div>
                          )}

                          {/* Author & Timestamp */}
                          <div className="text-label-secondary text-footnote mt-1 flex items-center gap-2">
                            <span className="text-label-secondary font-medium">{rc.user}</span>
                            <span className="opacity-40">·</span>
                            <span>{formatMWTimeAgo(rc.timestamp)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Byte Diff Pill */}
                      <span
                        className={cn(
                          "bg-fill-4 border-separator rounded-control-sm text-caption mt-0.5 flex shrink-0 items-center gap-1 border px-2 py-0.5 font-semibold tabular-nums",
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
                            <ArrowUpRight className="text-green h-3 w-3 shrink-0" />
                          </motion.span>
                        ) : diff < 0 ? (
                          <motion.span
                            animate={reduceMotion ? false : { y: [0, 1.5, 0] }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                            className="inline-flex items-center"
                          >
                            <ArrowDownRight className="text-red h-3 w-3 shrink-0" />
                          </motion.span>
                        ) : null}
                        <span>{formattedDiff}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : isLoadingRecent ? (
              <div className="text-label-secondary text-footnote flex flex-1 items-center justify-center py-8 text-center">
                Loading recent edits...
              </div>
            ) : (
              <div className="text-label-secondary text-footnote flex flex-1 items-center justify-center py-8 text-center">
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
          <div className="border-separator mb-3 flex items-center justify-between border-b pb-2">
            <h2 className="text-label text-headline">Explore Countries</h2>
            <Link
              href={ixstatesHref("/countries")}
              data-cuelume-press="press"
              data-cuelume-hover="tick"
              className="text-label-secondary hover:text-label group/all text-caption flex items-center gap-1 transition-colors"
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
                    "group rounded-card relative flex flex-col overflow-hidden p-3",
                    "border-separator border",
                    "bg-surface",
                    "",
                    "hover:border-tint/40 hover:bg-surface hover:shadow-card",
                    "focus-visible:ring-tint block text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  )}
                >
                  <div className="bg-fill-4 border-separator rounded-row relative mb-2 h-16 w-full overflow-hidden border">
                    {c.flagUrl ? (
                      <img
                        src={c.flagUrl}
                        alt={c.name}
                        className="h-full w-full object-cover transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-label-secondary text-footnote flex h-full w-full items-center justify-center">
                        FLAG
                      </div>
                    )}
                  </div>
                  <span className="text-label group-hover:text-tint text-caption truncate font-semibold transition-colors">
                    {c.name}
                  </span>
                  <div className="text-label-secondary text-caption mt-0.5 flex items-center gap-2 truncate tabular-nums">
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
