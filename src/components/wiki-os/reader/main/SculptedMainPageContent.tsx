"use client";

import React, { useMemo, useState } from "react";
import { Skeleton } from "~/components/ui/skeleton";
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
  Database,
  Page,
  EditPencil,
} from "iconoir-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { ixstatesHref } from "~/lib/system/wikios-standalone";
import { formatMWTimeAgo } from "~/lib/wiki-os/adapters/mediawiki/timestamp";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { formatNumber, formatCurrency } from "~/lib/utils/format-utils";
import type { MainPageContentProps } from "./types";
import { Refraction } from "~/components/ui/facet";

function ActivityItemThumbnail({ src, title }: { src?: string | null; title?: string | null }) {
  const [hasError, setHasError] = useState(false);

  if (src && !hasError) {
    return (
      <div className="bg-fill-3 rounded-control border-separator mt-0.5 h-9 w-9 shrink-0 overflow-hidden border">
        <img
          src={src}
          alt={title ?? ""}
          className="h-full w-full object-cover transition-transform duration-200"
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

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Countries: IconoirGlobe,
  Companies: IconoirBuilding,
  Culture: IconoirPalette,
  Economy: IconoirGraphUp,
  Geography: IconoirMapPin,
  Government: IconoirBank,
  History: IconoirTimer,
  Military: IconoirShield,
  Nature: IconoirLeaf,
  People: IconoirGroup,
  Politics: IconoirMegaphone,
  Technology: IconoirCpu,
};

export function SculptedMainPageContent({
  categories,
  recentChanges,
  isLoadingRecent,
  countries,
  almanacSpotlight,
  isLoadingAlmanac,
}: MainPageContentProps) {
  const reduceMotion = useReducedMotion();

  const visibleChanges = useMemo(() => {
    return recentChanges?.slice(0, 4) ?? [];
  }, [recentChanges]);

  return (
    <div className="w-full space-y-5 pb-2 select-none sm:space-y-6">
      {/* ── 1. Two-Column Grid: Bento Topic Tiles + Liquid Glass Activity Stream (Equal Proportion) ── */}
      <div className="grid grid-cols-1 items-stretch gap-6 sm:gap-8 lg:grid-cols-12">
        {/* Left Column (col-span-6): Expanded Categories Matrix + Live Parsed World Almanac Spotlight Card */}
        <section
          aria-label="Browse Categories & Almanac"
          className="flex h-full flex-col lg:col-span-6"
        >
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

          <div className="flex flex-1 flex-col gap-3">
            {/* Expanded 12 Primary Categories Matrix (3-Column Grid) */}
            <div className="rounded-card border-separator bg-surface sm:rounded-card border p-3 sm:p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2">
                {categories.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.name] || IconoirGlobe;
                  return (
                    <Link
                      key={cat.name}
                      href={withBasePath(`/util/categories/${encodeURIComponent(cat.name)}`)}
                      data-cuelume-press="page"
                      data-cuelume-hover="tick"
                      className={cn(
                        "rounded-row flex items-center gap-2 p-2 sm:p-3",
                        "hover:bg-fill-4 group transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.98]"
                      )}
                    >
                      <div
                        className="border-separator rounded-control flex h-7 w-7 shrink-0 items-center justify-center border transition-transform"
                        style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-label group-hover:text-label text-caption truncate font-semibold">
                        {cat.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Bottom: Structured World Almanac Spotlight Card */}
            <div className="group material-hero text-label relative isolate flex flex-1 flex-col justify-between overflow-hidden rounded-2xl p-4 sm:rounded-3xl sm:p-5">
              <Refraction />
              <TextureOverlay texture="paperGrain" opacity={0.05} />

              {/* Eyebrow Header: Badge + Byline + Category Link */}
              <div className="border-separator mb-3 flex items-center justify-between gap-2 border-b pb-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <div className="border-tint/20 bg-tint/10 text-caption text-tint inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-0.5 font-semibold">
                    <IconoirGlobe className="text-tint h-3.5 w-3.5" />
                    <span>World Almanac</span>
                  </div>
                </div>

                <Link
                  href={withBasePath("/wiki/Category:Bureau_of_International_Statistics")}
                  data-cuelume-press="page"
                  data-cuelume-hover="tick"
                  className="text-label-secondary hover:text-label rounded-control-sm text-caption inline-flex shrink-0 items-center gap-1 px-2 py-0.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-black/5"
                  title="Browse full statistical category index"
                >
                  <Database className="h-3 w-3" />
                  <span>Index Registry</span>
                </Link>
              </div>

              {/* Card Body: Media + Editorial Content */}
              {isLoadingAlmanac ? (
                <div
                  className="flex flex-1 flex-col items-center gap-4 py-1 sm:flex-row sm:items-start sm:gap-5"
                  aria-busy="true"
                >
                  <Skeleton className="rounded-row aspect-[16/10] w-full shrink-0 sm:aspect-[4/3] sm:w-[150px] md:w-[170px]" />
                  <div className="flex w-full min-w-0 flex-1 flex-col justify-center gap-2">
                    <Skeleton className="rounded-control-sm h-3 w-28" />
                    <Skeleton className="rounded-control-sm h-5 w-3/4" />
                    <Skeleton className="rounded-control-sm h-3.5 w-full" />
                    <Skeleton className="rounded-control-sm h-3.5 w-5/6" />
                  </div>
                </div>
              ) : almanacSpotlight ? (
                <div className="flex flex-1 flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-5">
                  {/* Visual Frame */}
                  <Link
                    href={withBasePath(`/wiki/${almanacSpotlight.slug}`)}
                    data-cuelume-press="droplet"
                    data-cuelume-hover="tick"
                    className="group/img group/media rounded-row border-separator sm:rounded-card relative block aspect-[16/10] w-full shrink-0 overflow-hidden border bg-black/5 sm:aspect-[4/3] sm:w-[150px] md:w-[170px]"
                  >
                    {almanacSpotlight.thumbnail ? (
                      <>
                        <img
                          src={almanacSpotlight.thumbnail}
                          alt={almanacSpotlight.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover/img:scale-105"
                        />
                      </>
                    ) : (
                      <div className="bg-tint-fill relative flex h-full w-full flex-col items-center justify-center overflow-hidden p-3 text-center">
                        <div className="rounded-row border-tint/25 bg-tint/15 text-tint mb-1 flex h-10 w-10 items-center justify-center border">
                          <IconoirGraphUp className="text-tint h-5 w-5" />
                        </div>
                      </div>
                    )}
                  </Link>

                  {/* Editorial Text Column */}
                  <div className="flex h-full min-w-0 flex-1 flex-col justify-between py-0.5">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-eyebrow text-tint truncate">
                          {almanacSpotlight.category}
                        </span>
                      </div>

                      <Link
                        href={withBasePath(`/wiki/${almanacSpotlight.slug}`)}
                        data-cuelume-press="page"
                        data-cuelume-hover="tick"
                        className="group/title mt-1 block"
                      >
                        <h3 className="text-label text-headline group-hover/title:text-tint sm:text-headline leading-snug transition-colors lg:text-[17px]">
                          {almanacSpotlight.title}
                        </h3>
                      </Link>

                      <p className="text-label-secondary text-footnote sm:text-callout mt-2 line-clamp-3 leading-relaxed font-normal">
                        {almanacSpotlight.excerpt}
                      </p>
                    </div>

                    <div className="border-separator mt-3 flex items-center justify-between border-t pt-3">
                      <Link
                        href={withBasePath(`/wiki/${almanacSpotlight.slug}`)}
                        data-cuelume-press="droplet"
                        data-cuelume-hover="tick"
                        className="group/cta text-caption text-tint hover:text-tint ml-2 inline-flex shrink-0 items-center gap-1 font-semibold transition-colors"
                      >
                        <span>Explore index</span>
                        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-label-secondary text-footnote py-6 text-center">
                  Almanac statistical index currently syncing...
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Column (col-span-6): Liquid Glass Activity Stream */}
        <section aria-label="Recent Wiki Changes" className="flex h-full flex-col lg:col-span-6">
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
                      className="hover:bg-fill-4 group rounded-card flex flex-1 items-start justify-between gap-3 px-3 py-3 transition-colors duration-150"
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
                              className="text-label rounded-control-sm text-caption hover:text-tint focus-visible:ring-tint sm:text-headline truncate font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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

      {/* ── 2. Countries Floating Deck (Explore the World) ── */}
      {countries && countries.length > 0 && (
        <section
          id="sovereign-nations"
          aria-label="Explore Countries"
          className="flex w-full scroll-mt-6 flex-col pt-1"
        >
          <div className="border-separator mb-3 flex items-center justify-between border-b pb-2">
            <h2 className="text-label text-headline">Explore Countries</h2>
            <Link
              href={ixstatesHref("/countries")}
              data-cuelume-press="press"
              data-cuelume-hover="tick"
              className="text-label-secondary hover:text-label group/all rounded-control-sm text-caption focus-visible:ring-indigo flex items-center gap-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
                    "hover:border-tint/40 hover:bg-surface hover:shadow-floating",
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
