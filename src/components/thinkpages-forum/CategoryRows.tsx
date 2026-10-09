"use client";

import Link from "next/link";
import { NavArrowRight } from "iconoir-react";
import { timeAgo } from "~/lib/format/compact";

/** What a category row shows; sitewide and realm categories share the shape. */
export interface CategoryRowData {
  key: string;
  name: string;
  description: string | null;
  threadCount: number;
  lastPostAt: Date | null;
}

interface CategoryRowsProps<C extends CategoryRowData> {
  categories: readonly C[];
  hrefOf: (category: C) => string;
}

/** A list of categories: name, description, thread count and last activity, each row linking to `hrefOf`. */
export function CategoryRows<C extends CategoryRowData>({
  categories,
  hrefOf,
}: CategoryRowsProps<C>) {
  return (
    <ul className="divide-separator divide-y">
      {categories.map((category) => (
        <li key={category.key}>
          <Link
            href={hrefOf(category)}
            className="hover:bg-fill-4 focus-visible:outline-tint flex items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-headline text-label">{category.name}</p>
              {category.description ? (
                <p className="text-subhead text-label-secondary line-clamp-2">
                  {category.description}
                </p>
              ) : null}
            </div>
            <div className="text-footnote text-label-secondary shrink-0 text-right tabular-nums">
              <p>{`${category.threadCount} ${category.threadCount === 1 ? "thread" : "threads"}`}</p>
              {category.lastPostAt ? <p>{timeAgo(category.lastPostAt)}</p> : null}
            </div>
            <NavArrowRight aria-hidden className="text-label-tertiary size-4 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
