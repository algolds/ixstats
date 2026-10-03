"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ArrowDownRight, Page, EditPencil } from "iconoir-react";
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

/** Latest edits ledger, shared by both main page layouts. */
export function RecentActivitySection({
  recentChanges,
  isLoadingRecent,
}: Pick<MainPageContentProps, "recentChanges" | "isLoadingRecent">) {
  const reduceMotion = useReducedMotion();
  const visibleChanges = useMemo(() => recentChanges?.slice(0, 4) ?? [], [recentChanges]);

  return (
    <section aria-label="Recent wiki changes" className="flex h-full flex-col lg:col-span-6">
      <div className="border-separator mb-3 flex items-center justify-between border-b pb-2">
        <h2 className="text-label text-headline">Recent activity</h2>
        <Link
          href={withBasePath("/wiki/recent-changes")}
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
  );
}

/** "Explore countries" grid, shared by both main page layouts. */
export function CountriesSection({ countries }: Pick<MainPageContentProps, "countries">) {
  const reduceMotion = useReducedMotion();
  if (!countries || countries.length === 0) return null;

  return (
    <section
      id="sovereign-nations"
      aria-label="Explore countries"
      className="flex w-full scroll-mt-6 flex-col pt-1"
    >
      <div className="border-separator mb-3 flex items-center justify-between border-b pb-2">
        <h2 className="text-label text-headline">Explore countries</h2>
        <Link
          href={withBasePath("/countries")}
          data-cuelume-press="press"
          data-cuelume-hover="tick"
          className="text-label-secondary hover:text-label group/all rounded-control-sm text-caption focus-visible:ring-indigo flex items-center gap-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <span>All {countries.length} realms</span>
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
              href={withBasePath(`/wiki/${encodeURIComponent((c.name ?? "").replace(/ /g, "_"))}`)}
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
  );
}
