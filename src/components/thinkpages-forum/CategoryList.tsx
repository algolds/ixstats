"use client";

import Link from "next/link";
import { NavArrowRight } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { timeAgo } from "~/lib/format/compact";
import { api, type RouterOutputs } from "~/trpc/react";

type Category = RouterOutputs["thinkpagesForum"]["categories"][number];

function CategoryRow({ category }: { category: Category }) {
  const threads = `${category.threadCount} ${category.threadCount === 1 ? "thread" : "threads"}`;
  return (
    <li>
      <Link
        href={`/thinkpages/c/${category.key}`}
        className="hover:bg-fill-4 focus-visible:outline-tint flex items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <div className="min-w-0 flex-1">
          <p className="text-headline text-label">{category.name}</p>
          {category.description ? (
            <p className="text-subhead text-label-secondary line-clamp-2">{category.description}</p>
          ) : null}
        </div>
        <div className="text-footnote text-label-secondary shrink-0 text-right tabular-nums">
          <p>{threads}</p>
          {category.lastPostAt ? <p>{timeAgo(category.lastPostAt)}</p> : null}
        </div>
        <NavArrowRight aria-hidden className="text-label-tertiary size-4 shrink-0" />
      </Link>
    </li>
  );
}

/** Forum home: the sitewide categories the viewer can see (ruling P1). */
export function CategoryList() {
  const { data: categories, isLoading } = api.thinkpagesForum.categories.useQuery();

  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-4 sm:py-6 md:py-8">
      <PageHeader title="ThinkPages Forum" bleed />
      {isLoading ? (
        <Skeleton className="rounded-card h-64 w-full" />
      ) : (
        <Card content="navigation" className="overflow-hidden">
          {categories && categories.length > 0 ? (
            <ul className="divide-separator divide-y">
              {categories.map((category) => (
                <CategoryRow key={category.key} category={category} />
              ))}
            </ul>
          ) : (
            <EmptyState compact title="No categories yet" />
          )}
        </Card>
      )}
    </div>
  );
}
