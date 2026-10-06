"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { withBasePath } from "~/lib/base-path";
import { Page as FileText, Folder, ArrowLeft } from "iconoir-react";

export interface CategoryMember {
  title: string;
  ns: number;
  imageUrl?: string | null;
}

/** Breadcrumb pill, title, description and the article/subcategory counters of a category page. */
export function CategoryMasthead({
  title,
  description,
  articleCount,
  subcategoryCount,
  articleAccentColor,
}: {
  title: string;
  description: ReactNode;
  articleCount: number;
  subcategoryCount: number;
  /** Tints the article counter icon; the default is green. */
  articleAccentColor?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className="bg-surface border-separator shadow-card text-label rounded-card relative overflow-hidden border p-6 sm:p-8"
    >
      <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="max-w-2xl space-y-2">
          <Link
            href={withBasePath("/util/categories")}
            className="group border-tint/20 bg-tint/10 text-caption text-tint hover:bg-tint/15 focus-visible:outline-tint inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <ArrowLeft
              aria-hidden="true"
              className="h-3 w-3 transition-[translate] duration-200 motion-safe:group-hover:-translate-x-0.5 motion-safe:group-focus-visible:-translate-x-0.5"
            />
            <Folder aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Category directory</span>
            <span aria-hidden="true" className="text-label-secondary">
              /
            </span>
            <span className="font-semibold">{title}</span>
          </Link>

          <h1 className="text-label font-brand text-title-1 sm:text-large-title">{title}</h1>

          <p className="text-label-secondary text-body leading-relaxed">{description}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="border-separator rounded-card bg-surface shadow-card flex items-center gap-2 border px-4 py-3">
            <div
              className={
                articleAccentColor
                  ? "rounded-row flex h-8 w-8 shrink-0 items-center justify-center"
                  : "rounded-row bg-green/10 text-green flex h-8 w-8 shrink-0 items-center justify-center"
              }
              style={
                articleAccentColor
                  ? { backgroundColor: `${articleAccentColor}15`, color: articleAccentColor }
                  : undefined
              }
            >
              <FileText aria-hidden="true" className="h-4 w-4" />
            </div>
            <div className="text-left">
              <div className="text-label text-headline tabular-nums">{articleCount}</div>
              <div className="text-label-secondary text-caption">Articles</div>
            </div>
          </div>

          {subcategoryCount > 0 && (
            <div className="border-separator rounded-card bg-surface shadow-card flex items-center gap-2 border px-4 py-3">
              <div className="rounded-row bg-tint/10 text-tint flex h-8 w-8 shrink-0 items-center justify-center">
                <Folder className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-label text-headline tabular-nums">{subcategoryCount}</div>
                <div className="text-label-secondary text-caption">Subcategories</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function SubcategorySection({ subcategories }: { subcategories: CategoryMember[] }) {
  if (subcategories.length === 0) return null;

  return (
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
              href={withBasePath(`/util/categories/${encodeURIComponent(name.replace(/ /g, "_"))}`)}
              className="text-label group rounded-row border-separator bg-surface text-caption shadow-card hover:border-tint/40 hover:bg-surface hover:text-tint focus-visible:outline-tint facet-press inline-flex items-center gap-2 border px-4 py-2 font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Folder
                aria-hidden="true"
                className="text-tint/70 group-hover:text-tint group-focus-visible:text-tint h-3.5 w-3.5 shrink-0 transition-colors"
              />
              <span>{name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Article tile: thumbnail (or flag) and title, with an optional second line. */
export function CategoryPageCard({
  title,
  imageUrl,
  flagUrl,
  detail,
}: {
  title: string;
  imageUrl?: string | null;
  flagUrl?: string | null;
  detail?: string | null;
}) {
  const displayImage = imageUrl || flagUrl;
  const isFlag = !imageUrl && !!flagUrl;

  return (
    <Link
      href={withBasePath(`/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`)}
      className="group rounded-card border-separator bg-surface hover:border-tint/40 hover:bg-surface hover:shadow-card focus-visible:outline-tint facet-press relative flex items-center gap-3 overflow-hidden border p-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
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
        <div className="bg-fill-3 text-label-secondary rounded-row group-hover:bg-tint/10 group-hover:text-tint group-focus-visible:bg-tint/10 group-focus-visible:text-tint flex h-9 w-9 shrink-0 items-center justify-center transition-colors">
          <FileText aria-hidden="true" className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <span className="text-label text-caption group-hover:text-tint group-focus-visible:text-tint block truncate font-semibold transition-colors">
          {title}
        </span>
        {detail && (
          <span className="text-label-secondary text-caption block truncate">{detail}</span>
        )}
      </div>
    </Link>
  );
}
