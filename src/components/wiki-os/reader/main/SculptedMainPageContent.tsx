"use client";

import React from "react";
import { Skeleton } from "~/components/ui/skeleton";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
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
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import type { MainPageContentProps } from "./types";
import { CountriesSection, RecentActivitySection } from "./MainPageSections";

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
  return (
    <div className="w-full space-y-5 pb-2 select-none sm:space-y-6">
      <div className="grid grid-cols-1 items-stretch gap-6 sm:gap-8 lg:grid-cols-12">
        {/* Left Column (col-span-6): Expanded Categories Matrix + Live Parsed World Almanac Spotlight Card */}
        <section
          aria-label="Browse categories & almanac"
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
              <span>All topics</span>
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
                        "hover:bg-fill-4 group transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150"
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
            <div className="group bg-surface border-separator shadow-card text-label relative flex flex-1 flex-col justify-between overflow-hidden rounded-2xl border p-4 sm:rounded-3xl sm:p-5">
              {/* Eyebrow Header: Badge + Byline + Category Link */}
              <div className="border-separator mb-3 flex items-center justify-between gap-2 border-b pb-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <div className="border-tint/20 bg-tint/10 text-caption text-tint inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-0.5 font-semibold">
                    <IconoirGlobe className="text-tint h-3.5 w-3.5" />
                    <span>World almanac</span>
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
                  <span>Index registry</span>
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

        <RecentActivitySection recentChanges={recentChanges} isLoadingRecent={isLoadingRecent} />
      </div>

      <CountriesSection countries={countries} />
    </div>
  );
}
